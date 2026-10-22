from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission, SAFE_METHODS
from .models import PromotionLibrary, ImportJob
from .serializers_promotion import PromotionLibrarySerializer
from .permissions import IsAdminOrContentTeam

class IsAdminOrContentOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return IsAdminOrContentTeam().has_permission(request, view)

class PromotionLibraryViewSet(viewsets.ModelViewSet):
    """
    CRUD endpoint for Content team and Admin. Readonly for others.
    Supports multi-crop, multi-stage, generic stages, and multi-product promotions.
    """
    serializer_class = PromotionLibrarySerializer
    permission_classes = [IsAuthenticated, IsAdminOrContentOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'title',
        'content_type',
        'category',
        'crops__crop_name',
        'stages__stage_name',
        'related_products__name',
        'crop__crop_name',
        'stage__stage_name',
    ]

    def get_queryset(self):
        import uuid
        from django.db.models import Q

        def is_valid_uuid(val):
            try:
                uuid.UUID(str(val))
                return True
            except (ValueError, AttributeError):
                return False

        qs = PromotionLibrary.objects.order_by('-created_at')
        if self.action in ['retrieve', 'update', 'partial_update']:
            qs = qs.prefetch_related('crops', 'stages', 'related_products').select_related('crop', 'stage')

        crop_param = self.request.query_params.get('crop')
        if crop_param:
            crop_param = crop_param.strip()
            include_general = self.request.query_params.get('include_general', 'true').lower() in ['true', '1']
            if is_valid_uuid(crop_param):
                crop_q = Q(crops__id=crop_param) | Q(crop__id=crop_param)
            else:
                crop_q = Q(crops__crop_name__icontains=crop_param) | Q(crop__crop_name__icontains=crop_param)
            if include_general:
                crop_q |= Q(crops__isnull=True, crop__isnull=True)
            qs = qs.filter(crop_q)

        stage_param = self.request.query_params.get('stage')
        if stage_param:
            stage_param = stage_param.strip()
            if is_valid_uuid(stage_param):
                stage_q = Q(stages__id=stage_param) | Q(stage__id=stage_param)
            else:
                stage_q = (
                    Q(stages__stage_name__icontains=stage_param) |
                    Q(stage__stage_name__icontains=stage_param) |
                    Q(target_stages__icontains=stage_param)
                )
            qs = qs.filter(stage_q)

        product_param = self.request.query_params.get('product')
        if product_param:
            product_param = product_param.strip()
            if is_valid_uuid(product_param):
                prod_q = Q(related_products__id=product_param)
            else:
                prod_q = Q(related_products__name__icontains=product_param)
            qs = qs.filter(prod_q)

        content_type = self.request.query_params.get('content_type')
        if content_type:
            qs = qs.filter(content_type__iexact=content_type.strip())

        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category__iexact=category.strip())

        return qs.distinct()

    def perform_create(self, serializer):
        from django.core.cache import cache
        super().perform_create(serializer)
        cache.delete('promotions_library_payload_all')

    def perform_update(self, serializer):
        from django.core.cache import cache
        super().perform_update(serializer)
        cache.delete('promotions_library_payload_all')

    def perform_destroy(self, instance):
        from django.core.cache import cache
        super().perform_destroy(instance)
        cache.delete('promotions_library_payload_all')

    def list(self, request, *args, **kwargs):
        from django.core.cache import cache
        from collections import defaultdict
        from .models import CropMaster, CropStage, ProductMaster

        has_filters = any(request.query_params.get(k) for k in ['crop', 'stage', 'product', 'content_type', 'category', 'search'])
        cache_key = 'promotions_library_payload_all'
        
        if not has_filters:
            cached_data = cache.get(cache_key)
            if cached_data is not None:
                return Response(cached_data)

        qs = self.filter_queryset(self.get_queryset())
        promos = list(qs)
        if not promos:
            return Response([])

        promo_ids = [p.id for p in promos]

        crops_map = {c.id: c.crop_name for c in CropMaster.objects.all()}
        stages_map = {s.id: s.stage_name for s in CropStage.objects.all()}
        prods_map = {p.id: p.name for p in ProductMaster.objects.all()}

        promo_crops = (
            PromotionLibrary.crops.through.objects
            .filter(promotionlibrary_id__in=promo_ids)
            .values_list('promotionlibrary_id', 'cropmaster_id')
        )
        promo_stages = (
            PromotionLibrary.stages.through.objects
            .filter(promotionlibrary_id__in=promo_ids)
            .values_list('promotionlibrary_id', 'cropstage_id')
        )
        promo_prods = (
            PromotionLibrary.related_products.through.objects
            .filter(promotionlibrary_id__in=promo_ids)
            .values_list('promotionlibrary_id', 'productmaster_id')
        )

        p_crops_dict = defaultdict(list)
        p_crops_names_dict = defaultdict(list)
        for pid, cid in promo_crops:
            p_crops_dict[pid].append(str(cid))
            if cid in crops_map:
                p_crops_names_dict[pid].append(crops_map[cid])

        p_stages_dict = defaultdict(list)
        p_stages_names_dict = defaultdict(list)
        for pid, sid in promo_stages:
            p_stages_dict[pid].append(str(sid))
            if sid in stages_map:
                p_stages_names_dict[pid].append(stages_map[sid])

        p_prods_dict = defaultdict(list)
        p_prods_names_dict = defaultdict(list)
        for pid, prid in promo_prods:
            p_prods_dict[pid].append(str(prid))
            if prid in prods_map:
                p_prods_names_dict[pid].append(prods_map[prid])

        payload = []
        for p in promos:
            c_names = p_crops_names_dict.get(p.id, [])
            s_names = p_stages_names_dict.get(p.id, [])
            if p.target_stages:
                s_names = list(dict.fromkeys(s_names + p.target_stages))
            pr_names = p_prods_names_dict.get(p.id, [])
            
            c_name = crops_map.get(p.crop_id) or (c_names[0] if c_names else None)
            s_name = stages_map.get(p.stage_id) or (s_names[0] if s_names else None)

            payload.append({
                'id': str(p.id),
                'title': p.title,
                'content_type': p.content_type,
                'category': p.category,
                'file_url': p.file_url,
                'target_stages': p.target_stages or [],
                'language_tags': p.language_tags or [],
                'expiry_date': p.expiry_date.isoformat() if p.expiry_date else None,
                'status': p.status,
                'whatsapp_template': p.whatsapp_template,
                'sms_template': p.sms_template,
                'crop': str(p.crop_id) if p.crop_id else None,
                'stage': str(p.stage_id) if p.stage_id else None,
                'crops': p_crops_dict.get(p.id, []),
                'stages': p_stages_dict.get(p.id, []),
                'related_products': p_prods_dict.get(p.id, []),
                'crop_names': c_names,
                'stage_names': s_names,
                'product_names': pr_names,
                'crop_name': c_name,
                'stage_name': s_name,
            })

        if not has_filters:
            cache.set(cache_key, payload, timeout=1800)

        return Response(payload)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsAdminOrContentTeam])
    def download_template(self, request):
        import pandas as pd
        from django.http import HttpResponse
        from io import BytesIO

        sample_data = [
            {
                'Title': 'Vegetative Stage Nutrition Guide',
                'ContentType': 'PDF',
                'FileURL': 'https://example.com/guides/vegetative_nutrition.pdf',
                'Category': 'Product',
                'Crop': 'Tomato, Chilli, Brinjal',
                'Stage': 'Vegetative Stage',
                'Product': 'NPK 19-19-19, Micronutrient Mix',
                'WhatsAppTemplate': 'vegetative_nutrition_wa',
                'SMSTemplate': 'vegetative_nutrition_sms',
            },
            {
                'Title': 'Universal Flowering Booster Video',
                'ContentType': 'Video',
                'FileURL': 'https://youtube.com/watch?v=sample123',
                'Category': 'Product',
                'Crop': '',  # Blank = All Crops / General
                'Stage': 'Flowering Stage, Fruit Setting',
                'Product': 'Flower Plus',
                'WhatsAppTemplate': '',
                'SMSTemplate': '',
            },
            {
                'Title': 'Pest Management for Fruit Development',
                'ContentType': 'Image',
                'FileURL': 'https://example.com/images/pest_alert.png',
                'Category': 'Product',
                'Crop': 'Tomato, Pomegranate',
                'Stage': 'Fruit Development, Fruit Setting',
                'Product': 'Bio-Shield',
                'WhatsAppTemplate': '',
                'SMSTemplate': '',
            }
        ]
        df = pd.DataFrame(sample_data)
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)

        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="promotion_content_template.xlsx"'
        return response

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdminOrContentTeam])
    def upload_for_validation(self, request):
        if 'file' not in request.FILES:
            return Response({"error": "excel file is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        file_obj = request.FILES['file']
        
        import os
        from django.conf import settings
        import_dir = os.path.join(settings.BASE_DIR, 'media', 'imports')
        os.makedirs(import_dir, exist_ok=True)
        file_path = os.path.join(import_dir, f"promos_{request.user.id}_{file_obj.name}")
        
        with open(file_path, 'wb+') as destination:
            for chunk in file_obj.chunks():
                destination.write(chunk)
        
        import_job = ImportJob.objects.create(
            created_by=request.user,
            filename=file_path,
            status='Processing'
        )
        
        from .tasks import validate_promotion_import
        validate_promotion_import.delay(str(import_job.id))
        
        return Response({"message": "Validation started", "import_job_id": str(import_job.id)}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdminOrContentTeam])
    def commit_import(self, request):
        import_job_id = request.data.get('import_job_id')
        
        try:
            job = ImportJob.objects.get(id=import_job_id, created_by=request.user)
        except ImportJob.DoesNotExist:
            return Response({"error": "Import job not found"}, status=status.HTTP_404_NOT_FOUND)
            
        if job.status != 'Pending':
             return Response({"error": "Job is not in a committable state"}, status=status.HTTP_400_BAD_REQUEST)
             
        job.status = 'Processing'
        job.save()

        from django.core.cache import cache
        cache.delete('promotions_library_payload_all')
        
        from .tasks import commit_promotion_import
        commit_promotion_import.delay(str(job.id))
        
        return Response({"message": "Import commit started", "import_job_id": str(job.id)})
