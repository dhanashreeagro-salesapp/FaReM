from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Territory, SystemAuditLog
from .serializers_territory import TerritorySerializer
from .permissions import IsAdminUser, IsStaffOrManagerOrAdmin

class TerritoryViewSet(viewsets.ModelViewSet):
    """
    CRUD endpoint for Territories. List/Retrieve open to all authenticated roles.
    """
    serializer_class = TerritorySerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]

    def get_queryset(self):
        return Territory.objects.all().select_related('parent_territory', 'manager')


    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        old_parent_id = instance.parent_territory.id if instance.parent_territory else None
        
        response = super().update(request, *args, **kwargs)
        
        new_parent_id = response.data.get('parent_territory')
        if old_parent_id != new_parent_id:
            SystemAuditLog.objects.create(
                entity_type='Territory',
                entity_id=str(instance.id),
                field_changed='parent_territory',
                old_value=str(old_parent_id),
                new_value=str(new_parent_id),
                action_type='Update',
                user_id=str(request.user.id)
            )
        return response
