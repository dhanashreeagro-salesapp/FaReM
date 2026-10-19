from django.db import migrations

def populate_reporting_hierarchy(apps, schema_editor):
    User = apps.get_model('core', 'User')

    # Mapping of subordinate email to manager email (case-insensitive)
    h_map = {
        # Zonal Manager & Head Office Staff -> Admin
        'rahul@plantnutrition.in': 'mahesh@plantnutition.in',
        'abagate@plantnutrition.in': 'mahesh@plantnutition.in',
        'skhokrale@plantnutrition.in': 'mahesh@plantnutition.in',
        'sbarhate@plantnutrition.in': 'mahesh@plantnutition.in',
        'ravindra@plantnutrition.in': 'mahesh@plantnutition.in',

        # Territory Managers -> Rahul Sawant (Zonal Manager)
        'sbade@plantnutrition.in': 'rahul@plantnutrition.in',
        'anilgawande@plantnutrition.in': 'rahul@plantnutrition.in',
        'vdahiphale@plantnutrition.in': 'rahul@plantnutrition.in',
        'abhay@plantnutrition.in': 'rahul@plantnutrition.in',
        'knikam@plantnutrition.in': 'rahul@plantnutrition.in',
        'asangale@plantnutrition.in': 'rahul@plantnutrition.in',
        'pbhamare@plantnutrition.in': 'rahul@plantnutrition.in',
        'pravinsangli@plantnutrition.in': 'rahul@plantnutrition.in',
        'pravin@plantnutrition.in': 'rahul@plantnutrition.in',
        'vmore@plantnutrition.in': 'rahul@plantnutrition.in',

        # Under Vikas More
        'blage@plantnutrition.in': 'vmore@plantnutrition.in',
        'sharagbal@plantnutrition.in': 'vmore@plantnutrition.in',
        'smeher@plantnutrition.in': 'vmore@plantnutrition.in',
        'mwaykar@plantnutrition.in': 'vmore@plantnutrition.in',

        # Under Pramod Bhamare
        'vbhagre@plantnutrition.in': 'pbhamare@plantnutrition.in',
        'gtale@plantnutrition.in': 'pbhamare@plantnutrition.in',
        'sdherange@plantnutrition.in': 'pbhamare@plantnutrition.in',
        'nrajput@plantnutrition.in': 'pbhamare@plantnutrition.in',
        'ogaikar@plantnutrition.in': 'pbhamare@plantnutrition.in',
        'vnikumbe@plantnutrition.in': 'pbhamare@plantnutrition.in',

        # Under Vishnu Bhagare
        'bwaghchaure@plantnutrition.in': 'vbhagre@plantnutrition.in',

        # Under Gajanan Tale
        'ntijare@plantnutrition.in': 'gtale@plantnutrition.in',
        'nwagh@plantnutrition.in': 'gtale@plantnutrition.in',
        'rborse@plantnutrition.in': 'gtale@plantnutrition.in',

        # Under Nitin Rajput (Satana)
        'csalunke@plantnutrition.in': 'nrajput@plantnutrition.in',

        # Under Sandip Dherange (Sangamner)
        'sgadakh@plantnutrition.in': 'sdherange@plantnutrition.in',

        # Under Vishal Nikumbe (Shahada)
        'vpatil@plantnutrition.in': 'vnikumbe@plantnutrition.in',

        # Under Shahadev Bade
        'agondhale@plantnutrition.in': 'sbade@plantnutrition.in',
        'dsangale@plantnutrition.in': 'sbade@plantnutrition.in',
        'snawal@plantnutrition.in': 'sbade@plantnutrition.in',
        'vbirute@plantnutrition.in': 'sbade@plantnutrition.in',
        # Under Dipak Sangale (Shrigonda DS)
        'asaware@plantnutrition.in': 'dsangale@plantnutrition.in',

        # Under Anil Gawande
        'rhembade@plantnutrition.in': 'anilgawande@plantnutrition.in',
        'svasule@plantnutrition.in': 'anilgawande@plantnutrition.in',

        # Under Abhay Rathi
        'a.daga@plantnutrition.in': 'abhay@plantnutrition.in',
        'agayake@plantnutrition.in': 'abhay@plantnutrition.in',
        'kpawar@plantnutrition.in': 'abhay@plantnutrition.in',
        'kgaikwad@plantnutrition.in': 'abhay@plantnutrition.in',
        'pdhole@plantnutrition.in': 'abhay@plantnutrition.in',
        'ukedare@plantnutrition.in': 'abhay@plantnutrition.in',
        'vshinde@plantnutrition.in': 'abhay@plantnutrition.in',
        # Under Abhishek Daga (Lasur)
        'ssahane@plantnutrition.in': 'a.daga@plantnutrition.in',
        # Under Kishor Pawar (Verul)
        'mjadhav@plantnutrition.in': 'kpawar@plantnutrition.in',
        'ygaikwad@plantnutrition.in': 'kpawar@plantnutrition.in',
        # Under Vishal Shinde (Bhokardan)
        'mpatil@plantnutrition.in': 'vshinde@plantnutrition.in',
        'azanak@plantnutrition.in': 'vshinde@plantnutrition.in',

        # Under Kiran Nikam
        'bgadhule@plantnutrition.in': 'knikam@plantnutrition.in',
        'gpatil@plantnutrition.in': 'knikam@plantnutrition.in',
        'jbhangale@plantnutrition.in': 'knikam@plantnutrition.in',
        'pwagh@plantnutrition.in': 'knikam@plantnutrition.in',
        'sbaviskar@plantnutrition.in': 'knikam@plantnutrition.in',

        # Under Ambadas Sangale
        'lshirure@plantnutrition.in': 'asangale@plantnutrition.in',
        'schavan@plantnutrition.in': 'asangale@plantnutrition.in',

        # Under Pravin Patil (Sangli)
        'avinashpatil@plantnutrition.in': 'pravinsangli@plantnutrition.in',
        'jdeshmukh@plantnutrition.in': 'pravinsangli@plantnutrition.in',
        'kpatil@plantnutrition.in': 'pravinsangli@plantnutrition.in',
        'manoj@plantnutrition.in': 'pravinsangli@plantnutrition.in',
        'single@plantnutrition.in': 'pravinsangli@plantnutrition.in',
        'srupnar@plantnutrition.in': 'pravinsangli@plantnutrition.in',
        # Under Jeevan Deshmukh (Satara)
        'apisal@plantnutrition.in': 'jdeshmukh@plantnutrition.in',
        'vjagadale@plantnutrition.in': 'jdeshmukh@plantnutrition.in',
        # Under Manoj Patil (Baramati)
        'jwadkar@plantnutrition.in': 'manoj@plantnutrition.in',
        # Under Shubham Ingle (Tasgaon)
        'surajpatil@plantnutrition.in': 'single@plantnutrition.in',

        # Under Pravin Patil (Solapur)
        'dpawar@plantnutrition.in': 'pravin@plantnutrition.in',
        'gsakhare@plantnutrition.in': 'pravin@plantnutrition.in',
        'ksatpute@plantnutrition.in': 'pravin@plantnutrition.in',
        'shridhar@plantnutrition.in': 'pravin@plantnutrition.in',
        'vishalmore@plantnutrition.in': 'pravin@plantnutrition.in',
        # Under Vishal More (Solapur VM)
        'mgund@plantnutrition.in': 'vishalmore@plantnutrition.in',
    }

    # Fetch all users into a map for fast lookup
    all_users = {u.email.lower(): u for u in User.objects.all()}

    for sub_email, mgr_email in h_map.items():
        sub_user = all_users.get(sub_email.lower())
        mgr_user = all_users.get(mgr_email.lower())
        if sub_user and mgr_user:
            User.objects.filter(id=sub_user.id).update(reporting_manager_id=mgr_user.id)

def reverse_func(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0027_promotionlibrary_crops_promotionlibrary_stages_and_more'),
    ]

    operations = [
        migrations.RunPython(populate_reporting_hierarchy, reverse_func),
    ]
