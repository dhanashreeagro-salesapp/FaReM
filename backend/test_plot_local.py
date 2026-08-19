import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from core.views_plot import PlotViewSet
from core.models import User

user = User.objects.get(email='avinashpatil@plantnutrition.in')
factory = APIRequestFactory()

payload = {
    "farmer": "c43efd76-ae9a-4ffc-986b-9203d9ad9ca8",
    "plot_name": "Test Plot",
    "area_acres": "2.5",
    "soil_type": "Black",
    "irrigation_source": "Well",
    "location_wkt": "POLYGON((78.9629 20.5937, 78.9630 20.5937, 78.9630 20.5938, 78.9629 20.5938, 78.9629 20.5937))",
    "is_active": True
}

request = factory.post('/plots/', data=payload, format='json')
force_authenticate(request, user=user)

view = PlotViewSet.as_view({'post': 'create'})
response = view(request)
print('Response Status:', response.status_code)
if hasattr(response, 'data'):
    print('Response Data:', response.data)
