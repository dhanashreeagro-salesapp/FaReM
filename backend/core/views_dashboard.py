import pandas as pd
from django.db.models import Count, Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import Farmer, User, ActivityLog, Role
from django.http import HttpResponse

class DashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
            
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
        village_data = farmers.values('village').annotate(count=Count('id')).order_by('-count')[:5]
        data['top_villages'] = list(village_data)

        # Overdue Visits calculation
        from django.utils import timezone
        from .models import AppConfiguration
        config = AppConfiguration.get_config()
        threshold_days = config.visit_frequency_norm_days
        
        overdue_count = 0
        for farmer in farmers:
            last_visit = farmer.activities.filter(activity_type='Visit').order_by('-date').first()
            days_since = (today_date - last_visit.date).days if last_visit else (today_date - farmer.date_added.date()).days
            if days_since >= threshold_days:
                overdue_count += 1
        
        data['overdue_visits'] = overdue_count
        
        from .models import Plot, CropSeason
        data['total_plots'] = Plot.objects.filter(farmer__in=farmers).count()
        
        active_seasons = CropSeason.objects.filter(plot__farmer__in=farmers, status='Active')
        data['active_crop_seasons'] = active_seasons.count()

        stage_breakup = {}
        for season in active_seasons.select_related('crop').prefetch_related('crop__stages'):
            if not season.crop: continue
            crop_name = season.crop.crop_name
            
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
            if stage_name not in stage_breakup[crop_name]:
                stage_breakup[crop_name][stage_name] = 0
            stage_breakup[crop_name][stage_name] += 1
        
        data['crop_stage_breakup'] = stage_breakup

        return Response(data)

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
