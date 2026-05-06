from rest_framework import serializers
from .models import Plot, CropSeason, StageChangeLog

class PlotSerializer(serializers.ModelSerializer):
    location_wkt = serializers.CharField(write_only=True, required=False)
    location_geojson = serializers.SerializerMethodField()

    class Meta:
        model = Plot
        fields = ['id', 'farmer', 'plot_name', 'area_acres', 'soil_type', 'irrigation_source', 'location_wkt', 'location_geojson']
        read_only_fields = ['area_acres']

    def get_location_geojson(self, obj):
        if obj.location:
            return obj.location.geojson
        return None

class CropSeasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = CropSeason
        fields = '__all__'
        read_only_fields = ['expected_next_stage_date']

class StageChangeLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = StageChangeLog
        fields = '__all__'
