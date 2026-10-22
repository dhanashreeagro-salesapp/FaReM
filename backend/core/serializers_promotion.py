from rest_framework import serializers
from .models import PromotionLibrary, CropMaster, CropStage, ProductMaster

class PromotionLibrarySerializer(serializers.ModelSerializer):
    product_names = serializers.SlugRelatedField(many=True, read_only=True, slug_field='name', source='related_products')
    crop_names = serializers.SerializerMethodField()
    stage_names = serializers.SerializerMethodField()
    crop_name = serializers.SerializerMethodField()
    stage_name = serializers.SerializerMethodField()

    class Meta:
        model = PromotionLibrary
        fields = '__all__'

    def get_crop_names(self, obj):
        return [c.crop_name for c in obj.crops.all()]

    def get_stage_names(self, obj):
        names = [s.stage_name for s in obj.stages.all()]
        if obj.target_stages:
            names.extend(obj.target_stages)
        return list(dict.fromkeys(names))

    def get_crop_name(self, obj):
        if obj.crop:
            return obj.crop.crop_name
        crops = obj.crops.all()
        return crops[0].crop_name if crops else None

    def get_stage_name(self, obj):
        if obj.stage:
            return obj.stage.stage_name
        stages = obj.stages.all()
        if stages:
            return stages[0].stage_name
        if obj.target_stages and len(obj.target_stages) > 0:
            return obj.target_stages[0]
        return None

    def create(self, validated_data):
        crops = validated_data.pop('crops', None)
        stages = validated_data.pop('stages', None)
        products = validated_data.pop('related_products', None)

        instance = super().create(validated_data)

        if crops is not None:
            instance.crops.set(crops)
            if not instance.crop and len(crops) > 0:
                instance.crop = crops[0]
        elif instance.crop:
            instance.crops.add(instance.crop)

        if stages is not None:
            instance.stages.set(stages)
            if not instance.stage and len(stages) > 0:
                instance.stage = stages[0]
        elif instance.stage:
            instance.stages.add(instance.stage)

        if products is not None:
            instance.related_products.set(products)

        instance.save()
        return instance

    def update(self, instance, validated_data):
        crops = validated_data.pop('crops', None)
        stages = validated_data.pop('stages', None)
        products = validated_data.pop('related_products', None)

        instance = super().update(instance, validated_data)

        if crops is not None:
            instance.crops.set(crops)
            instance.crop = crops[0] if len(crops) > 0 else None
        elif instance.crop and not instance.crops.filter(id=instance.crop.id).exists():
            instance.crops.add(instance.crop)

        if stages is not None:
            instance.stages.set(stages)
            instance.stage = stages[0] if len(stages) > 0 else None
        elif instance.stage and not instance.stages.filter(id=instance.stage.id).exists():
            instance.stages.add(instance.stage)

        if products is not None:
            instance.related_products.set(products)

        instance.save()
        return instance
