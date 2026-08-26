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
                try:
                    # Clean column names by stripping whitespace in case excel headers have spaces
                    clean_row = {str(k).strip(): v for k, v in row.items()}

                    commodity_name = str(clean_row.get('Commodity Name', '')).strip()
                    market_name = str(clean_row.get('Market', '')).strip()
                    date_val = clean_row.get('Date')
                    modal_price = clean_row.get('Modal ( Rs/q)')

                    # Check required fields
                    if not commodity_name or commodity_name.lower() == 'nan' or not market_name or market_name.lower() == 'nan' or pd.isna(date_val) or pd.isna(modal_price):
                        continue

                    # Parse Date
                    try:
                        if isinstance(date_val, str):
                            # Usually DD-MM-YYYY in India, or auto-parse
                            parsed_date = pd.to_datetime(date_val, dayfirst=True).date()
                        else:
                            parsed_date = pd.to_datetime(date_val).date()
                    except:
                        continue

                    # Parse Prices securely
                    def parse_price(val):
                        if pd.isna(val) or str(val).strip().lower() == 'nan': return None
                        try: return float(val)
                        except: return None
                        
                    m_price = parse_price(modal_price)
                    if m_price is None: continue

                    # Match crop if exists (Create one if doesn't exist? Requirements: "New commodities appearing in an upload automatically become available in the app... The system must handle this automatically")
                    # Ah! The requirement says automatic!
                    crop = CropMaster.objects.filter(crop_name__iexact=commodity_name).first()
                    if not crop:
                        # Auto-create basic CropMaster skeleton
                        crop = CropMaster.objects.create(crop_name=commodity_name, category='Other', is_active=True)
                    
                    MarketPriceRecord.objects.update_or_create(
                        date=parsed_date,
                        market_name=market_name,
                        commodity_name=commodity_name,
                        defaults={
                            'import_batch': batch,
                            'crop': crop,
                            'modal_price': m_price,
                            'min_price': parse_price(clean_row.get('Low (Rs/qt)')),
                            'max_price': parse_price(clean_row.get('High ( Rs/q)')),
                        }
                    )
                    records_created += 1
                except Exception as row_e:
                    print(f"Skipping row {index}: {row_e}")
                    pass
                
            batch.records_processed = records_created
            batch.status = 'Success'
            batch.save()
            return Response({'message': f'Successfully processed {records_created} records', 'batch_id': batch.id})
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MarketDataTemplateView(views.APIView):
    """
    Downloads structural template for Market Intelligence Upload
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        import pandas as pd
        from django.http import HttpResponse
        from io import BytesIO

        df = pd.DataFrame(columns=['Date', 'Country', 'State', 'District', 'Market', 'Commodity Name', 'Low (Rs/qt)', 'High ( Rs/q)', 'Modal ( Rs/q)'])
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="market_data_template.xlsx"'
        return response


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
