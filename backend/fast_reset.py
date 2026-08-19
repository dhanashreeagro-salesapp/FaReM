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

new_hash = 'pbkdf2_sha256$1000000$ZOimwmHlEffc6CODRcpwhf$hCYAlcK/zD8zpYU5foVB0M159h4NkP6Xkw4rEkiVBJg='

cur.execute("UPDATE core_user SET password = %s", (new_hash,))
conn.commit()
print(f"Force reset {cur.rowcount} users' passwords to Welcome@123 directly in DB!")

cur.close()
conn.close()
