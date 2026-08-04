from rest_framework import serializers
from .models import Farmer

class FarmerSerializer(serializers.ModelSerializer):
    assigned_staff_mobile = serializers.CharField(source='assigned_staff.mobile_number', read_only=True, default=None)
    assigned_staff_email = serializers.CharField(source='assigned_staff.email', read_only=True, default=None)
    assigned_staff_name = serializers.SerializerMethodField()

    class Meta:
        model = Farmer
        fields = ['id', 'full_name', 'primary_mobile', 'alternate_mobile', 'email', 'village', 'taluka', 'district', 
                  'pin_code', 'state', 'preferred_language', 'land_holding_acres', 'farmer_photo', 
                  'assigned_staff', 'assigned_staff_name', 'assigned_staff_mobile', 'assigned_staff_email',
                  'territory', 'source', 'acquisition_date', 'status', 'date_added']

    def get_assigned_staff_name(self, obj):
        if obj.assigned_staff:
            name = f"{obj.assigned_staff.first_name} {obj.assigned_staff.last_name}".strip()
            return name if name else obj.assigned_staff.email
        return None

