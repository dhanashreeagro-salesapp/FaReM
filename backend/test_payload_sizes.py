import os
import django
import time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from django.test import RequestFactory
from rest_framework.test import force_authenticate
from core.views_market import MarketSnapshotView
from core.views_crop import CropMasterViewSet
from core.models import User, CropMaster

user = User.objects.get(email="rborse@plantnutrition.in")
factory = RequestFactory()

# 1. Test MarketSnapshotView payload size
request = factory.get('/api/market/snapshot/')
force_authenticate(request, user=user)
view = MarketSnapshotView.as_view()

start_time = time.time()
response = view(request)
end_time = time.time()

import json
data_str = json.dumps(response.data, default=str)
print(f"MarketSnapshotView Time taken: {end_time - start_time:.2f} seconds")
print(f"MarketSnapshotView Payload size: {len(data_str) / 1024:.2f} KB")
if len(response.data.get('portfolio_crops', [])) > 0:
    print(f"First crop image path prefix: {response.data['portfolio_crops'][0].get('reference_image', '')[:100]}")


# 2. Test CropMasterViewSet image action
crop = CropMaster.objects.filter(reference_image__startswith='data:image').first()
if crop:
    request = factory.get(f'/api/crops/{crop.id}/image/')
    force_authenticate(request, user=user)
    view = CropMasterViewSet.as_view({'get': 'image'})
    response = view(request, pk=crop.id)
    print(f"Image endpoint status: {response.status_code}")
    print(f"Image endpoint Cache-Control: {response.get('Cache-Control')}")
    print(f"Image endpoint Content-Type: {response.get('Content-Type')}")
else:
    print("No crops with base64 images found to test the image endpoint.")
