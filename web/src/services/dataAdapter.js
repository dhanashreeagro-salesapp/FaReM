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
    cropCount: Number(rawNode.crop_count ?? rawNode.active_crops_count ?? 0),
    visitsCount: Number(rawNode.visits_count ?? rawNode.total_visits ?? 0),
    overdueVisits: Number(rawNode.overdue_visits ?? rawNode.overdue_count ?? 0),
    farmersAddedThisMonth: Number(rawNode.farmers_added_this_month ?? rawNode.this_month_farmers ?? 0),
    farmersAddedLastMonth: Number(rawNode.farmers_added_last_month ?? rawNode.last_month_farmers ?? 0),
    farmersAddedThisYear: Number(rawNode.farmers_added_this_year ?? rawNode.ytd_farmers ?? 0),
    directFarmerCount: Number(rawNode.direct_farmer_count ?? 0),
    directCropCount: Number(rawNode.direct_crop_count ?? 0),
    directVisitsCount: Number(rawNode.direct_visits_count ?? 0),
    directOverdueVisits: Number(rawNode.direct_overdue_visits ?? 0),
    directFarmersAddedThisMonth: Number(rawNode.direct_farmers_added_this_month ?? 0),
    directFarmersAddedLastMonth: Number(rawNode.direct_farmers_added_last_month ?? 0),
    directFarmersAddedThisYear: Number(rawNode.direct_farmers_added_this_year ?? 0),
    subordinatesCount: Number(rawNode.subordinates_count ?? children.length),
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
    totalFarmers: rawData.total_farmers ?? rawData.active_farmers ?? null,
    totalPlots: rawData.total_plots ?? null,
    activeCrops: rawData.active_crops ?? rawData.active_crop_seasons ?? null,
    totalVisits: rawData.total_visits ?? null,
    totalCalls: rawData.total_calls ?? null,
    overdueVisits: rawData.overdue_visits ?? null,
    thisMonthFarmers: rawData.this_month_farmers ?? null,
    lastMonthFarmers: rawData.last_month_farmers ?? null,
    ytdFarmers: rawData.ytd_farmers ?? null,
    topVillages: Array.isArray(rawData.top_villages) ? rawData.top_villages : [],
    cropStageBreakup: rawData.crop_stage_breakup || {},
    marketTrends: Array.isArray(rawData.market_trends) ? rawData.market_trends : [],
    debugTrace: rawData.debug_trace || null,
    rawKeys: Object.keys(rawData)
  };
}
