import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from django.test import RequestFactory
from rest_framework.test import force_authenticate
from core.views_market import MarketSnapshotView
from core.models import User
import time

user = User.objects.get(email="rborse@plantnutrition.in")
factory = RequestFactory()
request = factory.get('/api/market/snapshot/')
force_authenticate(request, user=user)

view = MarketSnapshotView.as_view()

start_time = time.time()
response = view(request)
end_time = time.time()

import json
data_str = json.dumps(response.data, default=str)
print(f"Time taken: {end_time - start_time:.2f} seconds")
print(f"Payload size: {len(data_str) / 1024 / 1024:.2f} MB")
print(f"Number of portfolio crops: {len(response.data.get('portfolio_crops', []))}")
if len(response.data.get('portfolio_crops', [])) > 0:
    print(f"First crop image path prefix: {response.data['portfolio_crops'][0].get('reference_image', '')[:100]}")
