from django.db.models import Count, Q, Max
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.core.cache import cache
from .models import Farmer, User, ActivityLog, FieldVisit, CallLog, Role, Plot, CropSeason, Recommendation

from django.http import HttpResponse

class DashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # Always calculate real-time aggregate metrics
        data = {}
        farmers = Farmer.objects.exclude(status__iexact='Inactive')
        activities = ActivityLog.objects.all()
        
        if user.role not in [Role.ADMIN, Role.CONTENT_TEAM]:
            team_users = user.get_team_users()
            team_user_ids = [u.id for u in team_users]

            data['debug_user_email'] = user.email
            data['debug_user_role'] = user.role
            data['debug_user_id'] = str(user.id)
            data['debug_team_emails'] = [u.email for u in team_users]
            data['debug_subordinates_count'] = len(team_users) - 1

            from django.core.cache import cache
            cache_key = 'territory_children_map'
            children_map = cache.get(cache_key)
            if children_map is None:
                from .models import Territory
                all_territories = Territory.objects.exclude(status__iexact='Inactive').values_list('id', 'parent_territory_id')
                children_map = {}
                for t_id, p_id in all_territories:
                    if p_id not in children_map:
                        children_map[p_id] = []
                    children_map[p_id].append(t_id)
                cache.set(cache_key, children_map, 60)

            root_t_ids = []
            if user.territory_id:
                root_t_ids.append(user.territory_id)
            root_t_ids.extend(list(user.managed_territories.values_list('id', flat=True)))

            visited_t = set()
            t_queue = root_t_ids
            while t_queue:
                curr_t_id = t_queue.pop(0)
                if curr_t_id in visited_t:
                    continue
                visited_t.add(curr_t_id)
                children_ids = children_map.get(curr_t_id, [])
                t_queue.extend(children_ids)

            q_filter = Q(assigned_staff_id__in=team_user_ids)
            if visited_t:
                q_filter |= Q(territory_id__in=visited_t)

            farmers = farmers.filter(q_filter)
        else:
            team_users = User.objects.all()

        # Evaluate farmer IDs once into list for fast indexed lookups
        farmer_ids = list(farmers.values_list('id', flat=True))

        data['debug_trace'] = {
            'user_id': str(user.id),
            'email': user.email,
            'role': user.role,
            'db_total_farmers_all': Farmer.objects.count(),
            'db_active_farmers_all': Farmer.objects.exclude(status__iexact='Inactive').count(),
            'team_users_count': len(team_users) if user.role not in [Role.ADMIN, Role.CONTENT_TEAM] else 'ALL',
            'filtered_farmers_count': len(farmer_ids),
        }

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

        data['total_farmers'] = len(farmer_ids)

        # We will retrieve total_visits later
        data['total_calls'] = CallLog.objects.filter(farmer_id__in=farmer_ids).count()
        
        # Monthly / YTD farmer counts using acquisition_date
        try:
            farmer_stats = Farmer.objects.filter(id__in=farmer_ids).aggregate(
                this_month=Count('id', filter=Q(acquisition_date__gte=first_day_this_month)),
                last_month=Count('id', filter=Q(acquisition_date__gte=first_day_last_month, acquisition_date__lte=last_day_last_month)),
                ytd=Count('id', filter=Q(acquisition_date__gte=fy_start))
            )
            data['this_month_farmers'] = farmer_stats['this_month'] or 0
            data['last_month_farmers'] = farmer_stats['last_month'] or 0
            data['ytd_farmers'] = farmer_stats['ytd'] or 0
        except Exception:
            data['this_month_farmers'] = Farmer.objects.filter(id__in=farmer_ids, acquisition_date__gte=first_day_this_month).count()
            data['last_month_farmers'] = Farmer.objects.filter(id__in=farmer_ids, acquisition_date__gte=first_day_last_month, acquisition_date__lte=last_day_last_month).count()
            data['ytd_farmers'] = Farmer.objects.filter(id__in=farmer_ids, acquisition_date__gte=fy_start).count()
        
        # Breakdown by village
        village_data = Farmer.objects.filter(id__in=farmer_ids).exclude(village='').exclude(village__isnull=True).values('village').annotate(count=Count('id')).order_by('-count')[:5]
        data['top_villages'] = list(village_data)

        # Overdue Visits calculation — pure in-memory set difference (0.001s)
        try:
            from .models import AppConfiguration
            config = AppConfiguration.get_config()
            threshold_days = getattr(config, 'visit_frequency_norm_days', 30) or 30
            cutoff_date = today_date - datetime.timedelta(days=threshold_days)

            visit_agg = FieldVisit.objects.filter(farmer_id__in=farmer_ids).aggregate(
                total_visits=Count('id'),
                recent_farmers=Count('farmer_id', distinct=True, filter=Q(created_at__gte=cutoff_date))
            )
            data['total_visits'] = visit_agg['total_visits'] or 0
            overdue_count = max(0, len(farmer_ids) - (visit_agg['recent_farmers'] or 0))
        except Exception:
            overdue_count = len(farmer_ids)

        data['overdue_visits'] = overdue_count
        
        from .models import Plot, CropSeason, CropStage
        from collections import defaultdict

        data['total_plots'] = Plot.objects.filter(farmer_id__in=farmer_ids, is_active=True).count()
        
        # Select only required fields to avoid downloading massive image payloads from CropMaster
        active_seasons = list(
            CropSeason.objects.filter(plot__farmer_id__in=farmer_ids, plot__is_active=True, status='Active')
            .values('crop_id', 'crop__crop_name', 'current_stage__stage_name', 'sowing_date')
        )
        data['active_crop_seasons'] = len(set(s['crop_id'] for s in active_seasons if s.get('crop_id')))

        # Pre-fetch all crop stages in 1 single query to eliminate N+1 loop queries
        all_crop_stages = CropStage.objects.all().order_by('crop_id', 'sequence_number')
        crop_stages_map = defaultdict(list)
        for st in all_crop_stages:
            crop_stages_map[st.crop_id].append(st)

        stage_breakup = {}
        active_crop_ids = set()

        for season in active_seasons:
            try:
                if not season.get('crop_id'):
                    continue
                crop_name = season['crop__crop_name']
                active_crop_ids.add(season['crop_id'])
                
                # Use already-assigned current_stage if available, else infer from in-memory stages
                if season.get('current_stage__stage_name'):
                    stage_name = season['current_stage__stage_name']
                elif season.get('sowing_date'):
                    days_since_sowing = (today_date - season['sowing_date']).days
                    stage_name = 'Unknown'
                    if days_since_sowing >= 0:
                        accumulated_days = 0
                        stages = crop_stages_map.get(season['crop_id'], [])
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

        # ------------------------------------------------------------------ #
        # Market Trends — reads from MarketPriceRecord (populated by imports).
        # Trend is anchored to each crop's own latest date (not today's date).
        # Perf: bulk queries + cache (see core/market_trends.py) instead of
        # 2 aggregate queries per crop.
        # ------------------------------------------------------------------ #
        market_trends = []
        if active_crop_ids:
            from .market_trends import get_dashboard_market_trends
            crop_name_map = {s['crop_id']: s['crop__crop_name'] for s in active_seasons if s.get('crop_id')}
            market_trends = get_dashboard_market_trends(list(active_crop_ids), crop_name_map)

        data['market_trends'] = market_trends

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

        import datetime
        from collections import defaultdict
        from django.utils import timezone
        from django.db.models import Count, Q
        from .models import FieldVisit, AppConfiguration

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

        config = AppConfiguration.get_config()
        threshold_days = getattr(config, 'visit_frequency_norm_days', 30) or 30
        cutoff_date = timezone.now() - datetime.timedelta(days=threshold_days)

        # 1. Farmers per staff with acquisition date
        staff_farmer_ids = defaultdict(list)
        for f_id, s_id, acq in Farmer.objects.exclude(status__iexact='Inactive').values_list('id', 'assigned_staff_id', 'acquisition_date'):
            if s_id:
                staff_farmer_ids[s_id].append((f_id, acq))

        farmer_counts = {s_id: len(f_list) for s_id, f_list in staff_farmer_ids.items()}

        # 2. Farmers added this month, last month, this year
        farmers_month_counts = {}
        farmers_last_month_counts = {}
        farmers_year_counts = {}
        for s_id, f_list in staff_farmer_ids.items():
            farmers_month_counts[s_id] = sum(1 for _, acq in f_list if acq and acq >= first_day_this_month)
            farmers_last_month_counts[s_id] = sum(1 for _, acq in f_list if acq and first_day_last_month <= acq <= last_day_last_month)
            farmers_year_counts[s_id] = sum(1 for _, acq in f_list if acq and acq >= fy_start)

        # 3. Recent visited farmer IDs for overdue calculation
        recent_visited_farmer_ids = set(
            FieldVisit.objects.filter(check_in_time__gte=cutoff_date).values_list('farmer_id', flat=True)
        )

        # 4. Overdue counts per staff
        overdue_counts = {}
        for s_id, f_list in staff_farmer_ids.items():
            overdue_counts[s_id] = sum(1 for f_id, _ in f_list if f_id not in recent_visited_farmer_ids)

        # 5. Visits counts (FieldVisit + ActivityLog)
        fv_counts = dict(FieldVisit.objects.values('staff_id').annotate(c=Count('id')).values_list('staff_id', 'c'))
        act_counts = dict(ActivityLog.objects.filter(activity_type='Visit').values('logged_by_user_id').annotate(c=Count('id')).values_list('logged_by_user_id', 'c'))
        visits_counts = defaultdict(int)
        for k, v in fv_counts.items():
            visits_counts[k] = max(visits_counts[k], v)
        for k, v in act_counts.items():
            visits_counts[k] = max(visits_counts[k], v)

        # 6. Crops count per staff
        crop_counts = dict(
            CropSeason.objects.filter(status='Active')
            .exclude(plot__farmer__status__iexact='Inactive')
            .values('plot__farmer__assigned_staff_id')
            .annotate(c=Count('crop_id', distinct=True))
            .values_list('plot__farmer__assigned_staff_id', 'c')
        )

        # 7. Other pre-aggregations
        plot_counts = dict(Plot.objects.filter(is_active=True).exclude(farmer__status__iexact='Inactive').values('farmer__assigned_staff_id').annotate(c=Count('id')).values_list('farmer__assigned_staff_id', 'c'))
        recs_counts = dict(Recommendation.objects.values('created_by_user_id').annotate(c=Count('id')).values_list('created_by_user_id', 'c'))
        wa_counts = dict(Recommendation.objects.filter(channel='WhatsApp').values('created_by_user_id').annotate(c=Count('id')).values_list('created_by_user_id', 'c'))
        calls_counts = dict(ActivityLog.objects.filter(activity_type='Call').values('logged_by_user_id').annotate(c=Count('id')).values_list('logged_by_user_id', 'c'))

        all_active_users = list(User.objects.exclude(status__iexact='Inactive').select_related('territory'))
        children_by_manager = defaultdict(list)
        for u in all_active_users:
            if u.reporting_manager_id:
                children_by_manager[u.reporting_manager_id].append(u)

        def build_user_tree(u):
            subordinates = children_by_manager.get(u.id, [])
            sub_nodes = [build_user_tree(sub) for sub in subordinates]

            direct_farmer_count = farmer_counts.get(u.id, 0)
            direct_plot_count = plot_counts.get(u.id, 0)
            direct_crop_count = crop_counts.get(u.id, 0)
            direct_visits_count = visits_counts.get(u.id, 0)
            direct_overdue_count = overdue_counts.get(u.id, 0)
            direct_added_month = farmers_month_counts.get(u.id, 0)
            direct_added_last_month = farmers_last_month_counts.get(u.id, 0)
            direct_added_year = farmers_year_counts.get(u.id, 0)

            recs_count = recs_counts.get(u.id, 0)
            calls_count = calls_counts.get(u.id, 0)
            whatsapp_count = wa_counts.get(u.id, 0)

            total_farmers = direct_farmer_count + sum(sub['farmer_count'] for sub in sub_nodes)
            total_plots = direct_plot_count + sum(sub['plot_count'] for sub in sub_nodes)
            total_crops = direct_crop_count + sum(sub['crop_count'] for sub in sub_nodes)
            total_visits = direct_visits_count + sum(sub['visits_count'] for sub in sub_nodes)
            total_overdue = direct_overdue_count + sum(sub['overdue_visits'] for sub in sub_nodes)
            total_added_month = direct_added_month + sum(sub['farmers_added_this_month'] for sub in sub_nodes)
            total_added_last_month = direct_added_last_month + sum(sub['farmers_added_last_month'] for sub in sub_nodes)
            total_added_year = direct_added_year + sum(sub['farmers_added_this_year'] for sub in sub_nodes)

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
                'crop_count': total_crops,
                'active_crops_count': total_crops,
                'visits_count': total_visits,
                'total_visits': total_visits,
                'overdue_visits': total_overdue,
                'overdue_count': total_overdue,
                'farmers_added_this_month': total_added_month,
                'this_month_farmers': total_added_month,
                'farmers_added_last_month': total_added_last_month,
                'last_month_farmers': total_added_last_month,
                'farmers_added_this_year': total_added_year,
                'ytd_farmers': total_added_year,
                'direct_farmer_count': direct_farmer_count,
                'direct_crop_count': direct_crop_count,
                'direct_visits_count': direct_visits_count,
                'direct_overdue_visits': direct_overdue_count,
                'direct_farmers_added_this_month': direct_added_month,
                'direct_farmers_added_last_month': direct_added_last_month,
                'direct_farmers_added_this_year': direct_added_year,
                'plot_count': total_plots,
                'plots_count': total_plots,
                'recommendations_count': total_recs,
                'calls_count': total_calls,
                'whatsapp_count': total_wa,
                'performance_pct': perf_pct,
                'last_sync': u.last_login.strftime('%Y-%m-%d %H:%M') if u.last_login else 'Active Today',
                'subordinates': sub_nodes,
                'subordinates_count': len(sub_nodes)
            }

        # Find top roots: for Admin, show organization roots. For others, show logged in user and subtree.
        if user.role == Role.ADMIN:
            top_users = list(User.objects.filter(reporting_manager__isnull=True, status='Active').order_by('first_name'))
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

