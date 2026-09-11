import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from rest_framework.test import APIClient
from core.models import User

user = User.objects.filter(is_superuser=True).first()
if not user:
    user = User.objects.first()

client = APIClient()
client.force_authenticate(user=user)

res = client.get('/api/promotions/')
print(res.status_code)
print(res.json())
