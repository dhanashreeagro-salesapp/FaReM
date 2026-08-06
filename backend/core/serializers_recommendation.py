from rest_framework import serializers
from .models import Recommendation, RecommendationMessage

class RecommendationMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecommendationMessage
        fields = ['id', 'recommendation', 'channel', 'status', 'sent_time', 'content', 'delivery_status', 'created_at']
        read_only_fields = ['id', 'created_at']

class RecommendationSerializer(serializers.ModelSerializer):
    messages = RecommendationMessageSerializer(many=True, read_only=True)
    farmer_name = serializers.CharField(source='farmer.full_name', read_only=True)
    farmer_mobile = serializers.CharField(source='farmer.primary_mobile', read_only=True)
    crop_name = serializers.CharField(source='crop.crop_name', read_only=True, default=None)
    stage_name = serializers.CharField(source='stage.stage_name', read_only=True, default=None)
    product_title = serializers.CharField(source='product.name', read_only=True, default=None)
    created_by_name = serializers.SerializerMethodField()
    channel = serializers.CharField(required=False, default='Internal', allow_blank=True, allow_null=True)

    class Meta:

        model = Recommendation
        fields = [
            'id', 'farmer', 'farmer_name', 'farmer_mobile', 'plot', 'created_by_user', 'created_by_name',
            'crop', 'crop_name', 'stage', 'stage_name', 'product', 'product_name', 'product_title',
            'dose', 'dose_unit', 'timing', 'application_method', 'notes', 'priority', 'review_status',
            'manager_comment', 'channel', 'send_status', 'timestamp', 'updated_at', 'messages'
        ]
        read_only_fields = ['id', 'timestamp', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by_user:
            name = f"{obj.created_by_user.first_name} {obj.created_by_user.last_name}".strip()
            return name if name else obj.created_by_user.email
        return None
