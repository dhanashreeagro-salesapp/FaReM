from rest_framework import serializers
from .models import CallLog

class CallLogSerializer(serializers.ModelSerializer):
    farmer_name = serializers.CharField(source='farmer.full_name', read_only=True)
    farmer_mobile = serializers.CharField(source='farmer.primary_mobile', read_only=True)
    staff_name = serializers.SerializerMethodField()

    class Meta:
        model = CallLog
        fields = [
            'id', 'farmer', 'farmer_name', 'farmer_mobile', 'staff', 'staff_name',
            'direction', 'call_time', 'duration', 'outcome', 'notes', 'next_action',
            'followup_date', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_staff_name(self, obj):
        if obj.staff:
            name = f"{obj.staff.first_name} {obj.staff.last_name}".strip()
            return name if name else obj.staff.email
        return None
