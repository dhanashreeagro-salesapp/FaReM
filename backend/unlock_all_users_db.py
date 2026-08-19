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

# Reset all locks!
cur.execute("UPDATE core_user SET locked_until = NULL, failed_otp_attempts = 0;")
conn.commit()
print(f"Successfully unlocked {cur.rowcount} users directly in the database!")

cur.close()
conn.close()
