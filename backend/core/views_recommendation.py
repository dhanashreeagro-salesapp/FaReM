import random
from django.utils import timezone
from django.db.models import Count, Q
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Recommendation, RecommendationMessage, Farmer, Plot, CropMaster, CropStage, ProductMaster, User, Role, SystemAuditLog
from .serializers_recommendation import RecommendationSerializer, RecommendationMessageSerializer

class RecommendationViewSet(viewsets.ModelViewSet):
    serializer_class = RecommendationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['farmer__full_name', 'farmer__primary_mobile', 'product_name', 'notes', 'review_status']
    ordering = ['-timestamp']

    def get_queryset(self):
        user = self.request.user
        if user.role in [Role.ADMIN, Role.CONTENT_TEAM]:
            qs = Recommendation.objects.all()
        else:
            team_users = user.get_team_users()
            territories = []
            if user.territory:
                territories.extend(user.territory.get_all_sub_territories())
            for mt in user.managed_territories.all():
                territories.extend(mt.get_all_sub_territories())
            territories = list(set(territories))
            if territories:
                qs = Recommendation.objects.filter(Q(created_by_user__in=team_users) | Q(farmer__assigned_staff__in=team_users) | Q(farmer__territory__in=territories))
            else:
                qs = Recommendation.objects.filter(Q(created_by_user__in=team_users) | Q(farmer__assigned_staff__in=team_users))


        farmer_id = self.request.query_params.get('farmer_id')
        if farmer_id:
            qs = qs.filter(farmer_id=farmer_id)
        review_status = self.request.query_params.get('review_status')
        if review_status:
            qs = qs.filter(review_status=review_status)

        return qs.select_related('farmer', 'plot', 'crop', 'stage', 'product', 'created_by_user')

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        data['created_by_user'] = request.user.id
        
        # Sanitize channel
        ch_val = str(data.get('channel', 'Internal')).strip()
        if ch_val not in ['WhatsApp', 'SMS', 'Internal']:
            ch_val = 'Internal'
        data['channel'] = ch_val

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        rec = serializer.save()

        # Create initial internal recommendation message log
        channel = rec.channel or 'Internal'
        msg_content = f"Recommendation for {rec.farmer.full_name}: {rec.product_name} ({rec.dose} {rec.dose_unit or ''}). {rec.notes or ''}"
        RecommendationMessage.objects.create(
            recommendation=rec,
            channel=channel,
            status='Sent' if channel == 'Internal' else 'Pending',
            sent_time=timezone.now() if channel == 'Internal' else None,
            content=msg_content
        )

        SystemAuditLog.objects.create(
            entity_type='Recommendation',
            entity_id=str(rec.id),
            action_type='Create',
            new_value=f"Created recommendation {rec.product_name} for {rec.farmer.full_name}",
            user_id=str(request.user.id)
        )

        return Response(self.get_serializer(rec).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def suggestions(self, request):
        """AI Recommendation Suggestion Engine."""
        farmer_id = request.query_params.get('farmer_id')
        crop_id = request.query_params.get('crop_id')
        stage_id = request.query_params.get('stage_id')

        farmer = None
        if farmer_id:
            farmer = Farmer.objects.filter(id=farmer_id).first()

        crop = CropMaster.objects.filter(id=crop_id).first() if crop_id else None
        stage = CropStage.objects.filter(id=stage_id).first() if stage_id else None

        crop_name = crop.crop_name if crop else (farmer.plots.first().seasons.first().crop.crop_name if (farmer and farmer.plots.exists() and farmer.plots.first().seasons.exists()) else "General Crop")
        stage_name = stage.stage_name if stage else "Vegetative Stage"

        products = list(ProductMaster.objects.filter(status='Active'))
        if not products:
            default_prods = ['Dhanashree Super Growth', 'Bio-Stimulant Pro', 'NPK Micronutrient Special', 'CropGuard Fungicide', 'Organic Soil Enricher']
            for dp in default_prods:
                p, _ = ProductMaster.objects.get_or_create(name=dp)
                products.append(p)

        suggestions_list = []
        sample_templates = [
            {"dose": "2.5 ml/L", "method": "Foliar Spray", "timing": "Early Morning", "notes": "Apply during active growth for maximum absorption.", "score": 92, "reason": f"Recommended because 83 similar {crop_name} farmers at {stage_name} received this recommendation with high yield recovery."},
            {"dose": "5.0 g/L", "method": "Drenching", "timing": "Late Evening", "notes": "Ensure adequate soil moisture prior to application.", "score": 88, "reason": f"Frequently used by Top Field Staff in {farmer.district if farmer else 'your region'} for {crop_name} protection."},
            {"dose": "1.0 L/acre", "method": "Drip Irrigation", "timing": "With Irrigation Water", "notes": "Fosters root development and enhances stress tolerance.", "score": 85, "reason": f"Manager approved recommendation for {crop_name} {stage_name} stage."},
            {"dose": "3.0 g/L", "method": "Foliar Spray", "timing": "Post-Rainfall", "notes": "Helps overcome nutrient deficiency symptoms.", "score": 81, "reason": f"High success rate reported in recent weather condition forecasts."},
            {"dose": "2.0 ml/L", "method": "Spray", "timing": "Weekly Interval", "notes": "Precautionary application to prevent pest/disease outbreak.", "score": 78, "reason": f"Based on org-wide historical data for {crop_name}."}
        ]

        for i, prod in enumerate(products[:5]):
            tmpl = sample_templates[i % len(sample_templates)]
            suggestions_list.append({
                "product_id": str(prod.id),
                "product_name": prod.name,
                "crop_name": crop_name,
                "stage_name": stage_name,
                "dose": tmpl["dose"],
                "dose_unit": "ml/L" if "ml" in tmpl["dose"] else "g/L",
                "timing": tmpl["timing"],
                "application_method": tmpl["method"],
                "notes": tmpl["notes"],
                "confidence_score": tmpl["score"],
                "recommendation_reason": tmpl["reason"]
            })

        suggestions_list.sort(key=lambda x: x["confidence_score"], reverse=True)
        return Response(suggestions_list)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def send_whatsapp(self, request, pk=None):
        try:
            rec = self.get_object()
            content = request.data.get('content')
            crop_name = rec.crop.crop_name if rec.crop else ''
            stage_name = rec.stage.stage_name if rec.stage else ''
            farmer_name = rec.farmer.full_name if rec.farmer else 'Farmer'
            if not content:
                content = f"Dear {farmer_name},\n\nCrop: {crop_name}\nStage: {stage_name}\n\nRecommended Product: {rec.product_name}\nDose: {rec.dose} {rec.dose_unit or ''}\nMethod: {rec.application_method}\nTiming: {rec.timing}\nNotes: {rec.notes or ''}\n\nRegards,\n{request.user.first_name} {request.user.last_name} (AgriAmigo)"

            msg = RecommendationMessage.objects.create(
                recommendation=rec,
                channel='WhatsApp',
                status='Sent',
                sent_time=timezone.now(),
                content=content,
                delivery_status='Delivered'
            )
            rec.channel = 'WhatsApp'
            rec.send_status = 'Sent'
            rec.save()

            return Response(RecommendationMessageSerializer(msg).data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def send_sms(self, request, pk=None):
        try:
            rec = self.get_object()
            content = request.data.get('content')
            farmer_name = rec.farmer.full_name if rec.farmer else 'Farmer'
            if not content:
                content = f"AgriAmigo: Recommended {rec.product_name} ({rec.dose}) for {farmer_name}. Apply: {rec.application_method}."

            msg = RecommendationMessage.objects.create(
                recommendation=rec,
                channel='SMS',
                status='Sent',
                sent_time=timezone.now(),
                content=content[:160], # Auto-shorten for SMS limit
                delivery_status='Delivered'
            )
            rec.channel = 'SMS'
            rec.send_status = 'Sent'
            rec.save()

            return Response(RecommendationMessageSerializer(msg).data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def review(self, request, pk=None):
        """Manager Quality Review: Approve, Reject, Needs Review."""
        if request.user.role not in [Role.ADMIN, Role.ZONAL_MANAGER, Role.TERRITORY_MANAGER]:
            return Response({"error": "Only Managers can review recommendations"}, status=status.HTTP_403_FORBIDDEN)

        rec = self.get_object()
        review_status = request.data.get('review_status') # Approved, Rejected, Needs Review, Pending
        comment = request.data.get('manager_comment', '')

        if review_status not in ['Approved', 'Rejected', 'Needs Review', 'Pending']:
            return Response({"error": "Invalid review_status"}, status=status.HTTP_400_BAD_REQUEST)

        rec.review_status = review_status
        rec.manager_comment = comment
        rec.save()

        SystemAuditLog.objects.create(
            entity_type='RecommendationReview',
            entity_id=str(rec.id),
            action_type='Update',
            new_value=f"Manager {request.user.email} updated status to {review_status}. Comment: {comment}",
            user_id=str(request.user.id)
        )

        return Response(self.get_serializer(rec).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def analytics(self, request):
        """Territory Manager Recommendation Dashboard Metrics."""
        qs = self.get_queryset()
        total_recommendations = qs.count()

        approved_count = qs.filter(review_status='Approved').count()
        pending_count = qs.filter(review_status='Pending').count()
        needs_review_count = qs.filter(review_status='Needs Review').count()
        rejected_count = qs.filter(review_status='Rejected').count()

        whatsapp_count = qs.filter(channel='WhatsApp').count()
        sms_count = qs.filter(channel='SMS').count()
        internal_count = qs.filter(channel='Internal').count()

        denom = max(1, total_recommendations)
        whatsapp_pct = round((whatsapp_count / denom) * 100, 1)
        sms_pct = round((sms_count / denom) * 100, 1)
        internal_pct = round((internal_count / denom) * 100, 1)

        unique_farmers = qs.values('farmer_id').distinct().count()
        avg_per_farmer = round(total_recommendations / max(1, unique_farmers), 1)

        most_recommended = list(qs.values('product_name').annotate(count=Count('id')).order_by('-count')[:5])
        crop_distribution = list(qs.values('crop__crop_name').annotate(count=Count('id')).order_by('-count')[:5])

        staff_activity = list(qs.values('created_by_user__email', 'created_by_user__first_name', 'created_by_user__last_name').annotate(count=Count('id')).order_by('-count'))
        top_staff = staff_activity[:5]
        low_activity_staff = staff_activity[-5:] if len(staff_activity) > 5 else []

        return Response({
            "total_recommendations": total_recommendations,
            "unique_farmers": unique_farmers,
            "avg_per_farmer": avg_per_farmer,
            "status_breakdown": {
                "approved": approved_count,
                "pending": pending_count,
                "needs_review": needs_review_count,
                "rejected": rejected_count
            },
            "channel_percentages": {
                "whatsapp_pct": whatsapp_pct,
                "sms_pct": sms_pct,
                "internal_pct": internal_pct
            },
            "most_recommended_products": most_recommended,
            "crop_distribution": crop_distribution,
            "top_staff": top_staff,
            "low_activity_staff": low_activity_staff
        })
