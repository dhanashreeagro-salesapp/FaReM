import os, django, time
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()
from core.models import *
def run():
    user = User.objects.get(email='vbhagre@plantnutrition.in')
    farmers = Farmer.objects.exclude(status__iexact='Inactive')
    q_filter = django.db.models.Q(assigned_staff_id__in=[user.id]) | django.db.models.Q(territory_id__in=[user.territory_id] if user.territory_id else [])
    farmer_ids = list(farmers.filter(q_filter).values_list('id', flat=True))

    st = time.time()
    active_seasons = list(
        CropSeason.objects.filter(plot__farmer_id__in=farmer_ids, plot__is_active=True, status='Active')
        .values('crop_id', 'crop__crop_name', 'current_stage__stage_name', 'sowing_date')
    )
    print('Values query:', time.time() - st)
    
    st2 = time.time()
    plot_ids = list(Plot.objects.filter(farmer_id__in=farmer_ids, is_active=True).values_list('id', flat=True))
    active_seasons2 = list(CropSeason.objects.filter(plot_id__in=plot_ids, status='Active').values('crop_id', 'crop__crop_name', 'current_stage__stage_name', 'sowing_date'))
    print('Split Values query:', time.time() - st2)
run()
