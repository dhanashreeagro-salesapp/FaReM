from rest_framework import serializers
from .models import CropMaster, CropVariety, CropStage

class CropVarietySerializer(serializers.ModelSerializer):
    class Meta:
        model = CropVariety
        fields = '__all__'

class CropStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CropStage
        fields = '__all__'

import base64

class CropMasterSerializer(serializers.ModelSerializer):
    varieties = CropVarietySerializer(many=True, read_only=True)
    stages = CropStageSerializer(many=True, read_only=True)
    
    reference_image = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = CropMaster
        fields = '__all__'

    def to_internal_value(self, data):
        # Handle file uploads and convert to base64
        request = self.context.get('request')
        if request and request.FILES and 'reference_image' in request.FILES:
            file_obj = request.FILES['reference_image']
            encoded = base64.b64encode(file_obj.read()).decode('utf-8')
            mime_type = getattr(file_obj, 'content_type', 'image/jpeg')
            
            # data might be immutable (QueryDict)
            if hasattr(data, 'copy'):
                data = data.copy()
            data['reference_image'] = f"data:{mime_type};base64,{encoded}"
            
        return super().to_internal_value(data)
