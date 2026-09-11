import os
import django
import tempfile

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from rest_framework.test import APIClient
from core.models import User, CropMaster

user = User.objects.get(email="dhanashree.agro@gmail.com")
client = APIClient()
client.force_authenticate(user=user)

crop = CropMaster.objects.filter(crop_name__icontains="Soyabean").first()

if crop:
    print(f"Testing large upload for crop: {crop.crop_name}")

    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tf:
        # Create a 4MB fake image
        tf.write(b'a' * (4 * 1024 * 1024))
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
