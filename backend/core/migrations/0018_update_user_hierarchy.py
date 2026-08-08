from django.db import migrations

def update_hierarchy(apps, schema_editor):
    User = apps.get_model('core', 'User')

    role_map = {
        'siddhi@plantnutrition.in': 'Admin',
        'skhokrale@plantnutrition.in': 'ZonalManager',
        'skhokarle@plantnutrition.in': 'ZonalManager',
        'rahul@plantnutrition.in': 'ZonalManager',
        'sgiri@plantnutrition.in': 'TerritoryManager',
        'gtale@plantnutrition.in': 'FieldStaff',
        'vbhagre@plantnutrition.in': 'FieldStaff',
    }

    for email, role in role_map.items():
        User.objects.filter(email=email).update(role=role)

    h_map = {
        'skhokrale@plantnutrition.in': 'siddhi@plantnutrition.in',
        'skhokarle@plantnutrition.in': 'siddhi@plantnutrition.in',
        'rahul@plantnutrition.in': 'skhokrale@plantnutrition.in',
        'sgiri@plantnutrition.in': 'rahul@plantnutrition.in',
        'gtale@plantnutrition.in': 'sgiri@plantnutrition.in',
        'vbhagre@plantnutrition.in': 'sgiri@plantnutrition.in',
        'nrajput@plantnutrition.in': 'sgiri@plantnutrition.in',
        'ogaikar@plantnutrition.in': 'sgiri@plantnutrition.in',
        'vnikumbe@plantnutrition.in': 'sgiri@plantnutrition.in',
        'sdherange@plantnutrition.in': 'sgiri@plantnutrition.in',
        'rborse@plantnutrition.in': 'gtale@plantnutrition.in',
        'bwaghachaure@plantnutrition.in': 'vbhagre@plantnutrition.in',
        'asangale@plantnutrition.in': 'rahul@plantnutrition.in',
        'anilgawande@plantnutrition.in': 'rahul@plantnutrition.in',
        'pravin@plantnutrition.in': 'rahul@plantnutrition.in',
        'abhay@plantnutrition.in': 'rahul@plantnutrition.in',
        'kswamy@agroiq.com': 'rahul@plantnutrition.in',
        'knikam@plantnutrition.in': 'rahul@plantnutrition.in',
        'vmore@plantnutrition.in': 'rahul@plantnutrition.in',
        'shridhar@plantnutrition.in': 'rahul@plantnutrition.in',
        'sbade@plantnutrition.in': 'rahul@plantnutrition.in',
        'ppravin@plantnutrition.in': 'rahul@plantnutrition.in',
        'manoj@plantnutrition.in': 'pravin@plantnutrition.in',
        'avinashpatil@plantnutrition.in': 'pravin@plantnutrition.in',
        'jdeshmukh@plantnutrition.in': 'pravin@plantnutrition.in',
        'single@plantnutrition.in': 'pravin@plantnutrition.in',
        'srupnar@plantnutrition.in': 'pravin@plantnutrition.in',
        'apisal@plantnutrition.in': 'jdeshmukh@plantnutrition.in',
        'surajpatil@plantnutrition.in': 'single@plantnutrition.in',
        'pwagh@plantnutrition.in': 'knikam@plantnutrition.in',
        'jbhangale@plantnutrition.in': 'knikam@plantnutrition.in',
        'sharagbal@plantnutrition.in': 'vmore@plantnutrition.in',
        'mgund@plantnutrition.in': 'vishalmore@plantnutrition.in',
        'gsakhare@plantnutrition.in': 'ppravin@plantnutrition.in',
        'ksatpute@plantnutrition.in': 'ppravin@plantnutrition.in',
        'vishalmore@plantnutrition.in': 'ppravin@plantnutrition.in',
        'dpawar@plantnutrition.in': 'shridhar@plantnutrition.in',
        'vdahiphale@plantnutrition.in': 'anilgawande@plantnutrition.in'
    }

    for sub_email, mgr_email in h_map.items():
        try:
            mgr = User.objects.get(email=mgr_email)
            User.objects.filter(email=sub_email).update(reporting_manager=mgr)
        except User.DoesNotExist:
            pass

def reverse_func(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0017_add_performance_indexes_and_creation_fields'),
    ]

    operations = [
        migrations.RunPython(update_hierarchy, reverse_func),
    ]
