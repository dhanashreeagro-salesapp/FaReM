from rest_framework import viewsets, views, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Sum, F, Q, Max, Prefetch
from django.utils import timezone
from datetime import timedelta
import pandas as pd

from core.models import (
    MarketPriceImportBatch, MarketPriceRecord, CropMaster, User, Role,
    CropSeason, Plot, Farmer
)
from core.serializers_market import MarketPriceImportBatchSerializer, MarketTrendSerializer
from core.permissions import IsAdminUser

class MarketDataImportView(views.APIView):
    """
    API View to upload and import Market Data Excel files.
    Accessible only to Admins.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        if request.user.role != Role.ADMIN:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            df = pd.read_excel(file)
            batch = MarketPriceImportBatch.objects.create(
                imported_by=request.user,
                filename=file.name
            )
            
            records_created = 0
            for index, row in df.iterrows():
                commodity_name = str(row.get('Commodity', '')).strip()
                market_name = str(row.get('Market', '')).strip()
                date_val = row.get('Date')
                modal_price = row.get('Modal Price')
                
                if not commodity_name or not market_name or pd.isna(date_val) or pd.isna(modal_price):
                    continue
                
                # Match crop if exists
                crop = CropMaster.objects.filter(crop_name__iexact=commodity_name).first()
                
                MarketPriceRecord.objects.update_or_create(
                    date=date_val,
                    market_name=market_name,
                    commodity_name=commodity_name,
                    defaults={
                        'import_batch': batch,
                        'crop': crop,
                        'modal_price': modal_price,
                        'min_price': row.get('Min Price') if not pd.isna(row.get('Min Price')) else None,
                        'max_price': row.get('Max Price') if not pd.isna(row.get('Max Price')) else None,
                    }
                )
                records_created += 1
                
            batch.records_processed = records_created
            batch.save()
            return Response({'message': f'Successfully processed {records_created} records', 'batch_id': batch.id})
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MarketSnapshotView(views.APIView):
    """
    Returns Commodity Market Snapshot tailored to the logged-in user's assigned farmers' acreage.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        
        # 1. Calculate acreage per crop for the user's assigned farmers
        # Field Staff sees their own portfolio. Managers see their team's portfolio.
        users_to_query = user.get_team_users()
        
        # Find active crop seasons for these users, grouped by crop
        # Note: Added condition to ignore missing area_acres based on feedback
        acreage_qs = CropSeason.objects.filter(
            plot__farmer__assigned_staff__in=users_to_query,
            plot__is_active=True,
            plot__area_acres__isnull=False,
            status='Active'
        ).values('crop__crop_name').annotate(
            total_acres=Sum('plot__area_acres')
        ).order_by('-total_acres')
        
        top_crops = [item for item in acreage_qs if item['total_acres'] and item['total_acres'] > 0]
        
        results = []
        
        # 2. For each top crop, fetch latest market price and 7-day trend
        for c in top_crops[:10]: # Top 10 relevant
            crop_name = c['crop__crop_name']
            
            # Fetch latest record
            latest_record = MarketPriceRecord.objects.filter(commodity_name__iexact=crop_name).order_by('-date').first()
            if not latest_record:
                continue
                
            # Fetch 7 days prior record
            seven_days_ago = latest_record.date - timedelta(days=7)
            
            # Get nearest record around 7 days ago (+/- 2 days)
            prior_record = MarketPriceRecord.objects.filter(
                commodity_name__iexact=crop_name,
                market_name=latest_record.market_name,
                date__range=[seven_days_ago - timedelta(days=2), seven_days_ago + timedelta(days=2)]
            ).order_by('-date').first()
            
            change_pct = None
            if prior_record and prior_record.modal_price > 0:
                change_pct = ((latest_record.modal_price - prior_record.modal_price) / prior_record.modal_price) * 100
                
            results.append({
                'commodity_name': crop_name,
                'latest_price': latest_record.modal_price,
                'latest_date': latest_record.date,
                'price_7_days_ago': prior_record.modal_price if prior_record else None,
                'change_7_day_percent': change_pct,
                'total_managed_acreage': c['total_acres']
            })
            
        serializer = MarketTrendSerializer(results, many=True)
        return Response(serializer.data)
