import psycopg2
from urllib.parse import urlparse

url = "postgresql://postgres.gfsladmfnhnglbftabkh:FuAkZCd5Jl4WQe4e@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"

result = urlparse(url)

conn = psycopg2.connect(
    dbname=result.path[1:],
    user=result.username,
    password=result.password,
    host=result.hostname,
    port=result.port
)
cur = conn.cursor()

emails = ['dhanashree.agro@gmail.com', 'dhanashree.agro@plantnutrition.in', 'bwaghachaure@plantnutrition.in', 'bwaghchaure@plantnutrition.in']
for email in emails:
    cur.execute("SELECT email, status, locked_until, failed_otp_attempts FROM core_user WHERE email ILIKE %s", (email,))
    user = cur.fetchone()
    if user:
        print(f"[{email}] DB Entry: email={user[0]}, status={user[1]}, locked_until={user[2]}, failed_attempts={user[3]}")
    else:
        print(f"[{email}] NOT FOUND IN DB!")

cur.close()
conn.close()
