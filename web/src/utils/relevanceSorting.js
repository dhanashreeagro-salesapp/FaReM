/**
 * Mandatory Relevance-First Sorting Utility for AgriAmigo Promotion Library
 * 
 * Rules:
 * 1. Positive/explicit association with selected criterion appears BEFORE unassociated/generic.
 * 2. Unassociated/generic content appears BEFORE cross-associated (linked to other entities).
 * 3. Within each relevance tier:
 *    a. Recency: Most recently created first (effective_date = created_at DESC).
 *    b. Alphabetical Title: Multilingual natural sort (Intl.Collator case-insensitive base).
 *    c. Deterministic Key: promo.id.
 */

const titleCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function getEffectiveDate(promo) {
  if (!promo) return 0;
  const d = promo.created_at || promo.effective_date;
  if (!d) return 0;
  const ts = new Date(d).getTime();
  return isNaN(ts) ? 0 : ts;
}

export function sortPromotionsByRelevance(promotions, context = {}) {
  if (!Array.isArray(promotions)) return [];
  const {
    selectedCrop = null,
    selectedStage = null,
    selectedProduct = null,
    selectedCategory = null,
    selectedContentType = null,
    searchTerm = ''
  } = context;

  const hasCropFilter = Boolean(selectedCrop && selectedCrop !== '__general__');
  const hasStageFilter = Boolean(selectedStage);
  const hasProductFilter = Boolean(selectedProduct);
  const hasCategoryFilter = Boolean(selectedCategory);
  const hasTypeFilter = Boolean(selectedContentType);
  const cleanSearch = (searchTerm || '').trim().toLowerCase();

  // If no criteria or search active, default to Recency -> Title -> ID
  if (!hasCropFilter && !hasStageFilter && !hasProductFilter && !hasCategoryFilter && !hasTypeFilter && !cleanSearch) {
    return [...promotions].sort((a, b) => {
      const dateDiff = getEffectiveDate(b) - getEffectiveDate(a);
      if (dateDiff !== 0) return dateDiff;
      const titleDiff = titleCollator.compare(a.title || '', b.title || '');
      if (titleDiff !== 0) return titleDiff;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
  }

  return [...promotions].sort((a, b) => {
    // 1. Calculate explicit relevance scores
    const scoreA = computeRelevanceScore(a, context);
    const scoreB = computeRelevanceScore(b, context);

    if (scoreA !== scoreB) {
      return scoreB - scoreA; // Higher relevance score appears first
    }

    // 2. Recency (Newest first)
    const dateDiff = getEffectiveDate(b) - getEffectiveDate(a);
    if (dateDiff !== 0) return dateDiff;

    // 3. Alphabetical Title (Multilingual safe)
    const titleDiff = titleCollator.compare(a.title || '', b.title || '');
    if (titleDiff !== 0) return titleDiff;

    // 4. Stable tie-breaker
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function computeRelevanceScore(p, context) {
  const {
    selectedCrop,
    selectedStage,
    selectedProduct,
    selectedCategory,
    selectedContentType,
    searchTerm
  } = context;

  let score = 0;

  // --- CROP RELEVANCE ---
  if (selectedCrop && selectedCrop !== '__general__') {
    const sCrop = String(selectedCrop).toLowerCase();
    const isDirectCrop =
      (p.crops && p.crops.some(c => String(c).toLowerCase() === sCrop)) ||
      (p.crop && String(p.crop).toLowerCase() === sCrop) ||
      (p.crop_names && p.crop_names.some(cn => cn.toLowerCase() === sCrop || sCrop.includes(cn.toLowerCase())));

    const isGenericCrop = (!p.crops || p.crops.length === 0) && !p.crop && (!p.crop_names || p.crop_names.length === 0);

    if (isDirectCrop) {
      score += 100; // Directly linked to selected crop
    } else if (isGenericCrop) {
      score += 50;  // Generic crop advisory (valid for all crops)
    } else {
      score += 0;   // Cross-associated with another crop
    }
  }

  // --- STAGE RELEVANCE ---
  if (selectedStage) {
    const sStage = String(selectedStage).toLowerCase();
    const isDirectStage =
      (p.stages && p.stages.some(s => String(s).toLowerCase() === sStage)) ||
      (p.stage && String(p.stage).toLowerCase() === sStage) ||
      (p.stage_names && p.stage_names.some(sn => sn.toLowerCase() === sStage || sStage.includes(sn.toLowerCase()))) ||
      (p.target_stages && p.target_stages.some(ts => ts.toLowerCase() === sStage || sStage.includes(ts.toLowerCase())));

    const isGenericStage = (!p.stages || p.stages.length === 0) && !p.stage && (!p.stage_names || p.stage_names.length === 0) && (!p.target_stages || p.target_stages.length === 0);

    if (isDirectStage) {
      score += 50; // Directly linked to growth stage
    } else if (isGenericStage) {
      score += 20; // Unassociated with stage
    } else {
      score += 0;  // Associated with other stages
    }
  }

  // --- PRODUCT RELEVANCE ---
  if (selectedProduct) {
    const sProd = String(selectedProduct).toLowerCase();
    const isDirectProd =
      (p.related_products && p.related_products.some(pr => String(pr).toLowerCase() === sProd)) ||
      (p.product_names && p.product_names.some(pn => pn.toLowerCase() === sProd || sProd.includes(pn.toLowerCase())));

    const isGenericProd = (!p.related_products || p.related_products.length === 0) && (!p.product_names || p.product_names.length === 0);

    if (isDirectProd) {
      score += 100;
    } else if (isGenericProd) {
      score += 30;
    } else {
      score += 0;
    }
  }

  // --- CATEGORY RELEVANCE ---
  if (selectedCategory) {
    const sCat = String(selectedCategory).toLowerCase();
    if (p.category && p.category.toLowerCase() === sCat) {
      score += 30;
    } else if (!p.category) {
      score += 10;
    }
  }

  // --- CONTENT TYPE RELEVANCE ---
  if (selectedContentType) {
    const sType = String(selectedContentType).toLowerCase();
    if (p.content_type && p.content_type.toLowerCase() === sType) {
      score += 20;
    }
  }

  // --- SEARCH TERM RELEVANCE ---
  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.trim().toLowerCase();
    // Explicit title match
    if (p.title && p.title.toLowerCase().includes(term)) {
      score += 40;
    }
    // Explicit crop/stage/product match in relationships
    if (p.crop_names && p.crop_names.some(c => c.toLowerCase().includes(term))) {
      score += 30;
    }
    if (p.stage_names && p.stage_names.some(s => s.toLowerCase().includes(term))) {
      score += 25;
    }
    if (p.product_names && p.product_names.some(pr => pr.toLowerCase().includes(term))) {
      score += 25;
    }
    if (p.category && p.category.toLowerCase().includes(term)) {
      score += 15;
    }
  }

  return score;
}
