import requests

urls = [
    'https://farem-web.onrender.com',
    'https://farem-backend.onrender.com',
    'https://farem-api.onrender.com',
    'https://farem-server.onrender.com',
    'https://farem-app.onrender.com',
    'https://fa-re-m.onrender.com',
    'https://agriamigo.onrender.com',
    'https://agriamigo-backend.onrender.com',
    'https://agriamigo-api.onrender.com',
    'https://dhanashreeagro.onrender.com',
    'https://dhanashree-backend.onrender.com',
    'https://fa-re-m4-git-main-mdamodare-debugs-projects.vercel.app/api'
]

for base in urls:
    try:
        r = requests.post(f"{base}/api/auth/login/", json={'email': 'sgiri@plantnutrition.in', 'password': 'welcome123'}, timeout=4)
        print(f"URL: {base:<60} | LOGIN STATUS: {r.status_code} | DATA: {r.json()}")
        if r.status_code == 200:
            token = r.json().get('access') or r.json().get('tokens', {}).get('access')
            headers = {'Authorization': f'Bearer {token}'}
            r_dash = requests.get(f"{base}/api/dashboard/?refresh=true", headers=headers, timeout=4)
            print(f"   -> DASHBOARD STATUS: {r_dash.status_code} | DATA: {r_dash.json()}")
    except Exception as e:
        print(f"URL: {base:<60} | ERROR: {type(e).__name__}")
