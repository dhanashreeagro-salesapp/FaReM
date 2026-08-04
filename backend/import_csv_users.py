import os
import re
import uuid
import pandas as pd
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

from django.db import transaction
from core.models import User, Territory, Role, Status

csv_path = r'C:\Users\mdamo\Downloads\Supabase Snippet Export Users.csv'

role_map = {
    'Salesperson': Role.FIELD_STAFF,
    'Regional Manager': Role.TERRITORY_MANAGER,
    'Sales Director': Role.ZONAL_MANAGER,
    'Admin': Role.ADMIN,
}

@transaction.atomic
def run_import():
    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} users from {csv_path}")

    used_mobiles = set()
    created_count = 0
    updated_count = 0

    def clean_mobile(raw, default_idx, current_email):
        if not raw or pd.isna(raw):
            return f"+91900000{default_idx:04d}"
        cleaned = re.sub(r'[^\d+]', '', str(raw))
        if not cleaned.startswith('+'):
            if len(cleaned) == 10:
                cleaned = '+91' + cleaned
            else:
                cleaned = '+' + cleaned
        
        base = cleaned
        counter = 1
        while cleaned in used_mobiles or User.objects.filter(mobile_number=cleaned).exclude(email=current_email).exists():
            cleaned = f"{base[:-1]}{counter}"
            counter += 1
        used_mobiles.add(cleaned)
        return cleaned

    users_by_name = {}

    # Pass 1: Upsert Users and Territories
    for idx, row in df.iterrows():
        raw_id = str(row['User ID']).strip() if pd.notna(row['User ID']) else None
        user_uuid = uuid.UUID(raw_id) if raw_id else uuid.uuid4()
        
        full_name = str(row['Full Name']).strip() if pd.notna(row['Full Name']) else 'User'
        row_email = str(row['Email Address']).strip().lower() if pd.notna(row['Email Address']) else f"user{idx}@plantnutrition.in"
        raw_role = str(row['Security Role']).strip() if pd.notna(row['Security Role']) else 'Salesperson'
        role = role_map.get(raw_role, Role.FIELD_STAFF)
        
        mobile = clean_mobile(row.get('Mobile Numner'), idx, row_email)
        password = str(row['Password']).strip() if pd.notna(row['Password']) else 'Welcome@123'
        salesperson_code = str(row['Salesperson Code']).strip() if pd.notna(row['Salesperson Code']) else ''
        
        status_str = str(row.get('Approval Status', '')).strip()
        status = Status.ACTIVE if 'Active' in status_str else Status.INACTIVE
        
        name_parts = full_name.split()
        first_name = name_parts[0] if len(name_parts) > 0 else full_name
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
        
        terr_name = str(row.get('Territory Scope', '')).strip() if pd.notna(row.get('Territory Scope')) else ''
        if not terr_name and pd.notna(row.get('Region')):
            terr_name = str(row['Region']).strip()
            
        territory_obj = None
        if terr_name and terr_name.lower() != 'nan':
            territory_obj = Territory.objects.filter(name=terr_name).first()
            if not territory_obj:
                territory_obj = Territory.objects.create(name=terr_name, status=Status.ACTIVE)

            
        user_obj, created = User.objects.get_or_create(
            email=row_email,
            defaults={
                'id': user_uuid,
                'username': row_email,
                'mobile_number': mobile,
                'first_name': first_name,
                'last_name': last_name,
                'role': role,
                'status': status,
                'employee_id': salesperson_code,
                'territory': territory_obj,
            }
        )
        
        if not created:
            user_obj.username = row_email
            user_obj.mobile_number = mobile
            user_obj.first_name = first_name
            user_obj.last_name = last_name
            user_obj.role = role
            user_obj.status = status
            user_obj.employee_id = salesperson_code
            if territory_obj:
                user_obj.territory = territory_obj
                
        user_obj.set_password(password)
        user_obj.save()
        
        users_by_name[full_name.lower()] = user_obj
        if created:
            created_count += 1
        else:
            updated_count += 1

    print(f"Pass 1 finished: Created {created_count} users, updated {updated_count} users.")

    # Pass 2: Set Reporting Managers
    linked_managers = 0
    for idx, row in df.iterrows():
        row_email = str(row['Email Address']).strip().lower() if pd.notna(row['Email Address']) else None
        mgr_name = str(row.get('Reporting Manager', '')).strip() if pd.notna(row.get('Reporting Manager')) else ''
        
        if row_email and mgr_name and mgr_name.lower() != 'nan':
            try:
                user_obj = User.objects.get(email=row_email)
                mgr_obj = users_by_name.get(mgr_name.lower())
                
                if not mgr_obj:
                    for name, u in users_by_name.items():
                        if mgr_name.lower() in name or name in mgr_name.lower():
                            mgr_obj = u
                            break
                            
                if mgr_obj and mgr_obj != user_obj:
                    user_obj.reporting_manager = mgr_obj
                    user_obj.save()
                    linked_managers += 1
            except User.DoesNotExist:
                pass

    print(f"Pass 2 finished: Successfully linked {linked_managers} reporting managers!")
    print("CSV Import complete.")

if __name__ == '__main__':
    run_import()
