import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from django.test import RequestFactory
from rest_framework.test import force_authenticate
from core.views_market import MarketSnapshotView
from core.models import User, CropMaster

user = User.objects.get(email="rborse@plantnutrition.in")
factory = RequestFactory()

crop = CropMaster.objects.filter(crop_name__icontains="pomegranate").first()
if crop:
    request = factory.get(f'/api/market/snapshot/?crop_id={crop.id}')
    force_authenticate(request, user=user)
    view = MarketSnapshotView.as_view()
    
    response = view(request)
    
    if 'global_chart_data' in response.data:
        print("Global Chart Data found!")
        print(response.data['global_chart_data'])
        
        pref_market = list(response.data['markets_data'].keys())[0]
        print(f"\nPreferred Market ({pref_market}) Chart Data:")
        print(response.data['markets_data'][pref_market]['chart_data'])
    else:
        print("Error: global_chart_data not found in response.")
else:
    print("Crop not found.")
