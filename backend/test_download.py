import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from core.views_users import UserViewSet
from core.models import User

user = User.objects.get(email='dhanashree.agro@gmail.com')
factory = APIRequestFactory()

request = factory.get('/users/download_template/')
force_authenticate(request, user=user)

view = UserViewSet.as_view({'get': 'download_template'})
response = view(request)
print('Response Status:', response.status_code)
if response.status_code != 200:
    print('Content:', response.content)
