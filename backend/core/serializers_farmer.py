from rest_framework import serializers
from .models import Farmer

class FarmerSerializer(serializers.ModelSerializer):
    assigned_staff_mobile = serializers.CharField(source='assigned_staff.mobile_number', read_only=True, default=None)

    class Meta:
        model = Farmer
        fields = ['id', 'full_name', 'primary_mobile', 'alternate_mobile', 'email', 'village', 'taluka', 'district', 
                  'pin_code', 'state', 'preferred_language', 'land_holding_acres', 'farmer_photo', 
                  'assigned_staff', 'assigned_staff_mobile', 'territory', 'source', 'acquisition_date', 'status', 'date_added']
