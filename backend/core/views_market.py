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
            xls = pd.ExcelFile(file)
            dfs = []
            for sheet_name in xls.sheet_names:
                df_sheet = pd.read_excel(xls, sheet_name=sheet_name)
                dfs.append(df_sheet)
            df = pd.concat(dfs, ignore_index=True)
            
            batch = MarketPriceImportBatch.objects.create(
                imported_by=request.user,
                filename=file.name
            )
            
            records_created = 0
            failed_rows = 0
            
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
                    def get_clean_str(key):
                        val = row.get(header_map.get(key, '_miss_'))
                        return '' if pd.isna(val) else str(val).strip()
                    
                    commodity_name = get_clean_str('commodity')
                    market_name = get_clean_str('market')
                    date_val = row.get(header_map.get('date', '_miss_'))
                    modal_price = row.get(header_map.get('modal', '_miss_'))

                    # Check required fields
                    if not commodity_name or commodity_name.lower() == 'nan' or commodity_name == 'None' or not market_name or market_name.lower() == 'nan' or market_name == 'None' or pd.isna(date_val) or pd.isna(modal_price):
                        if not first_row_error:
                            first_row_error = f"Row {index+1} missing required data: commodity='{commodity_name}', market='{market_name}', date='{date_val}', modal_price='{modal_price}'"
                        failed_rows += 1
                        continue

                    # Parse Date
                    try:
                        if isinstance(date_val, str):
                            parsed_date = pd.to_datetime(date_val, dayfirst=True).date()
                        else:
                            parsed_date = pd.to_datetime(date_val).date()
                    except Exception as date_e:
                        if not first_row_error: first_row_error = f"Row {index+1} invalid date format: '{date_val}' (Error: {str(date_e)})"
                        failed_rows += 1
                        continue

                    # Parse Prices securely (handling commas and spaces)
                    def parse_price(val):
                        if pd.isna(val) or str(val).strip().lower() == 'nan' or str(val) == '_miss_': return None
                        try:
                            # Strip commas and any whitespace
                            import re
                            val_str = str(val).replace(',', '').strip()
                            match = re.search(r'[-+]?\d*\.\d+|\d+', val_str)
                            if match:
                                return float(match.group())
                            return None
                        except: return None
                        
                    m_price = parse_price(modal_price)
                    if m_price is None:
                        if not first_row_error: first_row_error = f"Row {index+1} invalid numeric format for modal price: '{modal_price}'"
                        failed_rows += 1
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
                    failed_rows += 1
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
            msg = f'Successfully processed {records_created} rows out of a total {len(df)} rows.'
            if failed_rows > 0:
                msg += f' {failed_rows} rows were skipped due to errors. First error: {first_row_error}'
            return Response({'message': msg, 'batch_id': batch.id})
            
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



from rest_framework import views, permissions, status
from rest_framework.response import Response
from django.db.models import Sum, Avg, Max
from django.db.models.functions import TruncMonth
from datetime import timedelta
from django.utils import timezone
from core.models import MarketPriceRecord, CropMaster, CropSeason, Festival

