import requests
from bs4 import BeautifulSoup
import re
from datetime import datetime

def scrape_apmc(url, category):
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')
    
    # Extract date from h5 tag: "बाजारभाव - (गुरूवार, 11 जून., 2026)"
    date_str = None
    for h5 in soup.find_all('h5'):
        text = h5.get_text(strip=True)
        if 'बाजारभाव -' in text:
            # e.g., बाजारभाव - (गुरूवार, 11 जून., 2026)
            match = re.search(r'(\d{1,2})\s*([^,]+),\s*(\d{4})', text)
            if match:
                day, month_mr, year = match.groups()
                month_map = {
                    'जाने': 1, 'फेब्रु': 2, 'मार्च': 3, 'एप्रिल': 4,
                    'मे': 5, 'मे.': 5, 'जून': 6, 'जून.': 6, 'जुलै': 7,
                    'ऑगस्ट': 8, 'सप्टें': 9, 'ऑक्टो': 10, 'नोव्हें': 11, 'डिसें': 12
                }
                m = month_map.get(month_mr.strip('. '), 1)
                date_str = f"{year}-{m:02d}-{int(day):02d}"
            break
            
    if not date_str:
        print("Date not found, using today")
        date_str = datetime.now().strftime("%Y-%m-%d")
        
    print(f"Date: {date_str}")
    
    table = soup.find('table')
    if not table:
        print("Table not found")
        return []
        
    tbody = table.find('tbody')
    rates = []
    
    for tr in tbody.find_all('tr'):
        cols = tr.find_all('td')
        if len(cols) >= 5:
            crop_name = cols[0].get_text(strip=True)
            try:
                min_price = float(cols[2].get_text(strip=True))
                max_price = float(cols[3].get_text(strip=True))
                avg_price = float(cols[4].get_text(strip=True))
                rates.append({
                    "crop": crop_name,
                    "min": min_price,
                    "max": max_price,
                    "avg": avg_price
                })
            except ValueError:
                pass
                
    return rates

if __name__ == '__main__':
    veg_rates = scrape_apmc('https://apmcmumbai.org/bajarbhav/daily-bajarbhav-dates/veg', 'veg')
    print(f"Scraped {len(veg_rates)} veg rates. Sample: {veg_rates[:3]}")
    
    fruit_rates = scrape_apmc('https://apmcmumbai.org/bajarbhav/daily-bajarbhav-dates/fruit', 'fruit')
    print(f"Scraped {len(fruit_rates)} fruit rates. Sample: {fruit_rates[:3]}")
