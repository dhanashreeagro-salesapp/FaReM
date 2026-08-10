from rest_framework import serializers
from .models import FieldVisit, VisitPhoto

class VisitPhotoSerializer(serializers.ModelSerializer):
    photo_url = serializers.CharField(max_length=2000)
    thumbnail_url = serializers.CharField(max_length=2000, required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = VisitPhoto
        fields = ['id', 'visit', 'photo_url', 'thumbnail_url', 'created_at']
        read_only_fields = ['id', 'created_at']

class FieldVisitSerializer(serializers.ModelSerializer):
    photos = VisitPhotoSerializer(many=True, read_only=True)
    farmer_name = serializers.CharField(source='farmer.full_name', read_only=True)
    farmer_mobile = serializers.CharField(source='farmer.primary_mobile', read_only=True)
    farmer_village = serializers.CharField(source='farmer.village', read_only=True)
    staff_name = serializers.SerializerMethodField()
    plot_name = serializers.CharField(source='plot.plot_name', read_only=True, default=None)

    class Meta:
        model = FieldVisit
        fields = [
            'id', 'farmer', 'farmer_name', 'farmer_mobile', 'farmer_village',
            'plot', 'plot_name', 'staff', 'staff_name', 'purpose', 'notes', 'status',
            'check_in_time', 'check_out_time', 'duration_minutes', 'latitude', 'longitude',
            'gps_accuracy', 'distance_from_plot', 'inside_radius', 'photo_count',
            'photos', 'created_at', 'updated_at', 'created_by'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_staff_name(self, obj):
        if obj.staff:
            name = f"{obj.staff.first_name} {obj.staff.last_name}".strip()
            return name if name else obj.staff.email
        return None
