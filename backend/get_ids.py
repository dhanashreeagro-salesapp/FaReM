import psycopg2
from urllib.parse import urlparse

url = 'postgresql://postgres.gfsladmfnhnglbftabkh:FuAkZCd5Jl4WQe4e@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres'
result = urlparse(url)
conn = psycopg2.connect(dbname=result.path[1:], user=result.username, password=result.password, host=result.hostname, port=result.port)
cur = conn.cursor()
cur.execute("SELECT id, full_name, assigned_staff_id, territory_id FROM core_farmer WHERE full_name ILIKE '%Ajit%'")
print('Farmers:')
for row in cur.fetchall():
    print(row)
cur.close()
conn.close()
