from celery import shared_task
import pandas as pd
from .models import Farmer, User, SystemAuditLog
import io

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

    required_columns = ['FullName', 'PrimaryMobile', 'Village', 'StaffMobile']
    if not all(col in df.columns for col in required_columns):
        job.status = 'Failed'
        job.error_report = [{"error": "Missing required columns"}]
        job.save()
        return {"status": "failed", "error": "Missing required columns"}

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
            
            # Resolve Staff
            if not User.objects.filter(mobile_number=staff_mobile).exists():
                raise ValueError(f"Staff with mobile {staff_mobile} not found")

            valid_rows += 1
        except Exception as e:
            error_count += 1
            error_report.append({"row": index + 2, "error": str(e)})

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
            staff_mobile = str(row['StaffMobile']).split('.')[0].strip()

            assigned_staff = User.objects.get(mobile_number=staff_mobile)
            
            farmer, created = Farmer.objects.update_or_create(
                primary_mobile=primary_mobile,
                defaults={
                    'full_name': full_name,
                    'village': village,
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
    if not all(col in df.columns for col in required_columns):
        job.status = 'Failed'
        job.error_report = [{"error": f"Missing required columns. Required: {required_columns}"}]
        job.save()
        return {"status": "failed", "error": "Missing required columns"}

    # Human-readable designation to system role mapping
    role_mapping = {
        'field staff': 'FieldStaff',
        'territory manager': 'TerritoryManager',
        'zonal manager': 'ZonalManager',
        'admin': 'Admin',
        'content team': 'ContentTeam'
    }
    roles = [r[0] for r in User.Role.choices]

    # Pre-fetch existing data for performance
    existing_mobiles = set(User.objects.values_list('mobile_number', flat=True))
    existing_territories = set(Territory.objects.values_list('name', flat=True))

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

    # 2. Check Stage Transitions
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
        "stage_transition_alerts_sent": stage_transitions_count
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
def execute_bulk_send_batch(batch_id):
    from .models import BulkSendBatch
    try:
        batch = BulkSendBatch.objects.get(id=batch_id)
        if batch.send_status != 'Pending':
            return {"status": "failed", "error": "Not in pending state"}
            
        batch.send_status = 'InProgress'
        batch.save(update_fields=['send_status'])
        
        sent = 0
        failed = 0
        # Iterate over farmer_ids
        for farmer_id in batch.farmer_ids:
            # Send message logic
            # E.g., check channel, hit Interakt/MSG91
            # Mock success for now
            sent += 1
            
        batch.sent_count = sent
        batch.failed_count = failed
        batch.send_status = 'Completed'
        batch.save(update_fields=['sent_count', 'failed_count', 'send_status'])
        
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
    if not all(col in df.columns for col in required_columns):
        job.status = 'Failed'
        job.error_report = [{"error": f"Missing required columns. Required: {required_columns}"}]
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