class OverdueVisitsAPIView(APIView):
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

        from .models import AppConfiguration, FieldVisit, CropSeason
        import datetime
        from django.utils import timezone
        from django.db.models import Max
        config = AppConfiguration.get_config()
        threshold_days = getattr(config, 'visit_frequency_norm_days', 30) or 30
        cutoff_date = timezone.now().date() - datetime.timedelta(days=threshold_days)

        recent_visited_farmer_ids = set(FieldVisit.objects.filter(
            farmer__in=farmers, created_at__gte=cutoff_date
        ).values_list('farmer_id', flat=True))

        overdue_farmers = farmers.exclude(id__in=recent_visited_farmer_ids)
        
        results = []
        last_visits = dict(
            FieldVisit.objects.filter(farmer__in=overdue_farmers)
            .values('farmer_id')
            .annotate(max_date=Max('created_at'))
            .values_list('farmer_id', 'max_date')
        )
        
        today = timezone.now().date()

        for farmer in overdue_farmers:
            last_visit_date = last_visits.get(farmer.id)
            if last_visit_date:
                overdue_days = (today - last_visit_date.date()).days
            else:
                overdue_days = (today - farmer.date_added.date()).days if farmer.date_added else threshold_days

            active_seasons = CropSeason.objects.filter(
                plot__farmer=farmer, plot__is_active=True, status='Active'
            ).select_related('crop', 'current_stage', 'plot')
            
            if not active_seasons.exists():
                results.append({
                    'id': f"{farmer.id}_nocrop",
                    'farmer_name': farmer.full_name,
                    'farmer_id': str(farmer.id),
                    'village': farmer.village,
                    'district': farmer.district,
                    'crop_name': 'N/A',
                    'crop_stage': 'N/A',
                    'farmer_score': getattr(farmer, 'score', 0),
                    'acreage': 0,
                    'overdue_days': overdue_days
                })
            else:
                for season in active_seasons:
                    results.append({
                        'id': str(season.id),
                        'farmer_name': farmer.full_name,
                        'farmer_id': str(farmer.id),
                        'village': farmer.village,
                        'district': farmer.district,
                        'crop_name': season.crop.crop_name if season.crop else 'General',
                        'crop_stage': season.current_stage.stage_name if season.current_stage else 'Active',
                        'farmer_score': getattr(farmer, 'score', 0),
                        'acreage': float(season.area_acres or season.plot.area_acres or 0),
                        'overdue_days': overdue_days
                    })
                    
        return Response(results)

