from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from .models import Farmer, Role, MarketRate, CropSeason
from django.contrib.gis.geos import Point, LineString
from django.contrib.gis.db.models.functions import Distance
from django.utils import timezone
from .serializers_farmer import FarmerSerializer
import statistics

class PlannerViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def daily_plan(self, request):
        if request.user.role != Role.FIELD_STAFF:
            return Response({"error": "Only field staff can access visit planner"}, status=status.HTTP_403_FORBIDDEN)
            
        params = request.query_params
        lat = params.get('lat')
        lng = params.get('lng')
        village = params.get('village')
        crop_id = params.get('crop')
        stage_id = params.get('stage')
        
        from .models import AppConfiguration
        config = AppConfiguration.get_config()
        threshold_days = config.visit_frequency_norm_days
        
        farmers = Farmer.objects.filter(assigned_staff=request.user, status='Active')
        
        if crop_id or stage_id:
            plot_filters = {'plots__is_active': True, 'plots__seasons__status': 'Active'}
            if crop_id:
                plot_filters['plots__seasons__crop__id'] = crop_id
            if stage_id:
                plot_filters['plots__seasons__current_stage__id'] = stage_id
            farmers = farmers.filter(**plot_filters).distinct()
            
        if village:
            farmers = farmers.filter(village__icontains=village)
            
        try:
            lat_float = float(lat) if lat else None
            lng_float = float(lng) if lng else None
        except ValueError:
            lat_float = lng_float = None
            
        user_point = Point(lng_float, lat_float, srid=4326) if lat_float and lng_float else None
        
        village_points = []
        route_line = None
        village_centroid = None
        
        if village:
            for vf in farmers.prefetch_related('plots'):
                for p in vf.plots.all():
                    if p.location:
                        village_points.append(p.location.centroid)
            
            if village_points:
                x = sum(p.x for p in village_points) / len(village_points)
                y = sum(p.y for p in village_points) / len(village_points)
                village_centroid = Point(x, y, srid=4326)
                
            if user_point and village_centroid:
                route_line = LineString(user_point, village_centroid, srid=4326)
                
        farmers = farmers.prefetch_related('activities', 'plots', 'plots__seasons', 'plots__seasons__crop', 'plots__seasons__current_stage').distinct()
        
        today = timezone.now().date()
        plan_list = []
        
        all_areas = []
        for f in farmers:
            total_area = sum((p.area_acres or p.calculated_area_acres or 0) for p in f.plots.filter(is_active=True))
            if total_area > 0:
                all_areas.append(float(total_area))
                
        large_plot_threshold = 999999
        if len(all_areas) >= 4:
            all_areas.sort()
            large_plot_threshold = all_areas[int(len(all_areas)*0.75)]
        elif all_areas:
            large_plot_threshold = max(all_areas)
            
        market_trends = {}
        for rate in MarketRate.objects.values('crop_id', 'avg_price', 'inward_quantity', 'date').order_by('-date'):
            if rate['crop_id'] not in market_trends:
                market_trends[rate['crop_id']] = [rate]
            elif len(market_trends[rate['crop_id']]) < 3:
                market_trends[rate['crop_id']].append(rate)
                
        for farmer in farmers:
            visits = [a for a in farmer.activities.all() if a.activity_type == 'Visit']
            last_visit = max(visits, key=lambda a: a.date) if visits else None
            days_since = (today - last_visit.date).days if last_visit else (today - farmer.date_added.date()).days
            
            min_distance = 999999 
            min_distance_from_village = 999999
            is_in_corridor = False
            
            total_active_area = 0
            has_high_value_before_fruit_set = False
            has_high_market_trend = False
            has_consistent_inward_drop = False
            
            for plot in farmer.plots.all():
                if plot.location:
                    if user_point:
                        d = user_point.distance(plot.location) * 111
                        if d < min_distance:
                            min_distance = d
                            
                    if village and village_points and village_centroid:
                        dist_to_village = village_centroid.distance(plot.location) * 111
                        if dist_to_village < min_distance_from_village:
                            min_distance_from_village = dist_to_village
                        if user_point and route_line:
                            if route_line.distance(plot.location) * 111 <= 10 or dist_to_village <= 10:
                                is_in_corridor = True
                
                if plot.is_active:
                    total_active_area += float(plot.area_acres or plot.calculated_area_acres or 0)
                    for season in [s for s in plot.seasons.all() if s.status == 'Active']:
                        crop = season.crop
                        stage = season.current_stage
                        if crop and stage:
                            if 'fruit set' not in stage.stage_name.lower() and stage.sequence_number <= 3:
                                if crop.crop_category.lower() in ['vegetable', 'fruit', 'fruits', 'vegetables', 'horticulture']:
                                    has_high_value_before_fruit_set = True
                                    
                            rates = market_trends.get(crop.id, [])
                            
                            prev = None
                            if len(rates) == 3:
                                prev = rates[2]
                            elif len(rates) == 2:
                                prev = rates[1]
                                
                            if prev and len(rates) > 0 and rates[0]['avg_price'] and prev['avg_price'] and rates[0]['avg_price'] > prev['avg_price']:
                                has_high_market_trend = True
                                
                            if len(rates) == 3:
                                if rates[0]['inward_quantity'] and rates[1]['inward_quantity'] and rates[2]['inward_quantity']:
                                    if rates[2]['inward_quantity'] > rates[1]['inward_quantity'] > rates[0]['inward_quantity']:
                                        has_consistent_inward_drop = True
                                    
            if user_point:
                if village and village_points:
                    if not is_in_corridor and min_distance > 10:
                        continue
                else:
                    if min_distance > 10:
                        continue
            elif village and village_points and village_centroid:
                if min_distance_from_village > 10:
                    continue
            
            score = 0
            tags = []
            
            if days_since >= threshold_days:
                score += 50
                tags.append("Overdue Visit")
                
            if total_active_area >= large_plot_threshold and total_active_area > 0:
                score += 30
                tags.append("Large Active Plot")
                
            if has_high_value_before_fruit_set:
                score += 40
                tags.append("High Value (Pre-Fruit Set)")
                
            if has_high_market_trend:
                score += 20
                tags.append("Favorable Market Trend")
                
            if has_consistent_inward_drop:
                score += 30
                tags.append("Expected Price Surge")
                
            if score == 0 and not tags:
                tags.append("Routine")
                
            plan_list.append({
                'farmer': FarmerSerializer(farmer).data,
                'overdue_days': days_since,
                'is_overdue': days_since >= threshold_days,
                'distance': round(min_distance, 1) if user_point and min_distance != 999999 else None,
                'smart_score': score,
                'tags': tags
            })
            
        plan_list.sort(key=lambda x: (-x['smart_score'], x['distance'] if x['distance'] is not None else 999999))
        
        return Response(plan_list)
