from rest_framework import serializers
from .models import User, Farmer, Plot, CropMaster, CropSeason, ActivityLog, Recommendation, BulkSendBatch, PromotionLibrary, Territory

# Basic User Serializer
class UserSerializer(serializers.ModelSerializer):
    territory_name = serializers.CharField(source='territory.name', read_only=True, default=None)
    reporting_manager_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'mobile_number', 'email', 'employee_id', 'salesapp_user_id', 'role', 'status',
                  'first_name', 'last_name', 'territory', 'territory_name',
                  'reporting_manager', 'reporting_manager_name', 'device_push_token']

        read_only_fields = ['id']

    def get_reporting_manager_name(self, obj):
        if obj.reporting_manager:
            return f"{obj.reporting_manager.first_name} {obj.reporting_manager.last_name}".strip()
        return None
