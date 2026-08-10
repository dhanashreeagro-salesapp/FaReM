import pandas as pd
from django.db.models import Count, Q, Max
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.core.cache import cache
from .models import Farmer, User, ActivityLog, Role, Plot, CropSeason, Recommendation

from django.http import HttpResponse

class DashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        cache.clear()
        
        # Always calculate real-time aggregate metrics
        data = {}
        farmers = Farmer.objects.exclude(status__iexact='Inactive')
        activities = ActivityLog.objects.all()
        
        if user.role not in [Role.ADMIN, Role.CONTENT_TEAM]:
            team_users = user.get_team_users()
            data['debug_user_email'] = user.email
            data['debug_user_role'] = user.role
            data['debug_user_id'] = str(user.id)
            data['debug_team_emails'] = [u.email for u in team_users]
            data['debug_subordinates_count'] = user.subordinates.count()
            data['debug_direct_subs'] = [u.email for u in user.subordinates.all()]

            territories = []
            if user.territory:
                territories.extend(user.territory.get_all_sub_territories())
            for managed_territory in user.managed_territories.all():
                territories.extend(managed_territory.get_all_sub_territories())
            territories = list(set(territories))
            
            q_filter = Q(assigned_staff__in=team_users)
            if territories:
                q_filter |= Q(territory__in=territories)

            farmers = farmers.filter(q_filter)
            activities = activities.filter(farmer__in=farmers)
        else:
            team_users = User.objects.all()

        data['debug_trace'] = {
            'user_id': str(user.id),
            'email': user.email,
            'role': user.role,
            'db_total_farmers_all': Farmer.objects.count(),
            'db_active_farmers_all': Farmer.objects.exclude(status__iexact='Inactive').count(),
            'team_users_count': len(team_users) if user.role not in [Role.ADMIN, Role.CONTENT_TEAM] else 'ALL',
            'filtered_farmers_count': farmers.count(),
        }

            
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
            try:
                if not season.crop: continue
                crop_name = season.crop.crop_name
                
                # Use already-assigned current_stage if available, else infer from days
                if season.current_stage:
                    stage_name = season.current_stage.stage_name
                elif season.sowing_date:
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
                else:
                    stage_name = 'Active'
                                
                if crop_name not in stage_breakup:
                    stage_breakup[crop_name] = {}
                stage_breakup[crop_name][stage_name] = stage_breakup[crop_name].get(stage_name, 0) + 1
            except Exception:
                pass
        
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

        cache_key = f"dashboard_data_{user.id}"
        cache.set(cache_key, data, 60)
        return Response(data)


class ActiveCropsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        farmers = Farmer.objects.filter(status='Active')
        
        if user.role not in [Role.ADMIN, Role.CONTENT_TEAM]:
            team_users = user.get_team_users()
            territories = []
            if user.territory:
                territories.extend(user.territory.get_all_sub_territories())
            for managed_territory in user.managed_territories.all():
                territories.extend(managed_territory.get_all_sub_territories())
            territories = list(set(territories))
            if territories:
                farmers = farmers.filter(Q(assigned_staff__in=team_users) | Q(territory__in=territories))
            else:
                farmers = farmers.filter(assigned_staff__in=team_users)

        active_seasons = CropSeason.objects.filter(
            plot__farmer__in=farmers, plot__is_active=True, status='Active'
        ).select_related('crop', 'current_stage', 'plot', 'plot__farmer').order_by('-sowing_date')[:500]

        season_list = list(active_seasons)
        if not season_list:
            return Response([])

        farmer_ids = set(s.plot.farmer.id for s in season_list)

        # Bulk count recommendations per farmer in 1 query
        rec_counts = dict(
            Recommendation.objects.filter(farmer_id__in=farmer_ids)
            .values('farmer_id')
            .annotate(cnt=Count('id'))
            .values_list('farmer_id', 'cnt')
        )

        # Bulk fetch last visit date per farmer in 1 query
        last_visits = dict(
            ActivityLog.objects.filter(farmer_id__in=farmer_ids, activity_type='Visit')
            .values('farmer_id')
            .annotate(max_date=Max('date'))
            .values_list('farmer_id', 'max_date')
        )

        results = []
        for season in season_list:
            farmer = season.plot.farmer
            rec_count = rec_counts.get(farmer.id, 0)
            last_visit = last_visits.get(farmer.id)

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
                'last_visit_date': last_visit.strftime('%Y-%m-%d') if last_visit else 'No Visits',
                'recommendation_count': rec_count
            })

        return Response(results)


class FarmerPlotsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        farmers = Farmer.objects.filter(status='Active')
        
        if user.role not in [Role.ADMIN, Role.CONTENT_TEAM]:
            team_users = user.get_team_users()
            territories = []
            if user.territory:
                territories.extend(user.territory.get_all_sub_territories())
            for managed_territory in user.managed_territories.all():
                territories.extend(managed_territory.get_all_sub_territories())
            territories = list(set(territories))
            if territories:
                farmers = farmers.filter(Q(assigned_staff__in=team_users) | Q(territory__in=territories))
            else:
                farmers = farmers.filter(assigned_staff__in=team_users)

        from .models import Plot
        plots = Plot.objects.filter(farmer__in=farmers, is_active=True).select_related('farmer').order_by('-id')[:500]
        plot_list = list(plots)
        if not plot_list:
            return Response([])

        plot_ids = [p.id for p in plot_list]

        # Bulk count active crops per plot in 1 query
        crop_counts = dict(
            CropSeason.objects.filter(plot_id__in=plot_ids, status='Active')
            .values('plot_id')
            .annotate(cnt=Count('id'))
            .values_list('plot_id', 'cnt')
        )

        results = []
        for p in plot_list:
            crop_count = crop_counts.get(p.id, 0)
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
            subordinates = list(User.objects.filter(reporting_manager=u).exclude(status__iexact='Inactive'))
            sub_nodes = [build_user_tree(sub) for sub in subordinates]

            assigned_farmers = Farmer.objects.filter(assigned_staff=u).exclude(status__iexact='Inactive')
            direct_farmer_count = assigned_farmers.count()
            direct_plot_count = Plot.objects.filter(farmer__in=assigned_farmers, is_active=True).count()
            direct_crop_count = CropSeason.objects.filter(plot__farmer__in=assigned_farmers, status='Active').count()
            direct_farmers_this_year = assigned_farmers.filter(date_added__year=current_year).count()

            recs_count = Recommendation.objects.filter(created_by_user=u).count()
            visits_count = ActivityLog.objects.filter(logged_by_user=u, activity_type='Visit').count()
            calls_count = ActivityLog.objects.filter(logged_by_user=u, activity_type='Call').count()
            whatsapp_count = Recommendation.objects.filter(created_by_user=u, channel='WhatsApp').count()

            total_farmers = direct_farmer_count + sum(sub['farmer_count'] for sub in sub_nodes)
            total_plots = direct_plot_count + sum(sub['plot_count'] for sub in sub_nodes)
            total_crops = direct_crop_count + sum(sub['crop_count'] for sub in sub_nodes)
            total_added_ytd = direct_farmers_this_year + sum(sub['farmers_added_this_year'] for sub in sub_nodes)
            total_visits = visits_count + sum(sub['visits_count'] for sub in sub_nodes)
            total_calls = calls_count + sum(sub['calls_count'] for sub in sub_nodes)
            total_recs = recs_count + sum(sub['recommendations_count'] for sub in sub_nodes)
            total_wa = whatsapp_count + sum(sub['whatsapp_count'] for sub in sub_nodes)

            norm = 50
            perf_pct = min(100, round((total_visits / max(1, norm)) * 100, 1))

            first_n = u.first_name or ''
            last_n = u.last_name or ''
            full_name = f"{first_n} {last_n}".strip() if (first_n or last_n) else u.email

            return {
                'id': str(u.id),
                'name': full_name,
                'full_name': full_name,
                'email': u.email,
                'role': u.role,
                'territory_name': u.territory.name if u.territory else 'General Region',
                'farmer_count': total_farmers,
                'farmers_count': total_farmers,
                'plot_count': total_plots,
                'plots_count': total_plots,
                'crop_count': total_crops,
                'active_crops_count': total_crops,
                'farmers_added_this_year': total_added_ytd,
                'recommendations_count': total_recs,
                'visits_count': total_visits,
                'calls_count': total_calls,
                'whatsapp_count': total_wa,
                'performance_pct': perf_pct,
                'last_sync': u.last_login.strftime('%Y-%m-%d %H:%M') if u.last_login else 'Active Today',
                'subordinates': sub_nodes,
                'subordinates_count': len(sub_nodes)
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

from .permissions import IsAdminUser

class ExportReportAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

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

