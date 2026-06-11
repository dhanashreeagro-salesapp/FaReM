from celery import shared_task
import pandas as pd
from .models import Farmer, User, SystemAuditLog
import io

def normalize_dataframe_headers(df, expected_columns):
    req_lower = [c.lower() for c in expected_columns]
    current_cols = [str(c).lower().strip() for c in df.columns]
    
    header_found = False
    # If at least 2 expected columns match, we assume we found the header
    if sum([1 for r in req_lower if r in current_cols]) >= 2:
        header_found = True
    else:
        # Search the first 20 rows
        for index, row in df.head(20).iterrows():
            row_values = [str(v).lower().strip() for v in row.values]
            if sum([1 for r in req_lower if r in row_values]) >= 2:
                df.columns = row.values
                df = df.iloc[index+1:].reset_index(drop=True)
                header_found = True
                break

    if header_found:
        col_map = {}
        for c in df.columns:
            cl = str(c).lower().strip()
            for r in expected_columns:
                if cl == r.lower():
                    col_map[c] = r
                    break
        df = df.rename(columns=col_map)
        
    df = df.dropna(how='all')
    return df

@shared_task
def validate_farmer_import(import_job_id):
    from .models import ImportJob, User
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

    required_columns = ['FullName', 'PrimaryMobile', 'Village', 'Taluka', 'District', 'State', 'PinCode', 'StaffMobile']
    
    df = normalize_dataframe_headers(df, required_columns)
    
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
            primary_mobile = str(row['PrimaryMobile']).split('.')[0].strip()
            staff_mobile = str(row['StaffMobile']).split('.')[0].strip()

            if len(primary_mobile) > 15 or len(primary_mobile) < 10:
                raise ValueError("Invalid PrimaryMobile format")

            # Check for duplicates in the file itself (optional) or in DB
            from .models import Farmer
            if Farmer.objects.filter(primary_mobile=primary_mobile).exists():
                duplicate_count += 1
                if df.at[index, 'Import Status'] == 'SUCCESS':
                    df.at[index, 'Import Status'] = 'DUPLICATE (Will be updated)'
            
            # Resolve Staff
            if not User.objects.filter(mobile_number=staff_mobile).exists():
                raise ValueError(f"Staff with mobile {staff_mobile} not found")

            valid_rows += 1
        except Exception as e:
            error_count += 1
            error_report.append({"row": index + 2, "error": str(e)})
            df.at[index, 'Import Status'] = f"ERROR: {str(e)}"

    try:
        with pd.ExcelWriter(job.filename, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
    except Exception as e:
        pass # If we fail to write the status back, we can ignore it and continue

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
    from .models import ImportJob, User, Farmer
    try:
        job = ImportJob.objects.get(id=import_job_id)
    except ImportJob.DoesNotExist:
        return {"status": "failed", "error": "Job not found"}

    df = pd.read_excel(job.filename)
    created_count = 0
    updated_count = 0

    for index, row in df.iterrows():
        try:
            full_name = str(row['FullName']).strip()
            primary_mobile = str(row['PrimaryMobile']).split('.')[0].strip()
            village = str(row['Village']).strip()
            taluka = str(row.get('Taluka', '')).strip()
            district = str(row.get('District', '')).strip()
            state = str(row.get('State', '')).strip()
            pin_code = str(row.get('PinCode', '')).split('.')[0].strip()
            staff_mobile = str(row['StaffMobile']).split('.')[0].strip()

            assigned_staff = User.objects.get(mobile_number=staff_mobile)
            
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
                    'source': 'BulkImport',
                    'territory': assigned_staff.territory
                }
            )

            if created:
                created_count += 1
            else:
                updated_count += 1
        except:
            continue

    job.status = 'Completed'
    job.save()

    # Clean up file
    import os
    if os.path.exists(job.filename):
        os.remove(job.filename)

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

    required_columns = ['Employee ID', 'Name', 'Mobile Number', 'Designation']
    expected_columns = required_columns + ['Territory']
    
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
    roles = [r[0] for r in User.Role.choices]

    existing_mobiles = set(User.objects.values_list('mobile_number', flat=True))
    existing_territories = set(Territory.objects.values_list('name', flat=True))

    df['Import Status'] = 'SUCCESS'

    for index, row in df.iterrows():
        try:
            mobile = str(row['Mobile Number']).split('.')[0].strip()
            
            # Map human-readable designation to system role if necessary
            designation = str(row['Designation']).strip().lower()
            role = role_mapping.get(designation, str(row['Designation']).strip())
            
            if len(mobile) != 10 or not mobile.isdigit():
                raise ValueError("Mobile Number must be exactly 10 digits")

            if role not in roles:
                raise ValueError(f"Invalid Designation: {str(row['Designation'])}. Must map to one of {roles}")

            if mobile in existing_mobiles:
                duplicate_count += 1
                if df.at[index, 'Import Status'] == 'SUCCESS':
                    df.at[index, 'Import Status'] = 'DUPLICATE (Will be updated)'
            
            # Check territory if provided
            if 'Territory' in df.columns and not pd.isna(row['Territory']):
                t_name = str(row['Territory']).strip()
                if t_name not in existing_territories:
                    raise ValueError(f"Territory '{t_name}' not found")

            valid_rows += 1
        except Exception as e:
            error_count += 1
            error_report.append({"row": index + 2, "error": str(e)})

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
            name_parts = str(row['Name']).strip().split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            mobile = str(row['Mobile Number']).split('.')[0].strip()
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

            if mobile in existing_users:
                user = existing_users[mobile]
                user.first_name = first_name
                user.last_name = last_name
                user.employee_id = employee_id
                user.role = role
                user.territory = territory
                user.status = 'Active'
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
                    status='Active'
                )
                users_to_create.append(user)
                created_count += 1
        except:
            continue

    if users_to_create:
        User.objects.bulk_create(users_to_create, batch_size=500)
    if users_to_update:
        User.objects.bulk_update(users_to_update, ['first_name', 'last_name', 'employee_id', 'role', 'territory', 'status'], batch_size=500)

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

@shared_task
def dispatch_recommendation_msg(recommendation_id):
    from .models import Recommendation
    try:
        rec = Recommendation.objects.get(id=recommendation_id)
        
        # Determine the channel and dispatch to respective API
        # Mocking the external API calls
        success = True
        
        if rec.channel == 'WhatsApp':
            # Call Interakt API
            pass
        elif rec.channel == 'SMS':
            # Call MSG91 API
            pass
            
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
        # Iterate over farmer_ids
        for farmer_id in batch.farmer_ids:
            # Mock success for now
            sent += 1
            
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
