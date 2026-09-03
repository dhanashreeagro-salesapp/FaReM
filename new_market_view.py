
from rest_framework import views, permissions, status
from rest_framework.response import Response
from django.db.models import Sum, Avg
from django.db.models.functions import TruncMonth
from datetime import timedelta
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
        ).values('crop_id', 'crop__crop_name').annotate(
            total_acres=Sum('plot__area_acres')
        ).order_by('-total_acres')
        
        portfolio_crops = []
        seen_crop_ids = set()
        
        for item in acreage_qs:
            if item['total_acres'] and item['total_acres'] > 0 and item['crop_id'] not in seen_crop_ids:
                portfolio_crops.append({'crop_id': str(item['crop_id']), 'crop_name': item['crop__crop_name'], 'total_acres': float(item['total_acres'])})
                seen_crop_ids.add(item['crop_id'])
                
        other_mapped_ids = MarketPriceRecord.objects.exclude(crop__isnull=True).values_list('crop_id', flat=True).distinct()
        for cid in other_mapped_ids:
            if cid not in seen_crop_ids:
                crop = CropMaster.objects.filter(id=cid).first()
                if crop:
                    portfolio_crops.append({'crop_id': str(crop.id), 'crop_name': crop.crop_name, 'total_acres': 0})
                    seen_crop_ids.add(crop.id)
                    
        search_query = request.query_params.get('search', '').lower()
        if search_query:
            portfolio_crops = [pc for pc in portfolio_crops if search_query in pc['crop_name'].lower()]
            
        if not target_crop_id:
            # ONLY return lightweight overview when target_crop_id is absent
            for pc in portfolio_crops:
                cid = pc['crop_id']
                latest_record = MarketPriceRecord.objects.filter(crop_id=cid).order_by('-date').first()
                if latest_record:
                    # Provide lightweight latest price for Dashboard rendering
                    pc['commodity_name'] = pc['crop_name']
                    pc['modal_price'] = latest_record.modal_price
                    # simple 7-day trailing calc
                    seven_days_ago = latest_record.date - timedelta(days=7)
                    prior_record_1w = MarketPriceRecord.objects.filter(crop_id=cid, market_name=latest_record.market_name, date__range=[seven_days_ago - timedelta(days=3), seven_days_ago + timedelta(days=3)]).order_by('-date').first()
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
        if global_latest:
            recent_festivals = Festival.objects.filter(date__lte=global_latest.date + timedelta(days=90), date__gte=global_latest.date - timedelta(days=365*2)).order_by('-date')
            for fest in recent_festivals:
                fest_obs = {}
                has_sufficient_data = False
                for m in markets:
                    before_record = MarketPriceRecord.objects.filter(crop_id=crop_id, market_name=m, date__range=[fest.date - timedelta(days=15), fest.date - timedelta(days=2)]).order_by('-date').first()
                    during_record = MarketPriceRecord.objects.filter(crop_id=crop_id, market_name=m, date__range=[fest.date - timedelta(days=1), fest.date + timedelta(days=3)]).order_by('-date').first()
                    after_record = MarketPriceRecord.objects.filter(crop_id=crop_id, market_name=m, date__range=[fest.date + timedelta(days=4), fest.date + timedelta(days=15)]).order_by('date').first()
                    if before_record and during_record:
                        change = ((during_record.modal_price - before_record.modal_price) / before_record.modal_price) * 100
                        fest_obs[m] = {'price_before': before_record.modal_price, 'price_during': during_record.modal_price, 'price_after': after_record.modal_price if after_record else None, 'change_pct': round(change, 2)}
                        has_sufficient_data = True
                if has_sufficient_data:
                    festival_intel.append({'festival_name': fest.name, 'date': fest.date, 'year': fest.year, 'observations': fest_obs})
        
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

        response_data = {
            'crop_id': crop_id,
            'crop_name': p_crop['crop_name'],
            'total_acres': p_crop['total_acres'],
            'global_latest_date': global_latest.date if global_latest else None,
            'ytd_avg': round(ytd_avg, 2) if ytd_avg else None,
            'markets_data': markets_data,
            'festival_intelligence': festival_intel[:3],
            'supply_snapshot': supply_snapshot
        }
        
        return Response(response_data)

