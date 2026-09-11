import re

with open('../web/src/services/api.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacement_method = """  clearCache(cacheKey) {
    const userEmail = localStorage.getItem('ffma_email') || 'anon';
    localStorage.removeItem(`ffma_cache_${userEmail}_${cacheKey}`);
  }

  clearTokens() {"""

content = content.replace("  clearTokens() {", replacement_method)
content = re.sub(r"localStorage\.removeItem\('cache_([a-z_]+)'\);", r"this.clearCache('cache_\1');", content)

with open('../web/src/services/api.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("api.js cache bug fixed")
