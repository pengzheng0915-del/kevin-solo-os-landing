const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const PRODUCTION_PROMPT_ORIGINS = new Set([
  'https://kevinsolo.cn',
  'https://www.kevinsolo.cn',
]);
const LOCAL_PRODUCT_COLLECTIONS = new Set(['full', 'curated']);
const LOCAL_PRODUCT_SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,220}$/u;

export function isLocalPromptCatalogOrigin(value) {
  try {
    return LOCAL_HOSTS.has(new URL(String(value)).hostname);
  } catch {
    return false;
  }
}

export function isProductionPromptCatalogOrigin(value) {
  try {
    return PRODUCTION_PROMPT_ORIGINS.has(new URL(String(value)).origin);
  } catch {
    return false;
  }
}

export function isValidLocalProductSlug(value) {
  return LOCAL_PRODUCT_SLUG.test(String(value || ''));
}

export function canResolveLocalProductDetailDirectly({
  localCatalogEnabled,
  enrichmentSearchAvailable,
  slug,
} = {}) {
  return localCatalogEnabled === true
    && enrichmentSearchAvailable === true
    && isValidLocalProductSlug(slug)
    && !/^openlab-\d+$/u.test(String(slug || ''));
}

export function isLocalProductDetailCandidate({ localCatalogEnabled, item } = {}) {
  return localCatalogEnabled === true
    && LOCAL_PRODUCT_COLLECTIONS.has(item?.collection)
    && item?.access !== 'free'
    && isValidLocalProductSlug(item?.slug);
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

export function formatReferenceRequirement(item = {}) {
  if (item.referenceState === 'not-required') return '不需要参考图';
  if (item.referenceState === 'required-count-unknown') return '完整说明中标注需要参考图，未标注数量';
  if (item.referenceState === 'required-count-known') {
    return positiveInteger(item.referenceImageCount)
      ? `需要 ${item.referenceImageCount} 张参考图`
      : '完整说明中未标注参考图数量';
  }
  if (item.referenceImageRequired === null || item.referenceImageRequired === undefined) return '完整说明中未标注参考图要求';
  if (item.referenceImageRequired === true) {
    return positiveInteger(item.referenceImageCount)
      ? `需要 ${item.referenceImageCount} 张参考图`
      : '完整说明中未标注参考图数量';
  }
  return '不强制参考图';
}

export function formatReferencePreparation(item = {}) {
  if (item.referenceState === 'not-required') return '这条提示词不需要参考图。';
  if (item.referenceState === 'required-count-unknown') {
    return '请准备清晰参考图；完整说明中未标注数量。';
  }
  if (item.referenceState === 'required-count-known') {
    return positiveInteger(item.referenceImageCount)
      ? `按顺序准备 ${item.referenceImageCount} 张清晰参考图。`
      : (item.unlocked === true
        ? '完整说明中未标注参考图数量；请根据具体任务核对。'
        : '完整说明中未标注参考图数量；解锁后请核对完整内容。');
  }
  if (item.referenceImageRequired === true) {
    return positiveInteger(item.referenceImageCount)
      ? `按顺序准备 ${item.referenceImageCount} 张清晰参考图。`
      : '请准备清晰参考图；完整说明中未标注数量。';
  }
  if (item.referenceImageRequired === false) return '这条提示词不强制使用参考图。';
  return item.unlocked === true
    ? '完整说明中未标注参考图要求；请根据具体任务核对。'
    : '完整说明中未标注参考图要求；解锁后请核对完整内容。';
}

export function formatRequiredEditGuidance(item = {}) {
  let count = null;
  if (positiveInteger(item.requiredEditCount)) {
    count = item.requiredEditCount;
  } else if (
    (item.requiredEditCount === null || item.requiredEditCount === undefined)
    && Array.isArray(item.requiredEdits)
    && item.requiredEdits.length > 0
  ) {
    count = item.requiredEdits.length;
  }
  if (positiveInteger(count)) return `使用前请检查 ${count} 处需要替换的内容。`;
  if (item.requiredEditCount === 0) {
    return '完整说明中未标注必须替换项；使用前仍请核对并按需修改。';
  }
  if (item.unlocked === true) {
    if (item.sourceType === 'kevinsolo-original' && item.usageType === 'direct' && Array.isArray(item.requiredEdits) && !item.requiredEdits.length) return '这条样例无需替换必填变量，可以直接复制；可按下方可选项调整。';
    return '未列出固定必改项；请根据你的具体目标检查需要替换或补充的信息。';
  }
  return '解锁后请检查哪些信息需要替换或补充。';
}

const PUBLIC_MEDIA_TYPES = new Set(['image', 'video', 'webpage']);

function normalizeMediaCounts(source = {}, total = 0) {
  const byMedia = {};
  for (const [rawMedia, rawCount] of Object.entries(source || {})) {
    const media = PUBLIC_MEDIA_TYPES.has(String(rawMedia).trim()) ? String(rawMedia).trim() : 'other';
    const count = Math.max(0, Math.floor(Number(rawCount) || 0));
    if (count) byMedia[media] = (byMedia[media] || 0) + count;
  }
  const expectedTotal = Math.max(0, Math.floor(Number(total) || 0));
  const countedTotal = Object.values(byMedia).reduce((sum, count) => sum + count, 0);
  if (expectedTotal > countedTotal) byMedia.other = (byMedia.other || 0) + expectedTotal - countedTotal;
  return byMedia;
}

export function deriveLocalProductCatalogState(payload = {}) {
  const enrichmentSearchAvailable = payload.enrichmentSearchAvailable === true;
  const productStats = { byModel: {}, byMedia: {} };
  const modelFacets = enrichmentSearchAvailable ? payload.productModels : payload.models;
  const mediaFacets = enrichmentSearchAvailable ? payload.productMediaTypes : payload.mediaTypes;
  for (const item of Array.isArray(modelFacets) ? modelFacets : []) {
    const name = String(item?.name || '').trim();
    const count = Number(item?.count) || 0;
    if (name) productStats.byModel[name] = (productStats.byModel[name] || 0) + count;
  }
  for (const item of Array.isArray(mediaFacets) ? mediaFacets : []) {
    const media = String(item?.value || '').trim();
    const count = Number(item?.count) || 0;
    if (media) productStats.byMedia[media] = (productStats.byMedia[media] || 0) + count;
  }
  const coverageTotal = Number(payload.coverageTotal ?? payload.total) || 0;
  const productSearchTotal = Number(payload.productSearchTotal) || 0;
  productStats.byMedia = normalizeMediaCounts(productStats.byMedia, productSearchTotal);
  return {
    enrichmentSearchAvailable,
    coverageTotal,
    productSearchTotal,
    productStats,
    primaryStatus: enrichmentSearchAvailable
      ? `${productSearchTotal.toLocaleString('zh-CN')} 条提示词可搜索`
      : '提示词目录可浏览',
    secondaryStatus: enrichmentSearchAvailable
      ? '覆盖图片、视频和网页提示词，含 12 条免费完整样例。'
      : '现有提示词仍可浏览；分类筛选暂不可用。',
  };
}

export function deriveProductionProductCatalogState({ search = {}, models = {} } = {}) {
  const productSearchTotal = Number(search?.total) || 0;
  const productStats = { byModel: {}, byMedia: {} };
  for (const item of Array.isArray(models?.data) ? models.data : []) {
    const name = String(item?.name || '').trim();
    const media = String(item?.mediaType || item?.media || '').trim();
    const count = Number(item?.count) || 0;
    if (name) productStats.byModel[name] = (productStats.byModel[name] || 0) + count;
    if (!models?.stats?.byMedia && media) {
      productStats.byMedia[media] = (productStats.byMedia[media] || 0) + count;
    }
  }
  productStats.byMedia = normalizeMediaCounts(models?.stats?.byMedia || productStats.byMedia, productSearchTotal);
  return {
    enrichmentSearchAvailable: false,
    coverageTotal: productSearchTotal,
    productSearchTotal,
    productStats,
    primaryStatus: `${productSearchTotal.toLocaleString('zh-CN')} 条提示词可搜索`,
    secondaryStatus: '覆盖图片、视频和网页提示词，含 12 条免费完整样例。',
  };
}

function nonNegativeWholeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

export function formatGroupedResultSummary({
  productTotal = 0,
  freeCompleteTotal = 0,
  openTotal = 0,
} = {}) {
  const productCount = nonNegativeWholeNumber(productTotal);
  const freeCount = Math.min(productCount, nonNegativeWholeNumber(freeCompleteTotal));
  const openCount = nonNegativeWholeNumber(openTotal);
  const lockedCount = productCount - freeCount + openCount;
  return {
    total: productCount + openCount,
    freeCompleteTotal: freeCount,
    libraryPreviewTotal: lockedCount,
    updateContentTotal: openCount,
    summary: `完整库共 ${productCount + openCount} 条：免费完整体验 ${freeCount} 条，解锁后看全文 ${lockedCount} 条。`,
  };
}

const LOCAL_ONLY_MODEL_ENTRIES = Object.freeze({
  'grok-imagine': Object.freeze({
    slug: 'grok-imagine',
    name: 'Grok Imagine',
    media: 'image',
    path: '/prompts/model/grok-imagine',
    description: '适合 Grok Imagine 图像生成内容；使用前请核对当前模型能力与入口。',
  }),
});

export function mergeLocalPromptModels(baseModels, productModelFacets, { localEnabled = false } = {}) {
  const shared = Array.isArray(baseModels) ? baseModels : [];
  if (!localEnabled) return shared;
  const known = new Set(shared.map((model) => String(model?.slug || '').trim()).filter(Boolean));
  const merged = [...shared];
  for (const facet of Array.isArray(productModelFacets) ? productModelFacets : []) {
    const slug = String(facet?.slug || '').trim();
    const count = Number(facet?.count);
    const localEntry = LOCAL_ONLY_MODEL_ENTRIES[slug];
    if (!localEntry || known.has(slug) || !Number.isInteger(count) || count <= 0) continue;
    merged.push({ ...localEntry });
    known.add(slug);
  }
  return merged;
}

function appendText(params, key, value) {
  const text = String(value ?? '').trim();
  if (text) params.set(key, text);
}

function appendInteger(params, key, value) {
  if (Number.isInteger(value) && value >= 0) params.set(key, String(value));
}

export function buildLocalPromptSearchUrl({
  query = '', model = '', media = '', usage = '', reference = '', limit = 20, offset = 0,
} = {}) {
  const params = new URLSearchParams();
  appendText(params, 'q', query);
  appendText(params, 'model', model);
  appendText(params, 'media', media);
  appendText(params, 'usage', usage);
  appendText(params, 'reference', reference);
  appendInteger(params, 'limit', limit);
  appendInteger(params, 'offset', offset);
  return `/api/local-prompts/search?${params}`;
}

export function buildLocalPromptDetailUrl(slug) {
  const params = new URLSearchParams({ slug: String(slug ?? '').trim() });
  return `/api/local-prompts/detail?${params}`;
}

export function buildProductPromptSearchUrl({
  slug = '', query = '', model = '', media = '', category = '', usage = '', reference = '', freeOnly = false, limit = 20, offset = 0,
} = {}) {
  const params = new URLSearchParams();
  appendText(params, 'slug', slug);
  appendText(params, 'q', query);
  appendText(params, 'model', model);
  appendText(params, 'media', media);
  appendText(params, 'category', category);
  appendText(params, 'usage', usage);
  appendText(params, 'reference', reference);
  if (freeOnly) params.set('free', '1');
  appendInteger(params, 'limit', limit);
  appendInteger(params, 'offset', offset);
  return `/api/prompts/search?${params}`;
}

const LOCAL_SAFE_METADATA_KEYS = new Set([
  'title', 'titleZh', 'titleEn', 'titleOriginal', 'summary', 'model', 'modelName',
  'mediaType', 'categories', 'previewAssets', 'usageType', 'referenceState',
  'referenceImageRequired', 'referenceImageCount', 'inputRequirements',
  'requiredEdits', 'requiredEditCount', 'optionalEdits', 'preserveInstructions',
  'negativeConstraints', 'usageSteps', 'usageTips',
  'sampleSelected', 'publishedAt', 'metadataOnly', 'recommendedModel',
  'referenceAssets', 'tags',
]);
const CACHED_SAFE_METADATA_KEYS = new Set([
  'slug', 'id', 'collection', 'access',
  ...LOCAL_SAFE_METADATA_KEYS,
  'categorySlugs', 'categoryDetails', 'packId', 'packName', 'relatedPromptIds',
  'aspectRatio', 'duration', 'shotCount', 'needsReview', 'featured', 'popularity',
  'updatedAt',
]);

function allowlistedMetadata(value, allowedKeys) {
  const safe = {};
  for (const [key, fieldValue] of Object.entries(value || {})) {
    if (allowedKeys.has(key)) safe[key] = fieldValue;
  }
  return safe;
}

const LOCAL_SAFE_ASSET_KEYS = new Set(['url', 'type', 'alt', 'poster']);

function allowlistedLocalAssets(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((asset) => asset && typeof asset === 'object')
    .map((asset) => allowlistedMetadata(asset, LOCAL_SAFE_ASSET_KEYS))
    .filter((asset) => typeof asset.url === 'string' && asset.url);
}

export function mergeSafeLocalPromptMetadata(cached, localMetadata) {
  const merged = allowlistedMetadata(cached, CACHED_SAFE_METADATA_KEYS);
  const safeLocal = allowlistedMetadata(localMetadata, LOCAL_SAFE_METADATA_KEYS);
  for (const key of ['previewAssets', 'referenceAssets']) {
    if (Object.hasOwn(safeLocal, key)) safeLocal[key] = allowlistedLocalAssets(safeLocal[key]);
  }
  Object.assign(merged, safeLocal);
  for (const key of [
    'previewAssets', 'referenceAssets', 'categorySlugs', 'categoryDetails',
    'relatedPromptIds', 'tags', 'inputRequirements', 'requiredEdits',
    'optionalEdits', 'preserveInstructions', 'negativeConstraints', 'usageSteps',
    'usageTips',
  ]) {
    if (!Array.isArray(merged[key])) merged[key] = [];
  }
  const categories = merged.categories && typeof merged.categories === 'object'
    ? merged.categories
    : {};
  merged.categories = {
    useCases: Array.isArray(categories.useCases) ? categories.useCases : [],
    styles: Array.isArray(categories.styles) ? categories.styles : [],
    subjects: Array.isArray(categories.subjects) ? categories.subjects : [],
  };
  merged.unlocked = false;
  return merged;
}

async function requestJson(url, { signal } = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const error = new Error(payload?.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function fetchLocalPromptHealth(options) {
  return requestJson('/api/local-prompts/health', options);
}

export function fetchLocalPromptFacets(options) {
  return requestJson('/api/local-prompts/facets', options);
}

export function searchLocalPrompts(filters, options) {
  return requestJson(buildLocalPromptSearchUrl(filters), options);
}

export function getLocalPromptDetail(slug, options) {
  return requestJson(buildLocalPromptDetailUrl(slug), options);
}

export function fetchProductPromptModels(options) {
  return requestJson('/api/prompts/models', options);
}

export function searchProductPrompts(filters, options) {
  return requestJson(buildProductPromptSearchUrl(filters), options);
}

export async function getProductPromptMetadata(slug, options) {
  const exactSlug = String(slug || '').trim();
  if (!isValidLocalProductSlug(exactSlug)) return null;
  const payload = await searchProductPrompts({ slug: exactSlug, limit: 1, offset: 0 }, options);
  return Array.isArray(payload?.data)
    ? payload.data.find((item) => item?.slug === exactSlug) || null
    : null;
}
