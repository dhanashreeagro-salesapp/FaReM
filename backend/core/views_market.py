from rest_framework import viewsets, views, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Sum, F, Q, Max, Prefetch
from django.utils import timezone
from datetime import timedelta
import pandas as pd

from core.models import (
    MarketPriceImportBatch, MarketPriceRecord, CropMaster, User, Role,
    CropSeason, Plot, Farmer, CommodityMapping
)
from core.serializers_market import MarketPriceImportBatchSerializer, MarketTrendSerializer
from core.permissions import IsAdminUser

class CommodityMappingView(views.APIView):
    """
    API for Administrators to manually rationalise uploaded commodity names (e.g. 'Pomegranet') 
    with existing system crops (e.g. 'Pomegranate').
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request, *args, **kwargs):
        # Fetch unmapped commodities
        mappings = CommodityMapping.objects.filter(crop__isnull=True).values('id', 'commodity_name', 'created_at')
        return Response(list(mappings))

    def post(self, request, *args, **kwargs):
        mapping_id = request.data.get('mapping_id')
        crop_id = request.data.get('crop_id')
        action = request.data.get('action') # 'link' or 'ignore'
        
        try:
            mapping = CommodityMapping.objects.get(id=mapping_id)
            
            if action == 'ignore':
                mapping.delete()
                # Optionally delete records if user chooses to completely ignore? We leave records with crop=None
                return Response({'message': 'Commodity mapping discarded'})
            
            crop = CropMaster.objects.get(id=crop_id)
            mapping.crop = crop
            mapping.save()
            
            # Retroactively link historically unmapped records
            MarketPriceRecord.objects.filter(commodity_name=mapping.commodity_name, crop__isnull=True).update(crop=crop)
            
            return Response({'message': 'Commodity successfully linked to Crop'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class MarketDataImportView(views.APIView):
    """
    API View to upload and import Market Data Excel files.
    Accessible only to Admins.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        if request.user.role not in [Role.ADMIN, Role.CONTENT_ADMIN]:
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
            
            # Map columns fuzzily to handle variable spaces/casing in headers
            header_map = {}
            for k in df.columns:
                k_clean = str(k).strip().lower().replace(' ', '').replace('(', '').replace(')', '').replace('/', '')
                if 'commodity' in k_clean or 'crop' in k_clean: header_map['commodity'] = k
                elif 'market' in k_clean: header_map['market'] = k
                elif 'date' in k_clean: header_map['date'] = k
                elif 'modal' in k_clean: header_map['modal'] = k
                elif 'low' in k_clean or 'min' in k_clean: header_map['low'] = k
                elif 'high' in k_clean or 'max' in k_clean: header_map['high'] = k

            first_row_error = None
            for index, row in df.iterrows():
                try:
                    commodity_name = str(row.get(header_map.get('commodity', '_miss_'), '')).strip()
                    market_name = str(row.get(header_map.get('market', '_miss_'), '')).strip()
                    date_val = row.get(header_map.get('date', '_miss_'))
                    modal_price = row.get(header_map.get('modal', '_miss_'))

                    # Check required fields
                    if not commodity_name or commodity_name.lower() == 'nan' or not market_name or market_name.lower() == 'nan' or pd.isna(date_val) or pd.isna(modal_price):
                        if not first_row_error:
                            first_row_error = f"Row {index+1} missing required data: commodity='{commodity_name}', market='{market_name}', date='{date_val}', modal_price='{modal_price}'"
                        continue

                    # Parse Date
                    try:
                        if isinstance(date_val, str):
                            parsed_date = pd.to_datetime(date_val, dayfirst=True).date()
                        else:
                            parsed_date = pd.to_datetime(date_val).date()
                    except Exception as date_e:
                        if not first_row_error: first_row_error = f"Row {index+1} invalid date format: '{date_val}' (Error: {str(date_e)})"
                        continue

                    # Parse Prices securely
                    def parse_price(val):
                        if pd.isna(val) or str(val).strip().lower() == 'nan' or val == '_miss_': return None
                        try: return float(val)
                        except: return None
                        
                    m_price = parse_price(modal_price)
                    if m_price is None:
                        if not first_row_error: first_row_error = f"Row {index+1} invalid numeric format for modal price: '{modal_price}'"
                        continue

                    # Match crop restrictively (no auto-creation)
                    crop_name_stripped = commodity_name.strip()
                    crop = CropMaster.objects.filter(crop_name__iexact=crop_name_stripped).first()
                    
                    if not crop:
                        # Fallback to CommodityMapping rationalization
                        mapping = CommodityMapping.objects.filter(commodity_name__iexact=crop_name_stripped).first()
                        if mapping and mapping.crop:
                            crop = mapping.crop
                        elif not mapping:
                            # Create unmapped placeholder for Admin rationalization screen
                            try:
                                CommodityMapping.objects.create(commodity_name=crop_name_stripped)
                            except Exception: # In case of concurrent duplicates
                                pass
                            
                    
                    MarketPriceRecord.objects.update_or_create(
                        date=parsed_date,
                        market_name=market_name,
                        commodity_name=crop_name_stripped,
                        defaults={
                            'import_batch': batch,
                            'crop': crop,
                            'modal_price': m_price,
                            'min_price': parse_price(row.get(header_map.get('low', '_miss_'))),
                            'max_price': parse_price(row.get(header_map.get('high', '_miss_'))),
                        }
                    )
                    records_created += 1
                except Exception as row_e:
                    if not first_row_error: first_row_error = f"Row {index+1} database insertion failure: {str(row_e)}"
                    continue

            if records_created == 0:
                batch.status = 'Failed'
                batch.save()
                
                missing = [key for key in ['commodity', 'market', 'date', 'modal'] if key not in header_map]
                error_msg = f"Failed to import any valid rows from a total of {len(df)} rows. "
                if missing:
                    error_msg += f"Could not securely map required columns: {missing}. Found Excel columns: {list(df.columns)}. "
                else:
                    error_msg += f"Columns mapped successfully, but parsing failed natively. First internal error: [{first_row_error}]"
                
                return Response({'error': error_msg}, status=400)
                
            batch.records_processed = records_created
            batch.status = 'Success'
            batch.save()
            
            # Explicitly return X of Y metric
            return Response({'message': f'Successfully processed {records_created} rows out of a total {len(df)} rows in the file', 'batch_id': batch.id})
            
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
        users_to_query = user.get_team_users()
        
        acreage_qs = CropSeason.objects.filter(
            plot__farmer__assigned_staff__in=users_to_query,
            plot__is_active=True,
            plot__area_acres__isnull=False,
            status='Active'
        ).values('crop__crop_name').annotate(
            total_acres=Sum('plot__area_acres')
        ).order_by('-total_acres')
        
        top_crops = [item['crop__crop_name'] for item in acreage_qs if item['total_acres'] and item['total_acres'] > 0]
        
        results = []
        
        # 2. Get the latest record for ALL distinct commodities we have data for
        recent_market_commodities = MarketPriceRecord.objects.values_list('commodity_name', flat=True).distinct()
        
        # We will process portfolio crops first, then others
        all_commodities_to_process = []
        # Add portfolio crops first
        for c in top_crops:
            if c in recent_market_commodities or MarketPriceRecord.objects.filter(commodity_name__iexact=c).exists():
                all_commodities_to_process.append(c)
                
        # Add the rest
        for c in recent_market_commodities:
            if c not in all_commodities_to_process:
                all_commodities_to_process.append(c)
                
        for crop_name in all_commodities_to_process[:20]: # Show up to 20
            latest_record = MarketPriceRecord.objects.filter(commodity_name__iexact=crop_name).order_by('-date').first()
            if not latest_record:
                continue
                
            seven_days_ago = latest_record.date - timedelta(days=7)
            
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
                'market_name': latest_record.market_name,
                'date': latest_record.date,
                'modal_price': latest_record.modal_price,
                'min_price': latest_record.min_price,
                'max_price': latest_record.max_price,
                'prior_price': prior_record.modal_price if prior_record else None,
                'change_7_day_percent': round(change_pct, 2) if change_pct is not None else None,
                'in_portfolio': crop_name in top_crops
            })
            
        return Response(results)
