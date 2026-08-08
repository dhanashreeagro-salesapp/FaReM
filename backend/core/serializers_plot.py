from rest_framework import serializers
from .models import Plot, CropSeason, StageChangeLog

class CropSeasonSerializer(serializers.ModelSerializer):
    crop_name = serializers.CharField(source='crop.crop_name', read_only=True)
    stage_name = serializers.CharField(source='current_stage.stage_name', read_only=True)

    class Meta:
        model = CropSeason
        fields = '__all__'
        read_only_fields = ['expected_next_stage_date']

class PlotSerializer(serializers.ModelSerializer):
    location_wkt = serializers.CharField(write_only=True, required=False)
    location_geojson = serializers.SerializerMethodField()
    seasons = CropSeasonSerializer(many=True, read_only=True)

    class Meta:
        model = Plot
        fields = ['id', 'farmer', 'plot_name', 'area_acres', 'calculated_area_acres', 'soil_type', 'irrigation_source', 'location_wkt', 'location_geojson', 'is_active', 'seasons']
        read_only_fields = ['calculated_area_acres']

    def get_location_geojson(self, obj):
        if obj.location:
            return obj.location.geojson
        return None

class StageChangeLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = StageChangeLog
        fields = '__all__'
