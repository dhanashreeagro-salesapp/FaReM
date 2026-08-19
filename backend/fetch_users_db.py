import psycopg2
from urllib.parse import urlparse

url = "postgresql://postgres.gfsladmfnhnglbftabkh:FuAkZCd5Jl4WQe4e@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"

result = urlparse(url)
username = result.username
password = result.password
database = result.path[1:]
hostname = result.hostname
port = result.port

conn = psycopg2.connect(
    dbname=database,
    user=username,
    password=password,
    host=hostname,
    port=port
)
cur = conn.cursor()

cur.execute("SELECT first_name, last_name, email, role FROM core_user ORDER BY first_name, last_name;")
users = cur.fetchall()

with open('users_list.md', 'w', encoding='utf-8') as f:
    f.write('# Users List\n\n')
    f.write('| Full Name | Email (Username) | Role | Password |\n')
    f.write('|---|---|---|---|\n')
    for u in users:
        fname = u[0] or ''
        lname = u[1] or ''
        name = f'{fname} {lname}'.strip()
        email = u[2]
        role = u[3]
        f.write(f'| {name} | {email} | {role} | Welcome@123 |\n')

print("Wrote to users_list.md")
cur.close()
conn.close()
