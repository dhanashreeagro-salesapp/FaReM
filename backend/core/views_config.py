from rest_framework import serializers, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import AppConfiguration
from .permissions import IsAdminUser


class AppConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppConfiguration
        fields = ['visit_frequency_norm_days', 'planner_refresh_hour', 'visit_radius_meters', 'gps_validation_mode',
                  'active_sms_provider', 'msg91_auth_key', 'stpl_api_url', 'stpl_api_key', 'stpl_sender_id', 
                  'interakt_api_key', 'interakt_template_name', 'cloudinary_url', 'content_admin_weekly_promotion_limit', 'updated_at']
        read_only_fields = ['updated_at']


class AppConfigurationView(APIView):
    """Singleton configuration endpoint — GET to read, PUT to update."""
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]

    def get(self, request):
        config = AppConfiguration.get_config()
        serializer = AppConfigurationSerializer(config)
        return Response(serializer.data)

    def put(self, request):
        config = AppConfiguration.get_config()
        serializer = AppConfigurationSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
