import psycopg2
from urllib.parse import urlparse

url = 'postgresql://postgres.gfsladmfnhnglbftabkh:FuAkZCd5Jl4WQe4e@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres'
result = urlparse(url)
conn = psycopg2.connect(dbname=result.path[1:], user=result.username, password=result.password, host=result.hostname, port=result.port)
cur = conn.cursor()

cur.execute("UPDATE core_territory SET parent_territory_id = NULL WHERE id = '187cd358-5149-4349-ad82-189ee67f0843'")
conn.commit()

print("Rows updated:", cur.rowcount)
cur.close()
conn.close()
