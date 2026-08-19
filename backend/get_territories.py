import psycopg2
import json
from urllib.parse import urlparse

url = 'postgresql://postgres.gfsladmfnhnglbftabkh:FuAkZCd5Jl4WQe4e@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres'
result = urlparse(url)
conn = psycopg2.connect(dbname=result.path[1:], user=result.username, password=result.password, host=result.hostname, port=result.port)
cur = conn.cursor()
cur.execute("SELECT id, name, parent_territory_id FROM core_territory")
records = [{'id': r[0], 'name': r[1], 'parent': r[2]} for r in cur.fetchall()]
with open('out.json', 'w') as f:
    json.dump(records, f, indent=2)
cur.close()
conn.close()
