from rest_framework import serializers
from core.models import RouteCorridor, Farmer, Plot

class RouteCorridorSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteCorridor
        fields = '__all__'
        read_only_fields = ['staff', 'created_at']

class BigFarmerSerializer(serializers.ModelSerializer):
    total_acreage = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    village = serializers.CharField()
    
    class Meta:
        model = Farmer
        fields = ['id', 'full_name', 'primary_mobile', 'village', 'total_acreage']
