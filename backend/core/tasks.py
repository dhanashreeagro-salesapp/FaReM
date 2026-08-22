from celery import shared_task
import pandas as pd
import requests
from .models import Farmer, User, SystemAuditLog
import io

HEADER_ALIASES = {
    'FullName': ['fullname', 'full name', 'farmer name', 'farmername', 'name of farmer', 'name', 'farmer_name', 'sr no', 'farmer', 'farmer_full_name', 'farmer_name_marathi', 'name_of_farmer'],
    'PrimaryMobile': ['primarymobile', 'primary mobile', 'mobile no', 'mobile number', 'mobileno', 'mobile', 'contact no', 'phone', 'mobile_no', 'primary_mobile', 'contact_number', 'contact', 'mobile_number', 'phone_number', 'phone_no'],
    'Village': ['village', 'town', 'city', 'village_name', 'village name', 'gaon'],
    'Taluka': ['taluka', 'block', 'tehsil', 'taluka_name', 'taluka name'],
    'District': ['district', 'district_name', 'district name'],
    'State': ['state', 'state_name', 'state name'],
    'PinCode': ['pincode', 'pin code', 'zipcode', 'zip code', 'pin', 'pin_code'],
    'StaffMobile': ['staffmobile', 'staff mobile', 'assigned staff id', 'assigned staff', 'responsible person', 'staff id', 'staff email', 'staff_mobile', 'staff', 'assigned_staff', 'staff_name', 'officer', 'staff_phone'],
    'AcquisitionDate': ['acquisitiondate', 'acquisition date', 'date of acquisition', 'date', 'acquisition_date'],
    'Source': ['source'],
    'Password': ['password', 'pwd', 'pass']
}


def normalize_dataframe_headers(df, expected_columns):
    def try_match_columns(cols):
        mapping = {}
        for raw_col in cols:
            cl = str(raw_col).replace('\xa0', ' ').lower().strip()
            for std_name, aliases in HEADER_ALIASES.items():
                if cl in aliases or cl == std_name.lower():
                    mapping[raw_col] = std_name
                    break
        return mapping

    col_map = try_match_columns(df.columns)
    
    # If essential columns not found in df.columns, search top 20 rows for header row
    if 'FullName' not in col_map.values() and 'PrimaryMobile' not in col_map.values():
        for idx, row in df.head(20).iterrows():
            row_map = try_match_columns(row.values)
            if len(row_map) >= 2:
                df.columns = row.values
                df = df.iloc[idx+1:].reset_index(drop=True)
                col_map = try_match_columns(df.columns)
                break

    df = df.rename(columns=col_map)
    df = df.dropna(how='all')
    return df