class MarketSnapshotView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        users_to_query = user.get_team_users()
        
        target_crop_id = request.query_params.get('crop_id')

        # 1. Base Portfolio Logic (Lightweight)
        acreage_qs = CropSeason.objects.filter(
            plot__farmer__assigned_staff__in=users_to_query,
            plot__is_active=True,
            plot__area_acres__isnull=False,
            status='Active',
            crop__isnull=False
        ).values('crop_id', 'crop__crop_name', 'crop__reference_image').annotate(
            total_acres=Sum('plot__area_acres')
        ).order_by('-total_acres')
        
        portfolio_crops = []
        seen_crop_ids = set()
        
        for item in acreage_qs:
            if item['total_acres'] and item['total_acres'] > 0 and item['crop_id'] not in seen_crop_ids:
                img = item.get('crop__reference_image', '')
                img_url = None
                if img and str(img).startswith('data:image'):
                    img_url = f"/api/crops/{item['crop_id']}/image/"
                portfolio_crops.append({'crop_id': str(item['crop_id']), 'crop_name': item['crop__crop_name'], 'reference_image': img_url, 'total_acres': float(item['total_acres'])})
                seen_crop_ids.add(item['crop_id'])
                
        other_mapped_ids = MarketPriceRecord.objects.exclude(crop__isnull=True).values_list('crop_id', flat=True).distinct()
        for cid in other_mapped_ids:
            if cid not in seen_crop_ids:
                crop = CropMaster.objects.filter(id=cid).first()
                if crop:
                    img_url = None
                    if crop.reference_image and str(crop.reference_image).startswith('data:image'):
                        img_url = f"/api/crops/{crop.id}/image/"
                    portfolio_crops.append({'crop_id': str(crop.id), 'crop_name': crop.crop_name, 'reference_image': img_url, 'total_acres': 0})
                    seen_crop_ids.add(crop.id)
                    
        search_query = request.query_params.get('search', '').lower()
        if search_query:
            portfolio_crops = [pc for pc in portfolio_crops if search_query in pc['crop_name'].lower()]
            
        if not target_crop_id:
            # ONLY return lightweight overview when target_crop_id is absent
            cids = [pc['crop_id'] for pc in portfolio_crops]
            latest_dates_qs = MarketPriceRecord.objects.filter(crop_id__in=cids).values('crop_id').annotate(latest_date=Max('date'))
            latest_dates_map = {str(item['crop_id']): item['latest_date'] for item in latest_dates_qs}
            
            latest_records = []
            for cid_str, ldate in latest_dates_map.items():
                record = MarketPriceRecord.objects.filter(crop_id=cid_str, date=ldate).first()
                if record: latest_records.append(record)
                
            latest_map = {str(r.crop_id): r for r in latest_records}
            
            prior_records_map = {}
            for r in latest_records:
                seven_days_ago = r.date - timedelta(days=7)
                prior = MarketPriceRecord.objects.filter(crop_id=r.crop_id, market_name=r.market_name, date__range=[seven_days_ago - timedelta(days=3), seven_days_ago + timedelta(days=3)]).order_by('-date').first()
                if prior: prior_records_map[str(r.crop_id)] = prior

            for pc in portfolio_crops:
                cid = pc['crop_id']
                latest_record = latest_map.get(cid)
                if latest_record:
                    pc['commodity_name'] = pc['crop_name']
                    pc['modal_price'] = latest_record.modal_price
                    prior_record_1w = prior_records_map.get(cid)
                    if prior_record_1w and prior_record_1w.modal_price > 0:
                        pc['change_7_day_percent'] = round(((latest_record.modal_price - prior_record_1w.modal_price) / prior_record_1w.modal_price) * 100, 2)
                    else:
                        pc['change_7_day_percent'] = None
                else:
                    pc['commodity_name'] = pc['crop_name']
                    pc['modal_price'] = None
                    pc['change_7_day_percent'] = None
            return Response(portfolio_crops)

        # 2. Deep Intelligence Logic (Only for target_crop_id)
        p_crop = next((c for c in portfolio_crops if c['crop_id'] == target_crop_id), None)
        if not p_crop:
            return Response({'error': 'Crop not found or not in portfolio'}, status=404)

        crop_id = p_crop['crop_id']
        markets = list(MarketPriceRecord.objects.filter(crop_id=crop_id).values_list('market_name', flat=True).distinct())
        
        markets_data = {}
        global_latest = None
        
        for m in markets:
            latest_record = MarketPriceRecord.objects.filter(crop_id=crop_id, market_name=m).order_by('-date').first()
            if not latest_record: continue
            if not global_latest or latest_record.date > global_latest.date: global_latest = latest_record

            seven_days_ago = latest_record.date - timedelta(days=7)
            prior_record_1w = MarketPriceRecord.objects.filter(crop_id=crop_id, market_name=m, date__range=[seven_days_ago - timedelta(days=3), seven_days_ago + timedelta(days=3)]).order_by('-date').first()
            trend_1w = None
            if prior_record_1w and prior_record_1w.modal_price > 0:
                change = ((latest_record.modal_price - prior_record_1w.modal_price) / prior_record_1w.modal_price) * 100
                trend_1w = {'change_pct': round(change, 2), 'prior_price': prior_record_1w.modal_price, 'prior_date': prior_record_1w.date}

            one_month_ago = latest_record.date - timedelta(days=30)
            prior_record_1m = MarketPriceRecord.objects.filter(crop_id=crop_id, market_name=m, date__range=[one_month_ago - timedelta(days=5), one_month_ago + timedelta(days=5)]).order_by('-date').first()
            trend_1m = None
            if prior_record_1m and prior_record_1m.modal_price > 0:
                change = ((latest_record.modal_price - prior_record_1m.modal_price) / prior_record_1m.modal_price) * 100
                trend_1m = {'change_pct': round(change, 2), 'prior_price': prior_record_1m.modal_price, 'prior_date': prior_record_1m.date}
                
            same_month_date = latest_record.date - timedelta(days=365)
            sml_record = MarketPriceRecord.objects.filter(crop_id=crop_id, market_name=m, date__year=same_month_date.year, date__month=same_month_date.month).order_by('-date').first()
            sml = None
            if sml_record and sml_record.modal_price > 0:
                change = ((latest_record.modal_price - sml_record.modal_price) / sml_record.modal_price) * 100
                sml = {'change_pct': round(change, 2), 'prior_price': sml_record.modal_price, 'prior_date': sml_record.date}

            current_year = latest_record.date.year
            chart_raw = MarketPriceRecord.objects.filter(crop_id=crop_id, market_name=m, date__year__gte=current_year - 2).annotate(month=TruncMonth('date')).values('month').annotate(avg_modal=Avg('modal_price')).order_by('month')
            chart_data = {'months': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], 'current_year': [None]*12, 'last_year': [None]*12, 'two_years_ago': [None]*12, 'current_year_label': current_year, 'last_year_label': current_year - 1, 'two_years_ago_label': current_year - 2}
            for cr in chart_raw:
                if not cr['month']: continue
                y, month_idx = cr['month'].year, cr['month'].month - 1
                if y == current_year: chart_data['current_year'][month_idx] = round(cr['avg_modal'], 2)
                elif y == current_year - 1: chart_data['last_year'][month_idx] = round(cr['avg_modal'], 2)
                elif y == current_year - 2: chart_data['two_years_ago'][month_idx] = round(cr['avg_modal'], 2)

            markets_data[m] = {'latest_price': {'modal': latest_record.modal_price, 'high': latest_record.max_price, 'low': latest_record.min_price, 'date': latest_record.date}, 'trend_1_week': trend_1w, 'trend_1_month': trend_1m, 'sml': sml, 'chart_data': chart_data}

        festival_intel = []
        current_date_val = timezone.now().date()
        approaching_festivals = Festival.objects.filter(date__gte=current_date_val).order_by('date')[:5]
        
        for fest in approaching_festivals:
            fest_obs = {}
            has_sufficient_data = False
            for m in markets:
                # Look at same festival last year
                fest_last_year_date = fest.date - timedelta(days=365)
                before_record = MarketPriceRecord.objects.filter(crop_id=crop_id, market_name=m, date__range=[fest_last_year_date - timedelta(days=15), fest_last_year_date - timedelta(days=2)]).order_by('-date').first()
                during_record = MarketPriceRecord.objects.filter(crop_id=crop_id, market_name=m, date__range=[fest_last_year_date - timedelta(days=1), fest_last_year_date + timedelta(days=3)]).order_by('-date').first()
                after_record = MarketPriceRecord.objects.filter(crop_id=crop_id, market_name=m, date__range=[fest_last_year_date + timedelta(days=4), fest_last_year_date + timedelta(days=15)]).order_by('date').first()
                
                if before_record and during_record:
                    change = ((during_record.modal_price - before_record.modal_price) / before_record.modal_price) * 100
                    fest_obs[m] = {'price_before': before_record.modal_price, 'price_during': during_record.modal_price, 'price_after': after_record.modal_price if after_record else None, 'change_pct': round(change, 2)}
                    has_sufficient_data = True
            
            festival_intel.append({'festival_name': fest.name, 'date': fest.date, 'year': fest.year, 'observations': fest_obs if has_sufficient_data else {}})
        
        # Calculate YTD Average across markets (simple mean of modal prices this year)
        ytd_avg = MarketPriceRecord.objects.filter(crop_id=crop_id, date__year=global_latest.date.year if global_latest else current_year).aggregate(Avg('modal_price'))['modal_price__avg'] if global_latest else None
        
        # Calculate weekly supply snapshot
        supply_snapshot = None
        if global_latest:
            week_start = global_latest.date - timedelta(days=7)
            week_qs = MarketPriceRecord.objects.filter(crop_id=crop_id, date__range=[week_start, global_latest.date])
            aggs = week_qs.aggregate(Avg('modal_price'), Avg('min_price'), Avg('max_price'))
            # We don't have volume/arrivals in the schema currently, so we'll leave it out or hardcode if requested.
            supply_snapshot = {
                'modal': round(aggs['modal_price__avg'], 2) if aggs['modal_price__avg'] else None,
                'min': round(aggs['min_price__avg'], 2) if aggs['min_price__avg'] else None,
                'max': round(aggs['max_price__avg'], 2) if aggs['max_price__avg'] else None,
            }

        # Calculate global chart data for heatmap fallback
        current_year_global = global_latest.date.year if global_latest else timezone.now().date().year
        global_chart_raw = MarketPriceRecord.objects.filter(crop_id=crop_id, date__year__gte=current_year_global - 2).annotate(month=TruncMonth('date')).values('month').annotate(avg_modal=Avg('modal_price')).order_by('month')
        global_chart_data = {'months': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], 'current_year': [None]*12, 'last_year': [None]*12, 'two_years_ago': [None]*12, 'current_year_label': current_year_global, 'last_year_label': current_year_global - 1, 'two_years_ago_label': current_year_global - 2}
        for cr in global_chart_raw:
            if not cr['month']: continue
            y, month_idx = cr['month'].year, cr['month'].month - 1
            if y == current_year_global: global_chart_data['current_year'][month_idx] = round(cr['avg_modal'], 2)
            elif y == current_year_global - 1: global_chart_data['last_year'][month_idx] = round(cr['avg_modal'], 2)
            elif y == current_year_global - 2: global_chart_data['two_years_ago'][month_idx] = round(cr['avg_modal'], 2)

        response_data = {
            'crop_id': crop_id,
            'crop_name': p_crop['crop_name'],
            'total_acres': p_crop['total_acres'],
            'global_latest_date': global_latest.date if global_latest else None,
            'ytd_avg': round(ytd_avg, 2) if ytd_avg else None,
            'markets_data': markets_data,
            'global_chart_data': global_chart_data,
            'festival_intelligence': festival_intel,
            'supply_snapshot': supply_snapshot
        }
        
        return Response(response_data)

