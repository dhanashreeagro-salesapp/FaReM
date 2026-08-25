from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import BulkSendBatch, Farmer, Role
from .serializers_bulk_send import BulkSendBatchSerializer
from .tasks import execute_bulk_send_batch
from .permissions import IsAdminOrZonalManager

class BulkSendBatchViewSet(viewsets.ModelViewSet):
    serializer_class = BulkSendBatchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = BulkSendBatch.objects.all().order_by('-created_at')
        if user.role == Role.FIELD_STAFF:
            qs = qs.filter(created_by_user=user)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        channel = serializer.validated_data.get('channel')
        
        explicit_farmer_ids = self.request.data.get('farmer_ids')
        if explicit_farmer_ids and isinstance(explicit_farmer_ids, list):
            farmer_ids = [str(fid) for fid in explicit_farmer_ids]
        else:
            filter_criteria = serializer.validated_data.get('filter_criteria', {})
            farmers = Farmer.objects.filter(status='Active')
            if user.role == Role.FIELD_STAFF:
                farmers = farmers.filter(assigned_staff=user)
            elif user.role == Role.TERRITORY_MANAGER:
                farmers = farmers.filter(territory=user.territory)
                
            crop_id = filter_criteria.get('crop')
            village = filter_criteria.get('village')
            if crop_id:
                farmers = farmers.filter(plots__seasons__crop_id=crop_id, plots__seasons__status='Active')
            if village:
                farmers = farmers.filter(village__icontains=village)
                
            if channel == 'WhatsApp':
                farmers = farmers.exclude(opt_out_whatsapp=True)
            elif channel == 'SMS':
                farmers = farmers.exclude(opt_out_sms=True)
                
            farmer_ids = list(farmers.values_list('id', flat=True))
            
        if user.role in [Role.CONTENT_ADMIN, Role.CONTENT_TEAM]:
            from django.utils import timezone
            import datetime
            from django.db.models import Count
            from .models import ContentTeamSend, AppConfiguration
            
            limit = AppConfiguration.get_config().content_admin_weekly_promotion_limit
            cutoff = timezone.now() - datetime.timedelta(days=7)
            
            over_limit_farmers = ContentTeamSend.objects.filter(
                sent_at__gte=cutoff
            ).values('farmer_id').annotate(
                count=Count('id')
            ).filter(count__gte=limit).values_list('farmer_id', flat=True)
            
            farmer_ids = [fid for fid in farmer_ids if fid not in over_limit_farmers]
            
        batch = serializer.save(
            created_by_user=user,
            farmer_ids=farmer_ids,
            recipient_count=len(farmer_ids),
            approval_status='Approved',
            send_status='Pending'
        )
        
        from django.utils import timezone
        today = timezone.now().date()
        exec_date = batch.scheduled_start_date or today
        if exec_date <= today:
            execute_bulk_send_batch.delay(str(batch.id))

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def cancel(self, request, pk=None):
        batch = self.get_object()
        if batch.send_status in ['Pending', 'InProgress']:
            batch.send_status = 'Cancelled'
            batch.save(update_fields=['send_status'])
            return Response({"message": "Batch cancelled"})
        return Response({"error": "Cannot cancel this batch"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def approve(self, request, pk=None):
        batch = self.get_object()
        user = request.user
        
        # Approval Rules:
        # 1. Zonal Manager self-approves their own zone-level sends
        # 2. Zonal Manager / Admin approves others' sends (acting as Regional Manager)
        # 3. Territory Managers and Field Staff CANNOT approve.
        
        can_approve = False
        if user.role == Role.ZONAL_MANAGER:
             # Zonal managers can approve batches in their zone (simplified here)
             can_approve = True
        elif user.role == Role.ADMIN:
            can_approve = True
            
        if not can_approve:
            return Response({"error": "No permission to approve. Only Zonal Managers or Admins can approve bulk sends."}, status=status.HTTP_403_FORBIDDEN)
            
        batch.approval_status = 'Approved'
        batch.approved_by_user = user
        batch.approval_timestamp = timezone.now()
        batch.save()
        
        # Dispatch Celery Job
        execute_bulk_send_batch.delay(str(batch.id))
        
        return Response({"message": "Batch approved and queued for dispatch"})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        batch = self.get_object()
        user = request.user
        # Auth check...
        batch.approval_status = 'Rejected'
        batch.save()
        return Response({"message": "Batch rejected"})
