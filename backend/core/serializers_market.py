from rest_framework import serializers
from core.models import MarketPriceImportBatch, MarketPriceRecord, CropMaster

class MarketPriceImportBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketPriceImportBatch
        fields = '__all__'

class MarketPriceRecordSerializer(serializers.ModelSerializer):
    crop_name = serializers.CharField(source='crop.crop_name', read_only=True)
    class Meta:
        model = MarketPriceRecord
        fields = '__all__'

class MarketTrendSerializer(serializers.Serializer):
    commodity_name = serializers.CharField()
    latest_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    latest_date = serializers.DateField()
    price_7_days_ago = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    change_7_day_percent = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    trend_21_day = serializers.CharField(required=False)
    total_managed_acreage = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
