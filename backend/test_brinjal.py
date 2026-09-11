import os
import django
import tempfile
import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from rest_framework.test import APIClient
from core.models import User, CropMaster

user = User.objects.get(email="dhanashree.agro@gmail.com")
client = APIClient()
client.force_authenticate(user=user)

crop = CropMaster.objects.filter(crop_name__icontains="brinjal").first()
if crop:
    print(f"Testing upload for crop: {crop.crop_name}")
    print(f"Current reference_image: {crop.reference_image[:100] if crop.reference_image else None}")

    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tf:
        tf.write(b'fake_image_data_here')
        tf_path = tf.name

    with open(tf_path, 'rb') as f:
        response = client.patch(f'/api/crops/{crop.id}/', {
            'crop_name': crop.crop_name,
            'crop_category': crop.crop_category,
            'reference_image': f
        }, format='multipart')

    print(f"Status Code: {response.status_code}")
    if response.status_code != 200:
        print(f"Response: {response.content}")
else:
    print("Crop not found.")
