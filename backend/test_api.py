import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from django.test import RequestFactory
from rest_framework.test import force_authenticate
from core.views_market import MarketSnapshotView
from core.models import User, MarketPriceRecord

user = User.objects.get(email="rborse@plantnutrition.in")
record = MarketPriceRecord.objects.first()

factory = RequestFactory()
request = factory.get(f'/api/market/snapshot/?crop_id={record.crop_id}')
force_authenticate(request, user=user)

view = MarketSnapshotView.as_view()
response = view(request)

import json
print(json.dumps(response.data.get('festival_intelligence', []), indent=2, default=str))
