import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ffma.settings')
django.setup()

import pandas as pd
from core.tasks import validate_user_import, commit_user_import
from core.models import ImportJob, User

# Create a dummy import job with a fake Excel file
df = pd.DataFrame([{
    'Employee ID': 'EMP001',
    'Name': 'Test User',
    'Mobile Number': '8888888888',
    'Designation': 'Field Staff',
    'Territory': 'Pune',
    'Email': 'test@example.com'
}])
filename = 'test_import.xlsx'
df.to_excel(filename, index=False)

job = ImportJob.objects.create(
    filename=filename,
    status='Processing',
    created_by=User.objects.first()
)

print('Validating...')
res = validate_user_import(str(job.id))
print('Validation Result:', res)

job.refresh_from_db()
print('Job Status:', job.status)
print('Job Valid Rows:', job.valid_rows)
print('Job Error Report:', job.error_report)

# Now check if it complains about Name and Mobile Number
