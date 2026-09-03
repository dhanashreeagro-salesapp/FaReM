import re
with open('web/src/pages/MarketIntelligence.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = re.sub(r',1', '?', c)
c = re.sub(r'dY` Tap', '?? Tap', c)
c = re.sub(r'<span className="text-xl">.*?</span>', '<span className="text-xl">???</span>', c)

with open('web/src/pages/MarketIntelligence.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

with open('web/src/pages/DashboardV2.jsx', 'r', encoding='utf-8') as f:
    d = f.read()
d = re.sub(r',1', '?', d)
d = re.sub(r'\+`', '?', d)
d = re.sub(r'\+"', '?', d)
with open('web/src/pages/DashboardV2.jsx', 'w', encoding='utf-8') as f:
    f.write(d)
