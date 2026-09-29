from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Territory, SystemAuditLog
from .serializers_territory import TerritorySerializer
from .permissions import IsAdminUser, IsStaffOrManagerOrAdmin

class TerritoryViewSet(viewsets.ModelViewSet):
    """
    CRUD endpoint for Territories.
    List/Retrieve: All authenticated users (for dropdowns/display).
    Create/Update/Delete: Strictly Admin users ONLY.
    """
    serializer_class = TerritorySerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]


    def get_queryset(self):
        return Territory.objects.all().select_related('parent_territory', 'manager')

    def list(self, request, *args, **kwargs):
        try:
            # Fetch all territories
            queryset = self.filter_queryset(self.get_queryset())
            territories = list(queryset)
            
            # Build in-memory map for sub-territories and farmer counts to avoid N+1
            from django.db.models import Count
            from .models import Farmer
            
            # 1. Base counts per territory (1 query)
            farmer_counts_direct = dict(
                Territory.objects.annotate(fc=Count('farmers')).values_list('id', 'fc')
            )
            
            # 2. Build parent-child mapping
            children_map = {t.id: [] for t in territories}
            for t in territories:
                if t.parent_territory_id:
                    if t.parent_territory_id in children_map:
                        children_map[t.parent_territory_id].append(t)
            
            # 3. Calculate recursive farmer counts bottom-up or memoized
            def get_recursive_count(tid, memo):
                if tid in memo:
                    return memo[tid]
                total = farmer_counts_direct.get(tid, 0)
                for child in children_map.get(tid, []):
                    total += get_recursive_count(child.id, memo)
                memo[tid] = total
                return total
                
            memoized_counts = {}
            for t in territories:
                get_recursive_count(t.id, memoized_counts)
                
            context = self.get_serializer_context()
            context['farmer_counts'] = memoized_counts
            context['children_map'] = children_map
            
            serializer = self.get_serializer(territories, many=True, context=context)
            return Response(serializer.data)
        except Exception as e:
            import traceback
            return Response({'error': str(e), 'traceback': traceback.format_exc()}, status=500)

    def perform_create(self, serializer):
        instance = serializer.save()
        SystemAuditLog.objects.create(
            entity_type='Territory',
            entity_id=str(instance.id),
            action_type='Create',
            new_value=f"Created territory {instance.name}",
            user_id=str(self.request.user.id)
        )



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
