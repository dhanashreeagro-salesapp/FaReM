import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from rest_framework.test import APIClient
from core.models import User, CropMaster

user = User.objects.get(email="rborse@plantnutrition.in")
crop = CropMaster.objects.filter(crop_name="Ginger").first()

client = APIClient()
client.force_authenticate(user=user)

# Simulate frontend sending FormData without reference_image
response = client.patch(f'/api/crops/{crop.id}/', {
    'crop_name': 'Ginger updated',
    'crop_category': 'Rhizomes',
}, format='multipart')

print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")

# Check DB again
crop.refresh_from_db()
print(f"Image in DB after PATCH: {crop.reference_image}")
