from rest_framework import serializers
from .models import PromotionLibrary

class PromotionLibrarySerializer(serializers.ModelSerializer):
    product_names = serializers.SlugRelatedField(many=True, read_only=True, slug_field='name', source='related_products')
    crop_name = serializers.ReadOnlyField(source='crop.crop_name')
    stage_name = serializers.ReadOnlyField(source='stage.stage_name')

    class Meta:
        model = PromotionLibrary
        fields = '__all__'
