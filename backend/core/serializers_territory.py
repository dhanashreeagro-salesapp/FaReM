from rest_framework import serializers
from .models import Territory

class TerritorySerializer(serializers.ModelSerializer):
    sub_territories = serializers.SerializerMethodField()
    farmer_count = serializers.SerializerMethodField()

    class Meta:
        model = Territory
        fields = ['id', 'name', 'parent_territory', 'manager', 'status', 'sub_territories', 'farmer_count']

    def get_sub_territories(self, obj):
        # Prevent infinite deep nesting for flat lists if parent is fetched
        # By default, only serialize sub_territories if we are building the tree
        
        # Use prefetched data or context map if available
        children_map = self.context.get('children_map')
        if children_map is not None:
            subs = children_map.get(obj.id, [])
        elif hasattr(obj, '_prefetched_objects_cache') and 'sub_territories' in obj._prefetched_objects_cache:
            subs = obj.sub_territories.all()
        else:
            subs = obj.sub_territories.all()
            
        if subs:
            return TerritorySerializer(subs, many=True, context=self.context).data
        return []

    def get_farmer_count(self, obj):
        # Check if we have a globally cached mapping of counts in the context
        farmer_counts = self.context.get('farmer_counts')
        if farmer_counts is not None:
            return farmer_counts.get(obj.id, 0)
            
        # Fallback recursive calculation (slow, N+1 prone)
        count = obj.farmers.count()
        for sub in obj.sub_territories.all():
            count += self.get_farmer_count(sub)
        return count
