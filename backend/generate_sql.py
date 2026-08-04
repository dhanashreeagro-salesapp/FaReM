import pandas as pd

csv_path = r'C:\Users\mdamo\Downloads\Supabase Snippet Export Users.csv'
df = pd.read_csv(csv_path)

sql_lines = [
    "-- SQL Migration Script to populate salesapp_user_id in core_user table",
    "ALTER TABLE core_user ADD COLUMN IF NOT EXISTS salesapp_user_id UUID;",
    ""
]

for idx, row in df.iterrows():
    salesapp_id = str(row['User ID']).strip() if pd.notna(row['User ID']) else None
    email = str(row['Email Address']).strip().lower() if pd.notna(row['Email Address']) else None
    
    if salesapp_id and email:
        sql_lines.append(f"UPDATE core_user SET salesapp_user_id = '{salesapp_id}' WHERE LOWER(email) = '{email}';")

with open('update_salesapp_user_ids.sql', 'w') as f:
    f.write("\n".join(sql_lines))

print(f"Generated update_salesapp_user_ids.sql with {len(sql_lines) - 3} UPDATE statements.")
