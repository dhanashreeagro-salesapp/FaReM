import os
import django
import tempfile

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from django.test import Client
from core.models import User, CropMaster

user = User.objects.get(email="rborse@plantnutrition.in")
crop = CropMaster.objects.filter(crop_name__icontains="wheat").first()
if not crop:
    crop = CropMaster.objects.first()

client = Client()
client.force_login(user)

print(f"Testing upload for crop: {crop.crop_name}")

# Create a dummy image file
with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tf:
    # Write some dummy bytes
    tf.write(b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xdb\x00C\x01\t\t\t\x0c\x0b\x0c\x18\r\r\x182!\x1c!22222222222222222222222222222222222222222222222222\xff\xc0\x00\x11\x08\x00\n\x00\n\x03\x01"\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x15\x00\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x05\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xc4\x00\x14\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xc4\x00\x14\x11\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00?\x00\xa0\x00\xff\xd9')
    tf_path = tf.name

with open(tf_path, 'rb') as f:
    response = client.patch(f'/api/crops/{crop.id}/', {
        'reference_image': f
    })

print(f"Status Code: {response.status_code}")
print(f"Response: {response.content}")

crop.refresh_from_db()
if crop.reference_image and crop.reference_image.startswith('data:image'):
    print(f"Image was successfully saved to DB! Length: {len(crop.reference_image)}")
else:
    print(f"Failed to save image. Value in DB: {crop.reference_image}")
