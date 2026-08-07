import pandas as pd
from django.db.models import Count, Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.core.cache import cache
from .models import Farmer, User, ActivityLog, Role
from django.http import HttpResponse

class DashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        cache_key = f'dashboard_api_data_{user.id}'
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)
            
        # Basic aggregate data
        data = {}
        
        farmers = Farmer.objects.filter(status='Active')
        activities = ActivityLog.objects.all()
        
        if user.role == Role.TERRITORY_MANAGER:
            territories = []
            if user.territory:
                territories.extend(user.territory.get_all_sub_territories())
            for managed_territory in user.managed_territories.all():
                territories.extend(managed_territory.get_all_sub_territories())
            territories = list(set(territories))
            farmers = farmers.filter(territory__in=territories)
            activities = activities.filter(farmer__territory__in=territories)
        elif user.role == Role.FIELD_STAFF:
            farmers = farmers.filter(assigned_staff=user)
            activities = activities.filter(farmer__assigned_staff=user)
            
        data['total_farmers'] = farmers.count()
        data['total_visits'] = activities.filter(activity_type='Visit').count()
        data['total_calls'] = activities.filter(activity_type='Call').count()
        
        import datetime
        from django.utils import timezone
        
        today_date = timezone.now().date()
        first_day_this_month = today_date.replace(day=1)
        
        if today_date.month == 1:
            first_day_last_month = today_date.replace(year=today_date.year - 1, month=12, day=1)
        else:
            first_day_last_month = today_date.replace(month=today_date.month - 1, day=1)
            
        last_day_last_month = first_day_this_month - datetime.timedelta(days=1)

        if today_date.month >= 4:
            fy_start = today_date.replace(month=4, day=1)
        else:
            fy_start = today_date.replace(year=today_date.year - 1, month=4, day=1)
            
        data['this_month_farmers'] = farmers.filter(date_added__date__gte=first_day_this_month).count()
        data['last_month_farmers'] = farmers.filter(date_added__date__gte=first_day_last_month, date_added__date__lte=last_day_last_month).count()
        data['ytd_farmers'] = farmers.filter(date_added__date__gte=fy_start).count()
        
        # Breakdown by village
        village_data = farmers.exclude(village='').exclude(village__isnull=True).values('village').annotate(count=Count('id')).order_by('-count')[:5]
        data['top_villages'] = list(village_data)

        # Overdue Visits calculation — single query, no Python loop
        from django.utils import timezone
        from .models import AppConfiguration
        from django.db.models import Max, Subquery, OuterRef
        config = AppConfiguration.get_config()
        threshold_days = config.visit_frequency_norm_days
        cutoff_date = today_date - datetime.timedelta(days=threshold_days)

        # Get the most recent visit date per farmer
        last_visit_subq = ActivityLog.objects.filter(
            farmer=OuterRef('pk'), activity_type='Visit'
        ).order_by('-date').values('date')[:1]

        # Annotate each farmer with their last visit date, then filter overdue
        overdue_count = farmers.annotate(
            last_visit_date=Subquery(last_visit_subq)
        ).filter(
            Q(last_visit_date__lt=cutoff_date) | Q(last_visit_date__isnull=True)
        ).count()

        data['overdue_visits'] = overdue_count
        
        from .models import Plot, CropSeason
        data['total_plots'] = Plot.objects.filter(farmer__in=farmers, is_active=True).count()
        
        active_seasons = CropSeason.objects.filter(
            plot__farmer__in=farmers, plot__is_active=True, status='Active'
        ).select_related('crop', 'current_stage').prefetch_related('crop__stages')
        data['active_crop_seasons'] = active_seasons.count()

        stage_breakup = {}
        for season in active_seasons:
            if not season.crop: continue
            crop_name = season.crop.crop_name
            
            # Use already-assigned current_stage if available, else infer from days
            if season.current_stage:
                stage_name = season.current_stage.stage_name
            else:
                days_since_sowing = (today_date - season.sowing_date).days
                stage_name = 'Unknown'
                if days_since_sowing >= 0:
                    accumulated_days = 0
                    stages = sorted(season.crop.stages.all(), key=lambda s: s.sequence_number)
                    for stage in stages:
                        accumulated_days += stage.days_from_previous_stage
                        if days_since_sowing <= accumulated_days:
                            stage_name = stage.stage_name
                            break
                    else:
                        if stages:
                            stage_name = stages[-1].stage_name
                            
            if crop_name not in stage_breakup:
                stage_breakup[crop_name] = {}
            stage_breakup[crop_name][stage_name] = stage_breakup[crop_name].get(stage_name, 0) + 1
        
        data['crop_stage_breakup'] = stage_breakup

        # Market Trends logic
        from .models import MarketRate
        
        market_trends = []
        active_crop_ids = active_seasons.values_list('crop_id', flat=True).distinct()
        for crop_id in active_crop_ids:
            rates = list(MarketRate.objects.filter(crop_id=crop_id).order_by('-date')[:3])
            if rates:
                latest = rates[0]
                trend = 'FLAT'
                percentage_change = 0.0
                
                prev = None
                if len(rates) == 3:
                    prev = rates[2]
                elif len(rates) == 2:
                    prev = rates[1]
                    
                if prev and prev.avg_price and latest.avg_price and prev.avg_price > 0:
                    if latest.avg_price > prev.avg_price:
                        trend = 'UP'
                        percentage_change = float(((latest.avg_price - prev.avg_price) / prev.avg_price) * 100)
                    elif latest.avg_price < prev.avg_price:
                        trend = 'DOWN'
                        percentage_change = float(((prev.avg_price - latest.avg_price) / prev.avg_price) * 100)

                market_trends.append({
                    'crop_name': latest.crop.crop_name,
                    'latest_price': float(latest.avg_price) if latest.avg_price else 0,
                    'date': latest.date.isoformat(),
                    'trend': trend,
                    'percentage_change': round(percentage_change, 2)
                })
        data['market_trends'] = market_trends

        cache.set(cache_key, data, 60 * 15) # Cache for 15 minutes
        return Response(data)

class ActiveCropsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        farmers = Farmer.objects.filter(status='Active')
        
        if user.role == Role.TERRITORY_MANAGER:
            territories = []
            if user.territory:
                territories.extend(user.territory.get_all_sub_territories())
            for managed_territory in user.managed_territories.all():
                territories.extend(managed_territory.get_all_sub_territories())
            farmers = farmers.filter(territory__in=list(set(territories)))
        elif user.role == Role.FIELD_STAFF:
            farmers = farmers.filter(assigned_staff=user)

        from django.db.models import Subquery, OuterRef
        last_visit_subq = ActivityLog.objects.filter(
            farmer=OuterRef('plot__farmer__id'), activity_type='Visit'
        ).order_by('-date').values('date')[:1]

        active_seasons = CropSeason.objects.filter(
            plot__farmer__in=farmers, plot__is_active=True, status='Active'
        ).select_related('crop', 'current_stage', 'plot', 'plot__farmer').annotate(
            last_visit_date=Subquery(last_visit_subq)
        ).order_by('-sowing_date')

        results = []
        for season in active_seasons[:500]:
            farmer = season.plot.farmer
            rec_count = Recommendation.objects.filter(farmer=farmer).count()
            results.append({
                'id': str(season.id),
                'crop_name': season.crop.crop_name if season.crop else 'General Crop',
                'stage_name': season.current_stage.stage_name if season.current_stage else 'Growth Stage',
                'area_acres': float(season.area_acres or season.plot.area_acres or 0),
                'farmer_id': str(farmer.id),
                'farmer_name': farmer.full_name,
                'village': farmer.village,
                'plot_name': season.plot.plot_name,
                'mobile_number': farmer.primary_mobile,
                'last_visit_date': str(season.last_visit_date) if hasattr(season, 'last_visit_date') and season.last_visit_date else 'No Visits',
                'recommendation_count': rec_count
            })

        return Response(results)

class FarmerPlotsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        farmers = Farmer.objects.filter(status='Active')
        
        if user.role == Role.TERRITORY_MANAGER:
            territories = []
            if user.territory:
                territories.extend(user.territory.get_all_sub_territories())
            for managed_territory in user.managed_territories.all():
                territories.extend(managed_territory.get_all_sub_territories())
            farmers = farmers.filter(territory__in=list(set(territories)))
        elif user.role == Role.FIELD_STAFF:
            farmers = farmers.filter(assigned_staff=user)

        from .models import Plot
        plots = Plot.objects.filter(farmer__in=farmers, is_active=True).select_related('farmer').order_by('-id')

        results = []
        for p in plots[:500]:
            crop_count = p.seasons.filter(status='Active').count()
            results.append({
                'id': str(p.id),
                'plot_name': p.plot_name,
                'area_acres': float(p.area_acres or 0),
                'soil_type': p.soil_type or 'Normal',
                'irrigation_source': p.irrigation_source or 'Borewell',
                'farmer_id': str(p.farmer.id),
                'farmer_name': p.farmer.full_name,
                'village': p.farmer.village,
                'district': p.farmer.district,
                'active_crops_count': crop_count
            })

        return Response(results)

class HierarchyAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in [Role.ADMIN, Role.ZONAL_MANAGER, Role.TERRITORY_MANAGER]:
            return Response({"error": "Hierarchy tab restricted to Managers and Admin"}, status=status.HTTP_403_FORBIDDEN)

        from django.utils import timezone
        current_year = timezone.now().year

        def build_user_tree(u):
            subordinates = list(User.objects.filter(reporting_manager=u, status='Active'))
            sub_nodes = [build_user_tree(sub) for sub in subordinates]

            assigned_farmers = Farmer.objects.filter(assigned_staff=u, status='Active')
            farmer_count = assigned_farmers.count()
            plot_count = Plot.objects.filter(farmer__in=assigned_farmers, is_active=True).count()
            crop_count = CropSeason.objects.filter(plot__farmer__in=assigned_farmers, status='Active').count()
            farmers_this_year = assigned_farmers.filter(date_added__year=current_year).count()

            recs_count = Recommendation.objects.filter(created_by_user=u).count()
            visits_count = ActivityLog.objects.filter(logged_by_user=u, activity_type='Visit').count()
            calls_count = ActivityLog.objects.filter(logged_by_user=u, activity_type='Call').count()
            whatsapp_count = Recommendation.objects.filter(created_by_user=u, channel='WhatsApp').count()

            # Target completion percentage benchmark
            norm = 50
            perf_pct = min(100, round((visits_count / max(1, norm)) * 100, 1))

            first_n = u.first_name or ''
            last_n = u.last_name or ''
            full_name = f"{first_n} {last_n}".strip() if (first_n or last_n) else u.email

            return {
                'id': str(u.id),
                'full_name': full_name,
                'email': u.email,
                'role': u.role,
                'territory_name': u.territory.name if u.territory else 'General Region',
                'farmer_count': farmer_count,
                'plot_count': plot_count,
                'crop_count': crop_count,
                'farmers_added_this_year': farmers_this_year,
                'recommendations_count': recs_count,
                'visits_count': visits_count,
                'calls_count': calls_count,
                'whatsapp_count': whatsapp_count,
                'performance_pct': perf_pct,
                'last_sync': u.last_login.strftime('%Y-%m-%d %H:%M') if u.last_login else 'Active Today',
                'subordinates': sub_nodes
            }

        # Find top roots (Users with no reporting manager or top Admin/ZonalManager)
        if user.role == Role.ADMIN:
            top_users = list(User.objects.filter(reporting_manager__isnull=True, status='Active')[:10])
            if not top_users:
                top_users = [user]
        else:
            top_users = [user]

        tree_data = [build_user_tree(tu) for tu in top_users]
        return Response(tree_data)

class ExportReportAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in [Role.ADMIN, Role.ZONAL_MANAGER, Role.TERRITORY_MANAGER]:
            return Response(status=status.HTTP_403_FORBIDDEN)
            
        export_type = request.query_params.get('type', 'excel')
        report_data = []
        
        farmers = Farmer.objects.filter(status='Active')
        if user.role == Role.TERRITORY_MANAGER:
            farmers = farmers.filter(territory=user.territory)
            
        df = pd.DataFrame(list(farmers.values('id', 'full_name', 'primary_mobile', 'village', 'date_added')))
        
        if export_type == 'excel':
            response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response['Content-Disposition'] = 'attachment; filename=report.xlsx'
            df.to_excel(response, index=False)
            return response
        elif export_type == 'pdf':
            # Simplified for PDF export, usually done via reportlab
            response = HttpResponse(content_type='application/pdf')
            response['Content-Disposition'] = 'attachment; filename=report.pdf'
            # Just write text for implementation showcase
            response.write(b'Farmer Report PDF Content (Mock)')
            return response
            
        return Response({'error': 'Invalid type'}, status=status.HTTP_400_BAD_REQUEST)

