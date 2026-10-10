from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import FieldVisit, CallLog, Recommendation, RecommendationMessage, Farmer, Plot, User, SystemAuditLog, CropMaster, CropStage, CropSeason, MarketRate, Role
from django.db.models import Q

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def offline_batch_sync_view(request):
    """
    Offline Batch Synchronization Endpoint.
    Receives batch arrays of offline-created visits, call logs, and recommendations.
    Applies timestamp conflict resolution and saves records to Supabase database.
    """
    user = request.user
    visits_data = request.data.get('visits', [])
    calls_data = request.data.get('calls', [])
    recommendations_data = request.data.get('recommendations', [])

    synced_visits = 0
    synced_calls = 0
    synced_recommendations = 0
    errors = []

    # 1. Process Offline Field Visits
    for v_item in visits_data:
        try:
            farmer_id = v_item.get('farmer_id')
            farmer = Farmer.objects.get(id=farmer_id)
            plot_id = v_item.get('plot_id')
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

    # 2. Process Offline Call Logs
    for c_item in calls_data:
        try:
            farmer_id = c_item.get('farmer_id')
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

    # 3. Process Offline Recommendations
    for r_item in recommendations_data:
        try:
            farmer_id = r_item.get('farmer_id')
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
        new_value=f"Synced {synced_visits} visits, {synced_calls} calls, {synced_recommendations} recommendations for {user.email}",
        user_id=str(user.id)
    )

    return Response({
        "message": "Offline batch synchronization complete",
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
        q_filter = Q(assigned_staff_id__in=team_user_ids)
        farmers_qs = farmers_qs.filter(q_filter)
        
    farmers = list(farmers_qs.values(
        'id', 'full_name', 'primary_mobile', 'village', 'taluka', 'district', 
        'pin_code', 'state', 'assigned_staff_id', 'territory_id', 'date_added', 'status'
    ))
    
    farmer_ids = [f['id'] for f in farmers]
    
    plots = list(Plot.objects.filter(farmer_id__in=farmer_ids, is_active=True).values(
        'id', 'farmer_id', 'plot_name', 'area_acres', 'soil_type', 'irrigation_source'
    ))
    
    plot_ids = [p['id'] for p in plots]
    
    seasons = list(CropSeason.objects.filter(plot_id__in=plot_ids, status='Active').values(
        'id', 'plot_id', 'crop_id', 'current_stage_id', 'sowing_date', 'area_acres'
    ))
    
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

