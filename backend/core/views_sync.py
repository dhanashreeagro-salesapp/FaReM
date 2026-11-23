from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import FieldVisit, CallLog, Recommendation, RecommendationMessage, Farmer, Plot, User, SystemAuditLog, CropMaster, CropStage, CropSeason, MarketRate, Role
from django.db.models import Q
import uuid

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def offline_batch_sync_view(request):
    """
    Offline Batch Synchronization Endpoint.
    Receives batch arrays of offline-created farmers, plots, crop seasons, visits, call logs, and recommendations.
    Applies idempotent upsert (using client UUIDs) and saves records to database.
    """
    user = request.user
    farmers_data = request.data.get('farmers', [])
    plots_data = request.data.get('plots', [])
    crop_seasons_data = request.data.get('crop_seasons', [])
    visits_data = request.data.get('visits', [])
    calls_data = request.data.get('calls', [])
    recommendations_data = request.data.get('recommendations', [])

    synced_farmers = 0
    synced_plots = 0
    synced_seasons = 0
    synced_visits = 0
    synced_calls = 0
    synced_recommendations = 0
    errors = []

    # 1. Process Offline Farmers (if registered offline)
    for f_item in farmers_data:
        try:
            f_id = f_item.get('id')
            defaults = {
                'full_name': f_item.get('full_name', ''),
                'primary_mobile': f_item.get('primary_mobile', ''),
                'village': f_item.get('village', ''),
                'taluka': f_item.get('taluka', ''),
                'district': f_item.get('district', ''),
                'pin_code': f_item.get('pin_code', ''),
                'state': f_item.get('state', ''),
                'assigned_staff': user if not f_item.get('assigned_staff_id') else None,
                'source': f_item.get('source', 'Field Staff')
            }
            if f_id:
                farmer, created = Farmer.objects.update_or_create(id=f_id, defaults=defaults)
            else:
                farmer = Farmer.objects.create(**defaults)
            synced_farmers += 1
        except Exception as e:
            errors.append({"item": "farmer", "temp_id": f_item.get('id') or f_item.get('temp_id'), "error": str(e)})

    # 2. Process Offline Plots (idempotent upsert by client UUID)
    for p_item in plots_data:
        try:
            plot_id = p_item.get('id')
            farmer_id = p_item.get('farmer_id') or p_item.get('farmer')
            farmer = Farmer.objects.get(id=farmer_id)
            wkt = p_item.get('location_wkt')
            geom = None
            calc_area = None
            if wkt:
                from django.contrib.gis.geos import GEOSGeometry
                try:
                    geom = GEOSGeometry(wkt)
                    if geom.geom_type == 'Polygon':
                        geom_proj = geom.clone()
                        geom_proj.transform(3857)
                        calc_area = round(geom_proj.area * 0.000247105, 4)
                except Exception:
                    pass

            defaults = {
                'farmer': farmer,
                'plot_name': p_item.get('plot_name', 'Unnamed Plot'),
                'area_acres': p_item.get('area_acres') or None,
                'soil_type': p_item.get('soil_type', ''),
                'irrigation_source': p_item.get('irrigation_source', ''),
                'is_active': p_item.get('is_active', True)
            }
            if geom:
                defaults['location'] = geom
            if calc_area:
                defaults['calculated_area_acres'] = calc_area

            if plot_id:
                plot, created = Plot.objects.update_or_create(id=plot_id, defaults=defaults)
            else:
                plot = Plot.objects.create(**defaults)
            synced_plots += 1
        except Exception as e:
            errors.append({"item": "plot", "temp_id": p_item.get('id') or p_item.get('temp_id'), "error": str(e)})

    # 3. Process Offline Crop Seasons
    for s_item in crop_seasons_data:
        try:
            season_id = s_item.get('id')
            plot_id = s_item.get('plot_id') or s_item.get('plot')
            plot = Plot.objects.get(id=plot_id)
            crop_id = s_item.get('crop_id') or s_item.get('crop')
            crop = CropMaster.objects.get(id=crop_id)
            sowing_date_val = s_item.get('sowing_date') or timezone.now().date()

            defaults = {
                'plot': plot,
                'crop': crop,
                'variety_name': s_item.get('variety_name', ''),
                'area_acres': s_item.get('area_acres') or None,
                'sowing_date': sowing_date_val,
                'status': s_item.get('status', 'Active')
            }
            if season_id:
                season, created = CropSeason.objects.update_or_create(id=season_id, defaults=defaults)
            else:
                season = CropSeason.objects.create(**defaults)

            if not season.current_stage and season.sowing_date:
                stages = CropStage.objects.filter(crop=season.crop).order_by('sequence_number')
                cumulative_days = 0
                selected_stage = None
                days_since_sowing = (timezone.now().date() - season.sowing_date).days if hasattr(season.sowing_date, 'strftime') else 0
                for stage in stages:
                    cumulative_days += stage.days_from_previous_stage
                    if days_since_sowing <= cumulative_days:
                        selected_stage = stage
                        break
                if not selected_stage and stages.exists():
                    selected_stage = stages.last()
                if selected_stage:
                    season.current_stage = selected_stage
                    season.save(update_fields=['current_stage'])

            synced_seasons += 1
        except Exception as e:
            errors.append({"item": "crop_season", "temp_id": s_item.get('id') or s_item.get('temp_id'), "error": str(e)})

    # 4. Process Offline Field Visits
    for v_item in visits_data:
        try:
            farmer_id = v_item.get('farmer_id') or v_item.get('farmer')
            farmer = Farmer.objects.get(id=farmer_id)
            plot_id = v_item.get('plot_id') or v_item.get('plot')
            plot = Plot.objects.filter(id=plot_id).first() if plot_id else None

            check_in_str = v_item.get('check_in_time')
            check_in_time = timezone.datetime.fromisoformat(check_in_str.replace('Z', '+00:00')) if check_in_str else timezone.now()

            visit = FieldVisit.objects.create(
                farmer=farmer,
                plot=plot,
                staff=user,
                purpose=v_item.get('purpose', 'Routine Visit'),
                notes=v_item.get('notes', ''),
                status=v_item.get('status', 'Verified'),
                check_in_time=check_in_time,
                duration_minutes=v_item.get('duration_minutes', 15),
                latitude=v_item.get('latitude', 0.0),
                longitude=v_item.get('longitude', 0.0),
                gps_accuracy=v_item.get('gps_accuracy', 5.0),
                distance_from_plot=v_item.get('distance_from_plot', 0.0),
                inside_radius=v_item.get('inside_radius', True),
                created_by=user
            )
            synced_visits += 1
        except Exception as e:
            errors.append({"item": "visit", "temp_id": v_item.get('temp_id'), "error": str(e)})

    # 5. Process Offline Call Logs
    for c_item in calls_data:
        try:
            farmer_id = c_item.get('farmer_id') or c_item.get('farmer')
            farmer = Farmer.objects.get(id=farmer_id)
            call_time_str = c_item.get('call_time')
            call_time = timezone.datetime.fromisoformat(call_time_str.replace('Z', '+00:00')) if call_time_str else timezone.now()

            CallLog.objects.create(
                farmer=farmer,
                staff=user,
                direction=c_item.get('direction', 'Outgoing'),
                call_time=call_time,
                duration=c_item.get('duration', 60),
                outcome=c_item.get('outcome', 'Other'),
                notes=c_item.get('notes', ''),
                next_action=c_item.get('next_action', ''),
                followup_date=c_item.get('followup_date')
            )
            synced_calls += 1
        except Exception as e:
            errors.append({"item": "call", "temp_id": c_item.get('temp_id'), "error": str(e)})

    # 6. Process Offline Recommendations
    for r_item in recommendations_data:
        try:
            farmer_id = r_item.get('farmer_id') or r_item.get('farmer')
            farmer = Farmer.objects.get(id=farmer_id)
            rec = Recommendation.objects.create(
                farmer=farmer,
                created_by_user=user,
                product_name=r_item.get('product_name', 'General Product'),
                dose=r_item.get('dose', '1.0'),
                dose_unit=r_item.get('dose_unit', 'g/L'),
                timing=r_item.get('timing', 'Morning'),
                application_method=r_item.get('application_method', 'Foliar Spray'),
                notes=r_item.get('notes', ''),
                priority=r_item.get('priority', 'Normal'),
                channel=r_item.get('channel', 'Internal')
            )
            synced_recommendations += 1
        except Exception as e:
            errors.append({"item": "recommendation", "temp_id": r_item.get('temp_id'), "error": str(e)})

    SystemAuditLog.objects.create(
        entity_type='OfflineSyncBatch',
        entity_id=f"sync_{user.id}",
        action_type='Create',
        new_value=f"Synced {synced_farmers} farmers, {synced_plots} plots, {synced_seasons} seasons, {synced_visits} visits, {synced_calls} calls, {synced_recommendations} recommendations for {user.email}",
        user_id=str(user.id)
    )

    return Response({
        "message": "Offline batch synchronization complete",
        "synced_farmers": synced_farmers,
        "synced_plots": synced_plots,
        "synced_seasons": synced_seasons,
        "synced_visits": synced_visits,
        "synced_calls": synced_calls,
        "synced_recommendations": synced_recommendations,
        "errors": errors
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def downstream_sync_view(request):
    """
    Offline Delta Downstream Sync Endpoint.
    Returns app data and user-specific data to populate the frontend IndexedDB.
    """
    user = request.user
    
    # App Data
    crops = list(CropMaster.objects.filter(status='Active').values('id', 'crop_name', 'crop_category', 'reference_image'))
    stages = list(CropStage.objects.values('id', 'crop_id', 'stage_name', 'sequence_number', 'days_from_previous_stage'))
    
    thirty_days_ago = timezone.now().date() - timezone.timedelta(days=30)
    market_rates = list(MarketRate.objects.filter(date__gte=thirty_days_ago).values('id', 'crop_id', 'date', 'min_price', 'max_price', 'avg_price'))
    
    # User Data (Hierarchy-scoped)
    farmers_qs = Farmer.objects.exclude(status__iexact='Inactive')
    if user.role not in [Role.ADMIN, Role.CONTENT_TEAM]:
        team_users = user.get_team_users()
        team_user_ids = [u.id for u in team_users]

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
        farmers_qs = farmers_qs.filter(q_filter)
        
    farmers = list(farmers_qs.values(
        'id', 'full_name', 'primary_mobile', 'village', 'taluka', 'district', 
        'pin_code', 'state', 'assigned_staff_id', 'territory_id', 'date_added', 'acquisition_date', 'status'
    ))
    
    farmer_ids = [f['id'] for f in farmers]
    
    plots = list(Plot.objects.filter(farmer_id__in=farmer_ids, is_active=True).values(
        'id', 'farmer_id', 'plot_name', 'area_acres', 'calculated_area_acres', 'soil_type', 'irrigation_source', 'is_active'
    ))
    for p in plots:
        p['farmer'] = p['farmer_id']
    
    plot_ids = [p['id'] for p in plots]
    
    seasons = list(CropSeason.objects.filter(plot_id__in=plot_ids, status='Active').values(
        'id', 'plot_id', 'crop_id', 'crop__crop_name', 'variety_name', 'current_stage_id', 'sowing_date', 'area_acres', 'status'
    ))
    for s in seasons:
        s['plot'] = s['plot_id']
        s['crop'] = s['crop_id']
        s['crop_name'] = s.pop('crop__crop_name', '')
    
    visits = list(FieldVisit.objects.filter(farmer_id__in=farmer_ids).order_by('-created_at')[:1000].values(
        'id', 'farmer_id', 'plot_id', 'staff_id', 'purpose', 'status', 'check_in_time'
    ))
    
    calls = list(CallLog.objects.filter(farmer_id__in=farmer_ids).order_by('-call_time')[:1000].values(
        'id', 'farmer_id', 'staff_id', 'direction', 'call_time', 'outcome', 'duration'
    ))
    
    recommendations = list(Recommendation.objects.filter(farmer_id__in=farmer_ids).order_by('-timestamp')[:500].values(
        'id', 'farmer_id', 'product_name', 'timestamp', 'priority', 'status', 'channel'
    ))
    
    return Response({
        "timestamp": timezone.now().isoformat(),
        "app_data": {
            "crops": crops,
            "crop_stages": stages,
            "market_rates": market_rates
        },
        "user_data": {
            "farmers": farmers,
            "plots": plots,
            "crop_seasons": seasons,
            "visits": visits,
            "calls": calls,
            "recommendations": recommendations
        }
    })
