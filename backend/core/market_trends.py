"""
Shared, query-efficient market trend helpers.

Replaces per-crop N+1 aggregate queries with a constant number of bulk queries,
and caches results (invalidated whenever a market import completes).
"""
import datetime
import hashlib
from collections import defaultdict

from django.core.cache import cache
from django.db.models import Avg, Max

CACHE_TTL = 15 * 60
VERSION_KEY = 'market_trends_version'


def _version():
    v = cache.get(VERSION_KEY)
    if v is None:
        v = 1
        cache.set(VERSION_KEY, v, None)
    return v


def invalidate_market_cache():
    """Call after any market data import / mapping change."""
    try:
        cache.incr(VERSION_KEY)
    except ValueError:
        cache.set(VERSION_KEY, 2, None)


def _cache_key(prefix, crop_ids):
    ids = ','.join(sorted(str(c) for c in crop_ids))
    digest = hashlib.md5(ids.encode()).hexdigest()
    return f'{prefix}:v{_version()}:{digest}'


def daily_avg_by_crop(crop_ids, lookback_days):
    """
    Returns ({crop_id: latest_date}, {crop_id: {date: avg_modal}}) using 2 queries.
    Daily averages cover each crop's window [latest - lookback_days, latest].
    """
    from .models import MarketPriceRecord

    latest = dict(
        MarketPriceRecord.objects.filter(crop_id__in=crop_ids)
        .values('crop_id').annotate(d=Max('date')).values_list('crop_id', 'd')
    )
    latest = {k: v for k, v in latest.items() if v}
    if not latest:
        return {}, {}

    from django.db.models import Q
    window_q = Q()
    for cid, ldate in latest.items():
        window_q |= Q(crop_id=cid, date__gte=ldate - datetime.timedelta(days=lookback_days), date__lte=ldate)
    rows = (
        MarketPriceRecord.objects
        .filter(window_q)
        .values('crop_id', 'date').annotate(avg=Avg('modal_price'))
    )
    daily = defaultdict(dict)
    for r in rows:
        daily[r['crop_id']][r['date']] = float(r['avg']) if r['avg'] is not None else None
    return latest, daily


def _window_avg(day_map, start, end):
    """Mean of daily averages in range — weighted by day (approximation of row avg)."""
    vals = [v for d, v in day_map.items() if start <= d <= end and v is not None]
    return sum(vals) / len(vals) if vals else None


def _raw_trends(crop_ids):
    """Cached {crop_id: (latest_date, latest_avg, trend, pct)} — name independent."""
    key = _cache_key('mt_raw', crop_ids)
    cached = cache.get(key)
    if cached is not None:
        return cached

    latest, daily = daily_avg_by_crop(crop_ids, lookback_days=36)
    result = {}
    for cid, ldate in latest.items():
        latest_avg = daily.get(cid, {}).get(ldate)
        if not latest_avg:
            continue
        target = ldate - datetime.timedelta(days=30)
        prior_avg = _window_avg(
            daily.get(cid, {}),
            target - datetime.timedelta(days=5),
            target + datetime.timedelta(days=5),
        )
        trend, pct = 'FLAT', 0.0
        if prior_avg and prior_avg > 0:
            diff = latest_avg - prior_avg
            pct = round(abs(diff / prior_avg * 100), 2)
            trend = 'UP' if diff > 0 else ('DOWN' if diff < 0 else 'FLAT')
        result[cid] = (ldate, latest_avg, trend, pct)
    cache.set(key, result, CACHE_TTL)
    return result


def get_dashboard_market_trends(crop_ids, crop_name_map):
    """
    Same output contract as the original DashboardAPIView market_trends block:
    latest-date average vs. ~30 days prior (±5 day window).
    """
    crop_ids = [c for c in crop_ids if c]
    if not crop_ids:
        return []
    trends = []
    for cid, (ldate, latest_avg, trend, pct) in _raw_trends(crop_ids).items():
        name = crop_name_map.get(cid)
        if not name:
            continue
        trends.append({
            'crop_name': name,
            'latest_price': round(latest_avg, 2),
            'date': ldate.isoformat(),
            'trend': trend,
            'percentage_change': pct,
        })
    return trends
