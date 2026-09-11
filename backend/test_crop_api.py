import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from django.test import RequestFactory
from rest_framework.test import force_authenticate
from core.views_crop import CropMasterViewSet
from core.models import User

user = User.objects.get(email="rborse@plantnutrition.in")

factory = RequestFactory()
request = factory.get('/api/crops/')
force_authenticate(request, user=user)

view = CropMasterViewSet.as_view({'get': 'list'})
response = view(request)

import json
print(json.dumps(response.data[:2], indent=2, default=str))
