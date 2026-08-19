import requests
import json

base_url = 'https://farem-web.onrender.com/api'

# Login
login_resp = requests.post(f'{base_url}/auth/login/', json={'email': 'avinashpatil@plantnutrition.in', 'password': 'Welcome@123'})
if login_resp.status_code != 200:
    print('Failed to login:', login_resp.text)
    exit(1)

token = login_resp.json()['access']

# Create Plot
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
payload = {
    "farmer": "c43efd76-ae9a-4ffc-986b-9203d9ad9ca8",
    "plot_name": "Test Plot",
    "area_acres": "2.5",
    "soil_type": "Black",
    "irrigation_source": "Well",
    "location_wkt": "POLYGON((78.9629 20.5937, 78.9630 20.5937, 78.9630 20.5938, 78.9629 20.5938, 78.9629 20.5937))",
    "is_active": True
}

plot_resp = requests.post(f'{base_url}/plots/', json=payload, headers=headers)
print('Status:', plot_resp.status_code)
print('Response:', plot_resp.text)
