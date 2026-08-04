import os
import re
import uuid
import pandas as pd
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from core.models import User

csv_path = r'C:\Users\mdamo\Downloads\Supabase Snippet Export Users.csv'
df = pd.read_csv(csv_path)

print(f"Loaded {len(df)} rows from CSV.")

updated_count = 0
not_found = []

for idx, row in df.iterrows():
    raw_salesapp_id = str(row['User ID']).strip() if pd.notna(row['User ID']) else None
    if not raw_salesapp_id:
        continue
    try:
        salesapp_id = uuid.UUID(raw_salesapp_id)
    except Exception:
        continue
        
    email = str(row['Email Address']).strip().lower() if pd.notna(row['Email Address']) else None
    mobile_raw = str(row.get('Mobile Numner')).strip() if pd.notna(row.get('Mobile Numner')) else None
    
    user = None
    if email:
        user = User.objects.filter(email=email).first()
        
    if not user and mobile_raw:
        cleaned_mobile = re.sub(r'[^\d+]', '', mobile_raw)
        user = User.objects.filter(mobile_number__icontains=cleaned_mobile[-10:]).first()
        
    if user:
        user.salesapp_user_id = salesapp_id
        user.save()
        updated_count += 1
        print(f"[{updated_count}] Updated {user.email} -> salesapp_user_id = {salesapp_id}")
    else:
        not_found.append(row.get('Full Name', email))

print(f"\nSuccessfully populated salesapp_user_id for {updated_count} users.")
if not_found:
    print("Users not found in DB:", not_found)
