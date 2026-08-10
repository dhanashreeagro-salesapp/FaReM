/**
 * Canonical Data Adapter & Normalizer for AgriAmigo Frontend.
 * Standardizes API responses across Dashboard, Hierarchy, and Farmer Management.
 */

export function normalizeHierarchyNode(rawNode) {
  if (!rawNode || typeof rawNode !== 'object') return null;

  const rawChildren = rawNode.children || rawNode.subordinates || rawNode.nodes || [];
  const children = Array.isArray(rawChildren)
    ? rawChildren.map(normalizeHierarchyNode).filter(Boolean)
    : [];

  return {
    id: String(rawNode.id || rawNode.user_id || rawNode.email || Math.random()),
    name: rawNode.full_name || rawNode.name || rawNode.email || 'Staff Member',
    email: rawNode.email || '',
    role: rawNode.role || 'Field Staff',
    territoryName: rawNode.territory_name || rawNode.territory || 'Territory',
    farmerCount: Number(rawNode.farmer_count ?? rawNode.farmers_count ?? 0),
    plotCount: Number(rawNode.plot_count ?? rawNode.plots_count ?? 0),
    activeCropCount: Number(rawNode.crop_count ?? rawNode.active_crops_count ?? 0),
    visitsCount: Number(rawNode.visits_count ?? 0),
    callsCount: Number(rawNode.calls_count ?? 0),
    recommendationsCount: Number(rawNode.recommendations_count ?? 0),
    whatsappCount: Number(rawNode.whatsapp_count ?? 0),
    performancePct: Number(rawNode.performance_pct ?? 100),
    children
  };
}

export function normalizeHierarchyResponse(res) {
  if (!res) return [];
  if (Array.isArray(res)) {
    return res.map(normalizeHierarchyNode).filter(Boolean);
  }
  if (typeof res === 'object') {
    if (Array.isArray(res.results)) {
      return res.results.map(normalizeHierarchyNode).filter(Boolean);
    }
    const root = normalizeHierarchyNode(res);
    return root ? [root] : [];
  }
  return [];
}

export function normalizeDashboardMetrics(rawData) {
  if (!rawData || typeof rawData !== 'object') return null;

  return {
    totalFarmers: Number(rawData.total_farmers ?? rawData.active_farmers ?? 0),
    totalPlots: Number(rawData.total_plots ?? 0),
    activeCrops: Number(rawData.active_crops ?? rawData.active_crop_seasons ?? 0),
    totalVisits: Number(rawData.total_visits ?? 0),
    totalCalls: Number(rawData.total_calls ?? 0),
    overdueVisits: Number(rawData.overdue_visits ?? 0),
    thisMonthFarmers: Number(rawData.this_month_farmers ?? 0),
    lastMonthFarmers: Number(rawData.last_month_farmers ?? 0),
    ytdFarmers: Number(rawData.ytd_farmers ?? 0),
    topVillages: Array.isArray(rawData.top_villages) ? rawData.top_villages : [],
    cropStageBreakup: rawData.crop_stage_breakup || {},
    marketTrends: Array.isArray(rawData.market_trends) ? rawData.market_trends : [],
    debugTrace: rawData.debug_trace || null,
    rawKeys: Object.keys(rawData)
  };
}
