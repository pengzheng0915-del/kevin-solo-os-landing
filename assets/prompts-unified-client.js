function safeTotal(payload) {
  const total = Number(payload?.total);
  return Number.isSafeInteger(total) && total > 0 ? total : 0;
}

function safeItems(payload) {
  return Array.isArray(payload?.data) ? payload.data : [];
}

const PUBLIC_MEDIA_TYPES = new Set(['image', 'video', 'webpage']);

function mergeCountMaps(...sources) {
  const counts = {};
  for (const source of sources) {
    for (const [rawKey, rawCount] of Object.entries(source || {})) {
      const key = String(rawKey).trim();
      const count = Math.max(0, Math.floor(Number(rawCount) || 0));
      if (key && count) counts[key] = (counts[key] || 0) + count;
    }
  }
  return counts;
}

function mergeMediaCounts(primary = {}, updates = {}, total = 0) {
  const byMedia = {};
  for (const source of [primary, updates]) {
    for (const [rawMedia, rawCount] of Object.entries(source || {})) {
      const media = PUBLIC_MEDIA_TYPES.has(String(rawMedia).trim()) ? String(rawMedia).trim() : 'other';
      const count = Math.max(0, Math.floor(Number(rawCount) || 0));
      if (count) byMedia[media] = (byMedia[media] || 0) + count;
    }
  }
  const countedTotal = Object.values(byMedia).reduce((sum, count) => sum + count, 0);
  if (total > countedTotal) byMedia.other = (byMedia.other || 0) + total - countedTotal;
  return byMedia;
}

export function mergeUnifiedCatalogState(primaryState = {}, updatePayload = {}) {
  const primaryTotal = Number(primaryState.productSearchTotal) || 0;
  const coverageTotal = Number(primaryState.coverageTotal) || primaryTotal;
  const updateTotal = safeTotal(updatePayload);
  const productSearchTotal = primaryTotal + updateTotal;
  const productStats = {
    ...(primaryState.productStats || {}),
    byModel: mergeCountMaps(
      primaryState.productStats?.byModel,
      updatePayload?.stats?.byModel,
    ),
    byMedia: mergeMediaCounts(
      primaryState.productStats?.byMedia,
      updatePayload?.stats?.byMedia,
      productSearchTotal,
    ),
  };
  return {
    ...primaryState,
    productStats,
    productSearchTotal,
    coverageTotal: coverageTotal + updateTotal,
    primaryStatus: `${productSearchTotal.toLocaleString('zh-CN')} 条提示词可搜索`,
  };
}

export async function searchUnifiedPromptCatalog({
  searchPrimary,
  searchUpdates,
  primaryFilters = {},
  updateFilters = {},
  limit = 24,
  offset = 0,
} = {}, requestOptions = {}) {
  if (typeof searchPrimary !== 'function') throw new TypeError('searchPrimary is required');
  const pageLimit = Math.max(1, Math.min(50, Number.parseInt(String(limit), 10) || 24));
  const pageOffset = Math.max(0, Number.parseInt(String(offset), 10) || 0);
  const updatesEnabled = typeof searchUpdates === 'function';

  const [primaryCountPayload, updateCountPayload] = await Promise.all([
    searchPrimary({ ...primaryFilters, limit: 1, offset: 0 }, requestOptions),
    updatesEnabled
      ? searchUpdates({ ...updateFilters, limit: 1, offset: 0 }, requestOptions)
      : Promise.resolve({ total: 0, data: [] }),
  ]);
  const primaryTotal = safeTotal(primaryCountPayload);
  const updateTotal = safeTotal(updateCountPayload);
  const total = primaryTotal + updateTotal;
  const pageEnd = Math.min(total, pageOffset + pageLimit);
  const primaryStart = total ? Math.floor((pageOffset * primaryTotal) / total) : 0;
  const primaryEnd = total ? Math.floor((pageEnd * primaryTotal) / total) : 0;
  const updateStart = pageOffset - primaryStart;
  const updateEnd = pageEnd - primaryEnd;
  const primaryLimit = primaryEnd - primaryStart;
  const updateLimit = updateEnd - updateStart;
  const [primaryPage, updatePage] = await Promise.all([
    primaryLimit > 0
      ? searchPrimary({ ...primaryFilters, limit: primaryLimit, offset: primaryStart }, requestOptions)
      : Promise.resolve({ data: [] }),
    updatesEnabled && updateLimit > 0
      ? searchUpdates({ ...updateFilters, limit: updateLimit, offset: updateStart }, requestOptions)
      : Promise.resolve({ data: [] }),
  ]);
  const data = [
    ...safeItems(primaryPage).slice(0, primaryLimit),
    ...safeItems(updatePage).slice(0, updateLimit),
  ];
  return {
    success: true,
    total,
    limit: pageLimit,
    offset: pageOffset,
    hasMore: pageOffset + data.length < total,
    counts: { primary: primaryTotal, updates: updateTotal },
    data,
  };
}
