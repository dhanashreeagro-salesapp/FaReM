import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from core.models import CropMaster

crops = CropMaster.objects.all()
for c in crops:
    print(f"Crop: {c.crop_name}, Image: {c.reference_image}, URL: {c.reference_image.url if c.reference_image else 'No URL'}")