@shared_task
def validate_farmer_import(import_job_id):
    from .models import ImportJob, User
    import re
    try:
        job = ImportJob.objects.get(id=import_job_id)
    except ImportJob.DoesNotExist:
        return {"status": "failed", "error": "Job not found"}

    try:
        df = pd.read_excel(job.filename)
    except Exception as e:
        job.status = 'Failed'
        job.error_report = [{"error": str(e)}]
        job.save()
        return {"status": "failed", "error": str(e)}

    total_rows = len(df)
    valid_rows = 0
    error_count = 0
    duplicate_count = 0
    error_report = []

    required_columns = ['FullName', 'PrimaryMobile', 'Village']
    expected_columns = ['FullName', 'PrimaryMobile', 'Village', 'Taluka', 'District', 'State', 'PinCode', 'StaffMobile', 'AcquisitionDate', 'Source']
    
    df = normalize_dataframe_headers(df, expected_columns)
    
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        found_cols = ", ".join(str(c) for c in df.columns)
        err_msg = f"Missing required columns in header: {', '.join(missing_cols)}. Found: {found_cols}"
        job.status = 'Failed'
        job.error_report = [{"row": "Header", "error": err_msg}]
        job.save()
        return {"status": "failed", "error": err_msg}

    df['Import Status'] = 'SUCCESS'

    for index, row in df.iterrows():
        try:
            raw_mobile = str(row['PrimaryMobile']).split('.')[0].strip()
            primary_mobile = re.sub(r'\D', '', raw_mobile)[-10:]
            
            staff_raw = row.get('StaffMobile') or row.get('StaffEmail') or row.get('AssignedStaff')
            staff_val = str(staff_raw).split('.')[0].strip() if pd.notna(staff_raw) else ''
            if staff_val:
                staff_val = re.sub(r'\D', '', staff_val)[-10:] or staff_val

            if len(primary_mobile) != 10:
                raise ValueError(f"Invalid PrimaryMobile format: {raw_mobile}")

            # Check for duplicates in DB
            from .models import Farmer
            if Farmer.objects.filter(primary_mobile=primary_mobile).exists():
                duplicate_count += 1
                if df.at[index, 'Import Status'] == 'SUCCESS':
                    df.at[index, 'Import Status'] = 'DUPLICATE (Will be updated)'
            
            # Resolve Staff (by mobile, email, or username)
            if staff_val:
                staff_user = User.objects.filter(mobile_number=staff_val).first()
                if not staff_user:
                    staff_user = User.objects.filter(email__iexact=staff_val).first()
                if not staff_user:
                    staff_user = User.objects.filter(username__iexact=staff_val).first()
                if not staff_user:
                    # Fallback to job.created_by if assigned staff not found
                    pass

            valid_rows += 1
        except Exception as e:
            error_count += 1
            error_report.append({"row": index + 2, "error": str(e)})
            df.at[index, 'Import Status'] = f"ERROR: {str(e)}"

    try:
        with pd.ExcelWriter(job.filename, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
    except Exception as e:
        pass

    job.total_rows = total_rows
    job.valid_rows = valid_rows
    job.error_count = error_count
    job.duplicate_count = duplicate_count
    job.error_report = error_report
    job.status = 'Pending' # Ready for commit
    job.save()

    return {"status": "validation_complete", "job_id": str(job.id)}

@shared_task
def commit_farmer_import(import_job_id):
    from .models import ImportJob, User, Farmer, Territory
    from django.db.models import Q
    import re
    try:
        job = ImportJob.objects.get(id=import_job_id)
    except ImportJob.DoesNotExist:
        return {"status": "failed", "error": "Job not found"}

    df = pd.read_excel(job.filename)
    expected_columns = ['FullName', 'PrimaryMobile', 'Village', 'Taluka', 'District', 'State', 'PinCode', 'StaffMobile', 'Territory', 'AcquisitionDate', 'Source']
    df = normalize_dataframe_headers(df, expected_columns)
    
    created_count = 0
    updated_count = 0

    for index, row in df.iterrows():
        try:
            full_name = str(row['FullName']).strip()
            raw_mobile = str(row['PrimaryMobile']).split('.')[0].strip()
            primary_mobile = re.sub(r'\D', '', raw_mobile)[-10:]
            if len(primary_mobile) != 10:
                continue

            village = str(row['Village']).strip()
            taluka = str(row.get('Taluka', '')).strip() if pd.notna(row.get('Taluka')) else ''
            district = str(row.get('District', '')).strip() if pd.notna(row.get('District')) else ''
            state = str(row.get('State', '')).strip() if pd.notna(row.get('State')) else ''
            raw_pin = str(row.get('PinCode', '')).split('.')[0].strip() if pd.notna(row.get('PinCode')) else ''
            pin_code = raw_pin if raw_pin != 'nan' else ''
            
            staff_raw = row.get('StaffMobile') or row.get('StaffEmail') or row.get('AssignedStaff')
            staff_val = str(staff_raw).split('.')[0].strip() if pd.notna(staff_raw) else ''
            
            assigned_staff_user = None
            if staff_val:
                digits_only = re.sub(r'\D', '', staff_val)[-10:]
                if digits_only and len(digits_only) == 10:
                    assigned_staff_user = User.objects.filter(mobile_number=digits_only).first()
                if not assigned_staff_user:
                    assigned_staff_user = User.objects.filter(email__iexact=staff_val).first()
                if not assigned_staff_user:
                    assigned_staff_user = User.objects.filter(username__iexact=staff_val).first()
                if not assigned_staff_user:
                    parts = staff_val.split()
                    if len(parts) >= 2:
                        assigned_staff_user = User.objects.filter(first_name__iexact=parts[0], last_name__iexact=parts[-1]).first()
                if not assigned_staff_user:
                    assigned_staff_user = User.objects.filter(first_name__icontains=staff_val).first()
                if not assigned_staff_user:
                    assigned_staff_user = User.objects.filter(last_name__icontains=staff_val).first()

            if not assigned_staff_user:
                assigned_staff_user = job.created_by

            # Territory Resolution Logic
            territory_obj = None
            terr_raw = row.get('Territory')
            if pd.notna(terr_raw) and str(terr_raw).strip():
                terr_name = str(terr_raw).strip()
                territory_obj = Territory.objects.filter(name__iexact=terr_name).first()

            if not territory_obj and assigned_staff_user and assigned_staff_user.territory:
                territory_obj = assigned_staff_user.territory

            if not territory_obj and job.created_by and job.created_by.territory:
                territory_obj = job.created_by.territory

            if not territory_obj:
                if village:
                    territory_obj = Territory.objects.filter(name__iexact=village).first()
                if not territory_obj and district:
                    territory_obj = Territory.objects.filter(name__iexact=district).first()

            from django.utils import timezone
            source = str(row.get('Source', '')).strip() if pd.notna(row.get('Source')) else ''
            if source == 'nan' or not source:
                source = 'BulkImport'
                
            acq_date_val = row.get('AcquisitionDate')
            if pd.isna(acq_date_val):
                acquisition_date = timezone.now().date()
            else:
                try:
                    acquisition_date = pd.to_datetime(acq_date_val).date()
                except:
                    acquisition_date = timezone.now().date()

            assigned_staff = assigned_staff_user
            
            farmer, created = Farmer.objects.update_or_create(
                primary_mobile=primary_mobile,
                defaults={
                    'full_name': full_name,
                    'village': village,
                    'taluka': taluka,
                    'district': district,
                    'state': state,
                    'pin_code': pin_code,
                    'assigned_staff': assigned_staff,
                    'source': source,
                    'acquisition_date': acquisition_date,
                    'territory': territory_obj
                }
            )

            if created:
                created_count += 1
            else:
                updated_count += 1
        except Exception as e:
            continue

    job.status = 'Completed'
    job.save()

    import os
    if os.path.exists(job.filename):
        try:
            os.remove(job.filename)
        except Exception:
            pass

    return {"status": "import_complete", "created": created_count, "updated": updated_count}


@shared_task
def validate_user_import(import_job_id):
    from .models import ImportJob, User, Territory
    try:
        job = ImportJob.objects.get(id=import_job_id)
    except ImportJob.DoesNotExist:
        return {"status": "failed", "error": "Job not found"}

    try:
        df = pd.read_excel(job.filename)
    except Exception as e:
        job.status = 'Failed'
        job.error_report = [{"error": str(e)}]
        job.save()
        return {"status": "failed", "error": str(e)}

    total_rows = len(df)
    valid_rows = 0
    error_count = 0
    duplicate_count = 0
    error_report = []

    required_columns = ['Employee ID', 'FullName', 'PrimaryMobile', 'Designation']
    expected_columns = required_columns + ['Territory', 'Email', 'Password']
    
    df = normalize_dataframe_headers(df, expected_columns)
    
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        found_cols = ", ".join(str(c) for c in df.columns)
        err_msg = f"Missing required columns in header: {', '.join(missing_cols)}. Found: {found_cols}"
        job.status = 'Failed'
        job.error_report = [{"row": "Header", "error": err_msg}]
        job.save()
        return {"status": "failed", "error": err_msg}

    # Human-readable designation to system role mapping
    role_mapping = {
        'field staff': 'FieldStaff',
        'territory manager': 'TerritoryManager',
        'zonal manager': 'ZonalManager',
        'admin': 'Admin',
        'content team': 'ContentTeam'
    }
    roles = [r[0] for r in User._meta.get_field('role').choices]

    existing_mobiles = set(User.objects.values_list('mobile_number', flat=True))
    existing_territories = set(Territory.objects.values_list('name', flat=True))

    df['Import Status'] = 'SUCCESS (Will be CREATED)'

    for index, row in df.iterrows():
        try:
            mobile = str(row['PrimaryMobile']).split('.')[0].strip()
            
            # Map human-readable designation to system role if necessary
            designation = str(row['Designation']).strip().lower()
            role = role_mapping.get(designation, str(row['Designation']).strip())
            
            if len(mobile) != 10 or not mobile.isdigit():
                raise ValueError("Mobile Number must be exactly 10 digits")

            if role not in roles:
                raise ValueError(f"Invalid Designation: {str(row['Designation'])}. Must map to one of {roles}")

            if mobile in existing_mobiles:
                duplicate_count += 1
                if 'SUCCESS' in str(df.at[index, 'Import Status']):
                    df.at[index, 'Import Status'] = 'DUPLICATE (Will be UPDATED)'
            
            # Check territory if provided
            if 'Territory' in df.columns and not pd.isna(row['Territory']):
                t_name = str(row['Territory']).strip()
                if t_name and t_name.lower() != 'nan' and t_name not in existing_territories:
                    existing_territories.add(t_name)
                    if 'SUCCESS' in str(df.at[index, 'Import Status']) or 'UPDATED' in str(df.at[index, 'Import Status']):
                        df.at[index, 'Import Status'] += f" | NEW TERRITORY (Will create '{t_name}')"

            valid_rows += 1
        except Exception as e:
            error_count += 1
            error_report.append({"row": index + 2, "error": str(e)})
            df.at[index, 'Import Status'] = f"ERROR: {str(e)} (Will NOT be uploaded)"

    try:
        with pd.ExcelWriter(job.filename, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
    except Exception as e:
        pass

    job.total_rows = total_rows
    job.valid_rows = valid_rows
    job.error_count = error_count
    job.duplicate_count = duplicate_count
    job.error_report = error_report
    job.status = 'Pending'
    job.save()

    return {"status": "validation_complete", "job_id": str(job.id)}

@shared_task
def commit_user_import(import_job_id):
    from .models import ImportJob, User, Territory
    try:
        job = ImportJob.objects.get(id=import_job_id)
    except ImportJob.DoesNotExist:
        return {"status": "failed", "error": "Job not found"}

    df = pd.read_excel(job.filename)
    
    # Re-normalize just to be safe
    expected_columns = ['Employee ID', 'FullName', 'PrimaryMobile', 'Designation', 'Territory', 'Email']
    df = normalize_dataframe_headers(df, expected_columns)
    
    created_count = 0
    updated_count = 0

    role_mapping = {
        'field staff': 'FieldStaff',
        'territory manager': 'TerritoryManager',
        'zonal manager': 'ZonalManager',
        'admin': 'Admin',
        'content team': 'ContentTeam'
    }

    existing_users = {u.mobile_number: u for u in User.objects.all()}
    territories = {t.name: t for t in Territory.objects.all()}

    users_to_create = []
    users_to_update = []

    for index, row in df.iterrows():
        try:
            name_parts = str(row['FullName']).strip().split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            mobile = str(row['PrimaryMobile']).split('.')[0].strip()
            employee_id = str(row.get('Employee ID', '')).strip()
            if employee_id == 'nan' or pd.isna(row.get('Employee ID')):
                employee_id = ''
            
            designation = str(row['Designation']).strip().lower()
            role = role_mapping.get(designation, str(row['Designation']).strip())
            
            territory_name = str(row.get('Territory', '')).strip()
            if territory_name == 'nan' or pd.isna(row.get('Territory')):
                territory_name = ''

            territory = None
            if territory_name:
                territory = territories.get(territory_name)
                if not territory:
                    territory = Territory.objects.create(name=territory_name, parent_territory=None)
                    territories[territory_name] = territory

            email = str(row.get('Email', '')).strip()
            if email == 'nan' or pd.isna(row.get('Email')):
                email = ''

            password = str(row.get('Password', '')).strip()
            if password == 'nan' or pd.isna(row.get('Password')) or not password:
                password = 'Welcome@123'

            if mobile in existing_users:
                user = existing_users[mobile]
                user.first_name = first_name
                user.last_name = last_name
                user.employee_id = employee_id
                user.role = role
                user.territory = territory
                if email:
                    user.email = email
                if password and password != 'Welcome@123':
                    user.set_password(password)
                user.status = 'Active'
                
                if territory and territory.parent_territory and territory.parent_territory.manager:
                    user.reporting_manager = territory.parent_territory.manager
                
                users_to_update.append(user)
                updated_count += 1
            else:
                user = User(
                    mobile_number=mobile,
                    username=mobile,
                    first_name=first_name,
                    last_name=last_name,
                    employee_id=employee_id,
                    role=role,
                    territory=territory,
                    email=email,
                    status='Active'
                )
                user.set_password(password)
                if territory and territory.parent_territory and territory.parent_territory.manager:
                    user.reporting_manager = territory.parent_territory.manager
                
                users_to_create.append(user)
                created_count += 1
        except:
            continue

    if users_to_create:
        User.objects.bulk_create(users_to_create, batch_size=500)
    if users_to_update:
        User.objects.bulk_update(users_to_update, ['first_name', 'last_name', 'employee_id', 'role', 'territory', 'email', 'status', 'reporting_manager'], batch_size=500)

    job.status = 'Completed'
    job.save()

    import os
    if os.path.exists(job.filename):
        os.remove(job.filename)

    return {"status": "import_complete", "created": created_count, "updated": updated_count}

@shared_task
def create_audit_log_async(entity_type, entity_id, field_changed, old_value, new_value, user_id, action_type):
    from .models import SystemAuditLog
    SystemAuditLog.objects.create(
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else "",
        field_changed=field_changed,
        old_value=str(old_value) if old_value else "",
        new_value=str(new_value) if new_value else "",
        user_id=str(user_id) if user_id else "",
        action_type=action_type
    )

def __send_notification__(channel, mobile_number, text_content, custom_template=None):
    from .models import AppConfiguration
    config = AppConfiguration.get_config()
    success = False
    
    if not str(mobile_number).startswith('+'):
        mobile_number = f"+91{mobile_number}" if len(str(mobile_number)) == 10 else str(mobile_number)

    try:
        mobile_clean = str(mobile_number).replace('+91', '').replace('+', '')
        if channel == 'WhatsApp' and config.interakt_api_key:
            headers = {
                'Authorization': f'Basic {config.interakt_api_key}',
                'Content-Type': 'application/json'
            }
            template_name = custom_template or config.interakt_template_name or 'farmer_alert_01'
            payload = {
                "countryCode": "+91",
                "phoneNumber": mobile_clean,
                "type": "Template",
                "template": {
                    "name": template_name,
                    "languageCode": "en",
                    "bodyValues": [text_content[:1024]]
                }
            }
            resp = requests.post("https://api.interakt.ai/v1/public/message/", json=payload, headers=headers, timeout=10)
            success = resp.status_code in [200, 201, 202]

        elif channel == 'SMS':
            if getattr(config, 'active_sms_provider', 'STPL') == 'STPL' and config.stpl_api_key:
                url = config.stpl_api_url or "https://www.smsgatewayhub.com/api/mt/SendSMS"
                params = {
                    "APIKey": config.stpl_api_key,
                    "senderid": config.stpl_sender_id or "FRMNUI",
                    "channel": "2",
                    "DCS": "0",
                    "flashsms": "0",
                    "number": mobile_clean,
                    "text": text_content,
                    "route": "1"
                }
                resp = requests.get(url, params=params, timeout=10)
                success = resp.status_code == 200
            elif config.msg91_auth_key:
                headers = {'authkey': config.msg91_auth_key, 'content-type': 'application/json'}
                payload = {
                    "sender": "FRMNUI",
                    "route": "4",
                    "country": "91",
                    "sms": [{"message": text_content, "to": [mobile_clean]}]
                }
                resp = requests.post("https://api.msg91.com/api/v2/sendsms", json=payload, headers=headers, timeout=10)
                success = resp.status_code == 200
    except Exception as e:
        print("Notification Error:", e)
        success = False

    return success

@shared_task
def dispatch_recommendation_msg(recommendation_id):
    from .models import Recommendation
    try:
        rec = Recommendation.objects.get(id=recommendation_id)
        
        text = f"Recommendation: {rec.product_name} at {rec.dose} {rec.dose_unit} for {rec.crop.name if rec.crop else 'crop'}."
        success = __send_notification__(rec.channel, rec.farmer.primary_mobile, text)
            
        rec.send_status = 'Delivered' if success else 'Failed'
        rec.save(update_fields=['send_status'])
        
        return {"status": rec.send_status, "recommendation_id": str(rec.id)}
    except Recommendation.DoesNotExist:
        return {"status": "failed", "error": "Not found"}

@shared_task
def check_overdue_visits_and_stage_transitions():
    from .models import Farmer, CropSeason, AppConfiguration
    from django.utils import timezone
    
    config = AppConfiguration.get_config()
    threshold_days = config.visit_frequency_norm_days
    today = timezone.now().date()
    
    # 1. Check Overdue
    farmers = Farmer.objects.filter(status='Active').select_related('assigned_staff')
    overdue_count = 0
    for farmer in farmers:
        last_visit = farmer.activities.filter(activity_type='Visit').order_by('-date').first()
        days_since = (today - last_visit.date).days if last_visit else (today - farmer.date_added.date()).days
        if days_since >= threshold_days:
            # Send FCM push to assigned staff if they have a push token
            if farmer.assigned_staff and farmer.assigned_staff.device_push_token:
                send_push_notification.delay(
                    farmer.assigned_staff.device_push_token,
                    'Overdue Visit Alert',
                    f'{farmer.full_name} in {farmer.village} has not been visited for {days_since} days.'
                )
            overdue_count += 1

    # 2. Check Stage Transitions & Update Stages
    # First, update the current_stage dynamically based on days since sowing
    all_active_seasons = CropSeason.objects.filter(status='Active')
    stages_updated_count = 0
    for season in all_active_seasons:
        if not season.crop or not season.sowing_date:
            continue
        days_since_sowing = (today - season.sowing_date).days
        stages = season.crop.stages.all().order_by('sequence_number')
        
        cumulative_days = 0
        selected_stage = None
        for stage in stages:
            cumulative_days += stage.days_from_previous_stage
            if days_since_sowing <= cumulative_days:
                selected_stage = stage
                break
        
        if not selected_stage and stages:
            selected_stage = list(stages)[-1]
            
        if selected_stage and season.current_stage != selected_stage:
            season.current_stage = selected_stage
            season.save(update_fields=['current_stage'])
            stages_updated_count += 1

    seasons = CropSeason.objects.filter(expected_next_stage_date=today, status='Active').select_related('plot__farmer__assigned_staff')
    stage_transitions_count = seasons.count()
    for season in seasons:
        staff = season.plot.farmer.assigned_staff
        if staff and staff.device_push_token:
            send_push_notification.delay(
                staff.device_push_token,
                'Stage Transition Reminder',
                f'{season.plot.farmer.full_name} - {season.crop.crop_name} may be ready for the next growth stage.'
            )

    return {
        "status": "success",
        "overdue_alerts_sent": overdue_count,
        "stage_transition_alerts_sent": stage_transitions_count,
        "stages_updated": stages_updated_count
    }

@shared_task
def send_push_notification(push_token, title, body):
    """Send a push notification via Firebase Cloud Messaging."""
    try:
        import firebase_admin
        from firebase_admin import messaging
        # Initialize firebase app if not already done
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            token=push_token,
        )
        messaging.send(message)
        return {"status": "sent"}
    except Exception as e:
        print(f"FCM push failed: {e}")
        return {"status": "failed", "error": str(e)}

@shared_task
def process_scheduled_batches():
    from .models import BulkSendBatch
    from django.utils import timezone
    
    today = timezone.now().date()
    
    batches = BulkSendBatch.objects.filter(
        approval_status='Approved',
        send_status__in=['Pending', 'InProgress']
    )
    
    for batch in batches:
        exec_date = batch.next_execution_date or batch.scheduled_start_date or today
        if exec_date <= today:
            execute_bulk_send_batch.delay(str(batch.id))

@shared_task
def execute_bulk_send_batch(batch_id):
    from .models import BulkSendBatch
    from django.utils import timezone
    import datetime
    try:
        batch = BulkSendBatch.objects.get(id=batch_id)
        if batch.send_status == 'Completed' and batch.frequency == 'Once':
            return {"status": "failed", "error": "Already completed"}
            
        batch.send_status = 'InProgress'
        batch.save(update_fields=['send_status'])
        
        sent = 0
        failed = 0
        
        # Gather text content or template
        template_name = None
        if batch.channel == 'WhatsApp':
            template_name = batch.content.whatsapp_template
        elif batch.channel == 'SMS':
            template_name = batch.content.sms_template
            
        text_content = getattr(batch.content, 'title', 'New Promotion from Dhanashree Crop Solutions')
        
        from .models import Farmer
        # Iterate over farmer_ids
        for farmer_id in batch.farmer_ids:
            try:
                farmer = Farmer.objects.get(id=farmer_id)
                succ = __send_notification__(batch.channel, farmer.primary_mobile, text_content, custom_template=template_name)
                if succ:
                    sent += 1
                else:
                    failed += 1
            except Farmer.DoesNotExist:
                failed += 1
            
        batch.sent_count += sent
        batch.failed_count += failed
        
        if batch.frequency == 'Once' or not batch.frequency:
            batch.send_status = 'Completed'
        else:
            today = timezone.now().date()
            if batch.frequency == 'Daily':
                next_date = today + datetime.timedelta(days=1)
            elif batch.frequency == 'Weekly':
                next_date = today + datetime.timedelta(days=7)
            else:
                next_date = today + datetime.timedelta(days=1)
                
            batch.next_execution_date = next_date
            
            if batch.scheduled_end_date and next_date > batch.scheduled_end_date:
                batch.send_status = 'Completed'
            else:
                batch.send_status = 'Pending'
                
        batch.save(update_fields=['sent_count', 'failed_count', 'send_status', 'next_execution_date'])
        
        return {"status": "success", "sent": sent, "failed": failed}
    except BulkSendBatch.DoesNotExist:
        return {"status": "failed", "error": "Batch not found"}

@shared_task
def validate_promotion_import(import_job_id):
    from .models import ImportJob, PromotionLibrary, CropMaster, CropStage, ProductMaster
    import pandas as pd
    try:
        job = ImportJob.objects.get(id=import_job_id)
    except ImportJob.DoesNotExist:
        return {"status": "failed", "error": "Job not found"}

    try:
        df = pd.read_excel(job.filename)
    except Exception as e:
        job.status = 'Failed'
        job.error_report = [{"error": str(e)}]
        job.save()
        return {"status": "failed", "error": str(e)}

    total_rows = len(df)
    valid_rows = 0
    error_count = 0
    error_report = []

    required_columns = ['Title', 'ContentType', 'FileURL']
    expected_columns = required_columns + ['Crop', 'Stage', 'Product']
    
    df = normalize_dataframe_headers(df, expected_columns)
    
    if not all(col in df.columns for col in required_columns):
        job.status = 'Failed'
        job.error_report = [{"error": f"Missing required columns. Required: {required_columns}. Found: {', '.join(str(c) for c in df.columns)}"}]
        job.save()
        return {"status": "failed", "error": "Missing required columns"}

    for index, row in df.iterrows():
        try:
            title = str(row['Title']).strip()
            ctype = str(row['ContentType']).strip()
            url = str(row['FileURL']).strip()
            
            if ctype not in ['Video', 'Image', 'PDF', 'Link']:
                raise ValueError(f"Invalid ContentType: {ctype}")

            valid_rows += 1
        except Exception as e:
            error_count += 1
            error_report.append({"row": index + 2, "error": str(e)})

    job.total_rows = total_rows
    job.valid_rows = valid_rows
    job.error_count = error_count
    job.error_report = error_report
    job.status = 'Pending'
    job.save()

    return {"status": "validation_complete", "job_id": str(job.id)}

@shared_task
def commit_promotion_import(import_job_id):
    from .models import ImportJob, PromotionLibrary, CropMaster, CropStage, ProductMaster
    import pandas as pd
    try:
        job = ImportJob.objects.get(id=import_job_id)
    except ImportJob.DoesNotExist:
        return {"status": "failed", "error": "Job not found"}

    df = pd.read_excel(job.filename)
    created_count = 0

    for index, row in df.iterrows():
        try:
            title = str(row['Title']).strip()
            ctype = str(row['ContentType']).strip()
            url = str(row['FileURL']).strip()
            
            promo = PromotionLibrary.objects.create(
                title=title,
                content_type=ctype,
                file_url=url,
                status='Active'
            )

            if 'Crop' in df.columns and not pd.isna(row['Crop']):
                c_name = str(row['Crop']).strip()
                crop = CropMaster.objects.filter(crop_name=c_name).first()
                if crop: promo.crop = crop

            if 'Stage' in df.columns and not pd.isna(row['Stage']):
                s_name = str(row['Stage']).strip()
                stage = CropStage.objects.filter(stage_name=s_name).first()
                if stage: promo.stage = stage

            if 'Product' in df.columns and not pd.isna(row['Product']):
                p_name = str(row['Product']).strip()
                product, _ = ProductMaster.objects.get_or_create(name=p_name)
                promo.related_product = product
            
            promo.save()
            created_count += 1
        except:
            continue

    job.status = 'Completed'
    job.save()

    import os
    if os.path.exists(job.filename):
        os.remove(job.filename)

    return {"status": "import_complete", "created": created_count}

@shared_task
def scrape_apmc_rates():
    import requests
    from bs4 import BeautifulSoup
    import re
    from datetime import datetime
    from .models import CropMaster, MarketRate
    
    urls = [
        'https://apmcmumbai.org/bajarbhav/daily-bajarbhav-dates/veg',
        'https://apmcmumbai.org/bajarbhav/daily-bajarbhav-dates/fruit'
    ]
    
    total_scraped = 0
    total_saved = 0
    
    for url in urls:
        try:
            response = requests.get(url, timeout=10)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            date_str = None
            for h5 in soup.find_all('h5'):
                text = h5.get_text(strip=True)
                if 'बाजारभाव -' in text:
                    match = re.search(r'(\d{1,2})\s*([^,]+),\s*(\d{4})', text)
                    if match:
                        day, month_mr, year = match.groups()
                        month_map = {
                            'जाने': 1, 'फेब्रु': 2, 'मार्च': 3, 'एप्रिल': 4,
                            'मे': 5, 'मे.': 5, 'जून': 6, 'जून.': 6, 'जुलै': 7,
                            'ऑगस्ट': 8, 'सप्टें': 9, 'ऑक्टो': 10, 'नोव्हें': 11, 'डिसें': 12
                        }
                        m = month_map.get(month_mr.strip('. '), 1)
                        date_str = f"{year}-{m:02d}-{int(day):02d}"
                    break
            
            if not date_str:
                date_str = datetime.now().strftime("%Y-%m-%d")
                
            table = soup.find('table')
            if not table:
                continue
                
            tbody = table.find('tbody')
            if not tbody:
                continue
                
            for tr in tbody.find_all('tr'):
                cols = tr.find_all('td')
                if len(cols) >= 5:
                    crop_name_mr = cols[0].get_text(strip=True)
                    try:
                        inward_str = cols[1].get_text(strip=True)
                        inward_quantity = float(inward_str) if inward_str and inward_str.replace('.', '', 1).isdigit() else None
                        
                        min_price = float(cols[2].get_text(strip=True))
                        max_price = float(cols[3].get_text(strip=True))
                        avg_price = float(cols[4].get_text(strip=True))
                        
                        total_scraped += 1
                        
                        # Find matching crop
                        crop = CropMaster.objects.filter(marathi_name=crop_name_mr).first()
                        if crop:
                            MarketRate.objects.update_or_create(
                                crop=crop,
                                date=date_str,
                                defaults={
                                    'inward_quantity': inward_quantity,
                                    'min_price': min_price,
                                    'max_price': max_price,
                                    'avg_price': avg_price
                                }
                            )
                            total_saved += 1
                    except ValueError:
                        pass
        except Exception as e:
            print(f"Error scraping {url}: {e}")
            
    return {"status": "success", "scraped": total_scraped, "saved": total_saved}

@shared_task
def process_weather_bulk_push():
    """
    Evaluates weather forecast for active plots against WeatherRiskRule.
    Queues advisories as needed.
    (MVP Implementation - logs execution)
    """
    from .models import WeatherRiskRule, CropSeason, Plot
    from django.utils import timezone
    
    # In a full implementation, this would:
    # 1. Group active plots geographically
    # 2. Fetch IMD weather for each group
    # 3. Check WeatherRiskRule for crop/stage matches
    # 4. Queue advisory for those farmers
    
    print(f"[{timezone.now()}] Weather-Triggered Bulk Push evaluated. Waiting for IMD API integration.")
    return {"status": "success", "message": "Weather checks evaluated"}
