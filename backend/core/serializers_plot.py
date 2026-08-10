from rest_framework import serializers
from .models import Plot, CropSeason, StageChangeLog

class CropSeasonSerializer(serializers.ModelSerializer):
    crop_name = serializers.CharField(source='crop.crop_name', read_only=True)
    stage_name = serializers.SerializerMethodField()

    class Meta:
        model = CropSeason
        fields = '__all__'
        read_only_fields = ['expected_next_stage_date']

    def get_stage_name(self, obj):
        if obj.current_stage:
            return obj.current_stage.stage_name
        computed = obj.compute_and_set_current_stage()
        if computed:
            try:
                obj.save(update_fields=['current_stage'])
            except Exception:
                pass
            return computed.stage_name
        return "Germination / Initial Growth"

class PlotSerializer(serializers.ModelSerializer):
    location_wkt = serializers.CharField(write_only=True, required=False)
    location_geojson = serializers.SerializerMethodField()
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()
    seasons = CropSeasonSerializer(many=True, read_only=True)

    class Meta:
        model = Plot
        fields = ['id', 'farmer', 'plot_name', 'area_acres', 'calculated_area_acres', 'soil_type', 'irrigation_source', 'location_wkt', 'location_geojson', 'latitude', 'longitude', 'is_active', 'seasons']
        read_only_fields = ['calculated_area_acres']

    def get_location_geojson(self, obj):
        if obj.location:
            return obj.location.geojson
        return None

    def get_latitude(self, obj):
        if obj.location:
            return obj.location.centroid.y if hasattr(obj.location, 'centroid') else getattr(obj.location, 'y', None)
        return None

    def get_longitude(self, obj):
        if obj.location:
            return obj.location.centroid.x if hasattr(obj.location, 'centroid') else getattr(obj.location, 'x', None)
        return None

class StageChangeLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = StageChangeLog
        fields = '__all__'
