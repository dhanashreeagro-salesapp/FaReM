import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from rest_framework.test import APIClient
from core.models import User

user = User.objects.get(email="dhanashree.agro@gmail.com")
client = APIClient()
client.force_authenticate(user=user)

# 1. Create a duplicate crop
print("Creating a test duplicate crop...")
create_res = client.post('/api/crops/', {
    'crop_name': 'Test Duplicate Crop API',
    'crop_category': 'Test Category'
})
print(f"Create status: {create_res.status_code}")
crop_id = create_res.json()['id']
print(f"Created crop ID: {crop_id}")

# 2. Delete the crop
print("Attempting to delete the test crop...")
delete_res = client.delete(f'/api/crops/{crop_id}/')
print(f"Delete status: {delete_res.status_code}")
if delete_res.status_code != 204:
    print(f"Error: {delete_res.content}")
else:
    print("Delete successful!")
