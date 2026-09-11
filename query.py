import sqlite3
import os

db_path = os.path.join('backend', 'db.sqlite3')
print(f"Connecting to {db_path}")
conn = sqlite3.connect(db_path)
c = conn.cursor()

# First check if the table exists
c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='core_marketpricerecord';")
if not c.fetchone():
    print("Table core_marketpricerecord does not exist in this database.")
else:
    c.execute("SELECT COUNT(*) FROM core_marketpricerecord WHERE date LIKE '2026-%'")
    count = c.fetchone()[0]
    print(f"Number of 2026 records in market prices table: {count}")
    
    if count > 0:
        c.execute("SELECT date FROM core_marketpricerecord WHERE date LIKE '2026-%' LIMIT 5")
        print("Sample dates:", c.fetchall())
