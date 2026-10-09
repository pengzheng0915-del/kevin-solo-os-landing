import { PROMPT_MODELS } from '/config/prompts-catalog.mjs';
import { matchesPromptSearch } from '/assets/prompts-search-language.js?v=20260902-4';
import { fetchOpenCategories, getOpenPrompt, searchOpenPrompts } from '/assets/prompts-open-client.js';
import { mergeUnifiedCatalogState, searchUnifiedPromptCatalog } from '/assets/prompts-unified-client.js?v=20260902-4';
import {
  canResolveLocalProductDetailDirectly,
  deriveLocalProductCatalogState,
  deriveProductionProductCatalogState,
  fetchLocalPromptFacets,
  fetchProductPromptModels,
  formatGroupedResultSummary,
  formatReferencePreparation,
  formatReferenceRequirement,
  formatRequiredEditGuidance,
  getProductPromptMetadata,
  getLocalPromptDetail,
  isLocalPromptCatalogOrigin,
  isProductionPromptCatalogOrigin,
  isLocalProductDetailCandidate,
  isValidLocalProductSlug,
  mergeLocalPromptModels,
  mergeSafeLocalPromptMetadata,
  searchLocalPrompts,
  searchProductPrompts
} from '/assets/prompts-local-client.js?v=20260914-1';

const SHARED_MODELS = PROMPT_MODELS.map((model) => ({
  slug: model.id,
  name: model.name,
  media: model.mediaType,
  path: model.path,
  description: model.description
}));
let MODELS = SHARED_MODELS;
const OTHER_MODEL = Object.freeze({ slug: 'other', name: '其他' });
let FILTER_MODELS = [...MODELS, OTHER_MODEL];

const MEDIA = [
  { slug: 'image', name: '图片提示词', short: '图片', description: '封面、海报、人像、产品图和信息图。' },
  { slug: 'video', name: '视频提示词', short: '视频', description: '分镜、运镜、物理效果和一致性约束。' },
  { slug: 'webpage', name: '网页提示词', short: '网页', description: '品牌目标、视觉风格、功能需求和技术栈。' }
];

const USAGE_LABELS = {
  direct: '直接复制',
  variable: '变量替换',
  'reference-image': '参考图',
  'reference-style': '风格参考',
  'structured-json': 'JSON 结构',
  'video-storyboard': '视频分镜',
  webpage: '网页需求',
  pack: '合集',
  unknown: '查看使用说明'
};

const INTERNAL_CUSTOMER_COPY = /(?:机器结构化候选|中文说明待复核|公开来源索引，待复核|素材权利状态：未确认|来源覆盖记录|内容盘点|本地安全目录|数据库缺少|结构化产品索引|待审核|待复核|待确认)/u;
const DEFAULT_PACK_SUMMARY = '同一创作方向下的多条提示词。';

const MODEL_ALIASES = new Map();
const FIXED_MODEL_ALIASES = [
  ['gpt image 1.5', 'gpt-image-1-5'],
  ['gpt-image-1-5', 'gpt-image-1-5'],
  ['seedream 4.5', 'seedream-4-5'],
  ['seedance 2.5', 'seedance-2-5'],
  ['seedance 2.0', 'seedance-2-0'],
  ['gemini 3 pro', 'gemini-3-pro'],
  ['nano banana pro', 'nano-banana-pro']
];

function installModelAliases() {
  MODEL_ALIASES.clear();
  for (const model of MODELS) {
    MODEL_ALIASES.set(model.slug, model.slug);
    MODEL_ALIASES.set(model.name.toLowerCase(), model.slug);
  }
  for (const [alias, slug] of FIXED_MODEL_ALIASES) MODEL_ALIASES.set(alias, slug);
}

function installLocalProductModels(productModelFacets) {
  MODELS = mergeLocalPromptModels(SHARED_MODELS, productModelFacets, {
    localEnabled: LOCAL_PRODUCT_CATALOG,
  });
  FILTER_MODELS = [...MODELS, OTHER_MODEL];
  installModelAliases();
}

const CATEGORY_GROUPS = {
  'use-cases': { key: 'useCases', label: '使用场景' },
  useCases: { key: 'useCases', label: '使用场景' },
  styles: { key: 'styles', label: '风格' },
  subjects: { key: 'subjects', label: '主体' }
};

const LOCAL_CATEGORY_QUERIES = new Map([
  ['海报', 'poster'], ['产品营销', 'product'], ['包装设计', 'packaging'], ['编辑插画', 'editorial illustration'],
  ['编辑配图', 'editorial'], ['参考图创作', 'reference'], ['产品视频', 'product'], ['定格动画', 'stop motion'],
  ['风格参考', 'style'], ['服务落地页', 'landing page'], ['工作空间', 'workspace'], ['广告', 'advertisement'],
  ['活动视觉', 'event poster'], ['网页', 'webpage'], ['纸艺', 'paper craft'], ['纸艺视频', 'paper craft'],
  ['UI', 'interface'], ['电影感', 'cinematic'], ['中式', 'Chinese'], ['插画', 'illustration'], ['复古', 'vintage'],
  ['人像', 'portrait'], ['静物', 'still life']
]);

const PAGE_SIZE = 24;
const COLLECTIONS = new Set(['all', 'full', 'curated']);
const OPEN_REFERENCE_STATES = new Set(['not-required', 'required-count-unknown', 'required-count-known']);
const LOCAL_PRODUCT_CATALOG = isLocalPromptCatalogOrigin(location.origin)
  && document.querySelector('meta[name="kevin-local-full-catalog"][content="enabled"]') !== null;
const PRODUCTION_PRODUCT_CATALOG = isProductionPromptCatalogOrigin(location.origin);
const PRODUCT_CATALOG_AVAILABLE = LOCAL_PRODUCT_CATALOG || PRODUCTION_PRODUCT_CATALOG;
installModelAliases();
const app = document.querySelector('#app');
const dialogRoot = document.querySelector('#dialog-root');
const toast = document.querySelector('#toast');

const state = {
  items: [],
  freeItems: [],
  packs: [],
  itemBySlug: new Map(),
  freeBySlug: new Map(),
  catalogTotal: 0,
  catalogStats: { byModel: {}, byMedia: {}, byUsage: {} },
  catalogLoaded: false,
  fullCatalogPromise: null,
  packMetadataLoaded: false,
  packMetadataPromise: null,
  freeSamplesLoaded: false,
  freeSamplesPromise: null,
  openItems: [],
  openBySlug: new Map(),
  openCategories: [],
  openCategoriesLoaded: false,
  openCategoriesPromise: null,
  openCategoriesError: '',
  openTotal: 0,
  openPage: 1,
  openOffset: 0,
  openHasMore: false,
  openLoading: false,
  openError: '',
  openDebounce: null,
  productItems: [],
  productBySlug: new Map(),
  productTotal: 0,
  productPage: 1,
  productOffset: 0,
  productHasMore: false,
  productLoading: false,
  productError: '',
  productAvailable: false,
  productEnrichmentAvailable: false,
  productCatalogChecked: false,
  productCatalogPromise: null,
  productStats: { byModel: {}, byMedia: {} },
  productCoverageTotal: 0,
  productSearchCatalogTotal: 0,
  productPrimaryStatus: '',
  productSecondaryStatus: '',
  viewGeneration: 0,
  viewAbortController: null,
  route: null,
  query: '',
  collection: 'all',
  curatedPage: 1,
  filters: freshFilters(),
  visibleLimit: PAGE_SIZE,
  language: 'zh',
  activeDetail: null,
  packIndex: 0,
  loadError: '',
  loaded: false,
  paid: false,
  accessRole: 'checking',
  dialogReturnFocus: null,
  dialogMode: 'purchase',
  filterReturnFocus: null,
  toastTimer: null,
  copyTimer: null,
  wechatCopyTimer: null
};

function freshFilters() {
  return {
    model: '',
    media: '',
    usage: '',
    reference: '',
    openCategory: '',
    useCase: '',
    style: '',
    subject: '',
    sort: 'default',
    freeOnly: false
  };
}

function parsePageNumber(value) {
  const page = Number.parseInt(String(value || ''), 10);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function pageCount(total) {
  return Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / PAGE_SIZE));
}

function clampPage(page, total) {
  return Math.min(Math.max(1, parsePageNumber(page)), pageCount(total));
}

function resetResultPages() {
  state.curatedPage = 1;
  state.productPage = 1;
  state.openPage = 1;
}

function currentPageFor(source) {
  if (source === 'product') return state.productPage;
  if (source === 'open') return state.openPage;
  return state.curatedPage;
}

function setCurrentPage(source, page) {
  if (source === 'product') state.productPage = page;
  else if (source === 'open') state.openPage = page;
  else state.curatedPage = page;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value), location.origin);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.href;
  } catch {
    return '';
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined);
  if (value === null || value === undefined || value === '') return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return value.split(/[,|、]/).map((item) => item.trim()).filter(Boolean);
    }
  }
  return [value];
}

function asTextList(value) {
  return asArray(value).map((item) => {
    if (typeof item === 'string') return item;
    return item?.label || item?.name || item?.value || item?.key || '';
  }).map(String).filter(Boolean);
}

function isInternalCustomerText(value) {
  return INTERNAL_CUSTOMER_COPY.test(String(value || ''));
}

function customerTextList(value) {
  return asTextList(value).filter((item) => !isInternalCustomerText(item));
}

function customerTitle(value, { displayModel, mediaType }) {
  const candidate = String(value || '').replace(/\s+/gu, ' ').trim();
  if (candidate && !isInternalCustomerText(candidate) && !/^(?:未命名提示词|公开目录暂未提供)/u.test(candidate)) return candidate;
  return `${displayModel} ${mediaName(mediaType)}提示词`;
}

function safeChineseDisplayTitle(value) {
  const candidate = String(value || '').replace(/\s+/gu, ' ').trim();
  if (!candidate || !/[\u3400-\u9fff]/u.test(candidate) || isInternalCustomerText(candidate)) return '';
  if (/(?:图片|视频|网页)(?:分镜|需求)?提示词$/u.test(candidate)) return '';
  return candidate;
}

function customerSummary(value, { title, displayModel, mediaType }) {
  const candidate = String(value || '').replace(/\s+/gu, ' ').trim();
  if (candidate && !isInternalCustomerText(candidate) && !/^公开目录暂未提供摘要[。.]?$/u.test(candidate)) return candidate;
  return `用于完成「${title}」相关的${mediaName(mediaType)}创作，推荐使用 ${displayModel}。`;
}

function normalizeModel(value) {
  const raw = String(value || '').trim();
  const lower = raw.toLowerCase();
  if (MODEL_ALIASES.has(lower)) return MODEL_ALIASES.get(lower);
  return 'other';
}

function normalizeMedia(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('video') || raw === '视频') return 'video';
  if (raw.includes('web') || raw === '网页') return 'webpage';
  if (raw.includes('image') || raw.includes('photo') || raw === '图片') return 'image';
  return 'unknown';
}

function normalizeCategories(value) {
  let raw = value;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = asTextList(raw); }
  }
  if (Array.isArray(raw)) {
    return classifyFlatCategories(asTextList(raw));
  }
  raw = raw && typeof raw === 'object' ? raw : {};
  return {
    useCases: asTextList(raw.useCases || raw.use_cases || raw.scenarios || raw['使用场景']),
    styles: asTextList(raw.styles || raw.style || raw['风格']),
    subjects: asTextList(raw.subjects || raw.subject || raw['主体'])
  };
}

function classifyFlatCategories(values) {
  const styles = new Set([
    '日系', '电影感', '复古', '极简', '中式', '科技', '插画', '编辑感',
    '手绘', '水彩', '油画', '像素', '赛博朋克', '新粗野主义', '3D'
  ]);
  const subjects = new Set([
    '人像', '人物', '头像', '建筑', '美食', '食物', '静物', '动物', '植物',
    '产品', '汽车', '服装', '首饰', '宠物', '风景', '室内', '家具'
  ]);
  const grouped = { useCases: [], styles: [], subjects: [] };
  for (const value of values) {
    if (styles.has(value) || /(?:风格|系|电影感|极简|复古)$/.test(value)) {
      grouped.styles.push(value);
    } else if (subjects.has(value) || /(?:人像|人物|产品|静物|动物|植物|建筑|美食)$/.test(value)) {
      grouped.subjects.push(value);
    } else {
      // Unknown flat values stay in use-cases. This is conservative: we do not
      // invent a style/subject meaning that the source data did not establish.
      grouped.useCases.push(value);
    }
  }
  return grouped;
}

function normalizeEdit(item) {
  if (typeof item === 'string') return { key: item, label: item, example: '' };
  return {
    key: String(item?.key || item?.variable || item?.name || item?.label || ''),
    label: String(item?.label || item?.description || item?.key || item?.name || ''),
    example: String(item?.example || item?.default || item?.defaultValue || '')
  };
}

function normalizePromptLanguage(value) {
  const language = String(value || '').trim().toLowerCase();
  if (/^(?:zh|zh-cn|zh-hans|cn|chinese|中文)$/.test(language)) return 'zh';
  if (/^(?:en|en-us|en-gb|english|英文)$/.test(language)) return 'en';
  return '';
}

function comparablePromptText(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}

function detectPromptLanguage(text, declaredLanguage = '') {
  const declared = normalizePromptLanguage(declaredLanguage);
  if (declared) return declared;
  const value = String(text || '');
  const chineseCount = (value.match(/[\u3400-\u9fff]/gu) || []).length;
  const latinCount = (value.match(/[A-Za-z]/gu) || []).length;
  if (chineseCount && (chineseCount >= 2 || !latinCount) && chineseCount >= latinCount * 0.35) return 'zh';
  if (latinCount) return 'en';
  if (chineseCount) return 'zh';
  return '';
}

function promptDisplayMeta(item) {
  const original = String(item?.promptOriginal || item?.promptZh || '').trim();
  const chinese = String(item?.promptZh || '').trim();
  const originalLanguage = detectPromptLanguage(original, item?.originalLanguage);
  const hasDistinctChinese = Boolean(
    chinese
    && comparablePromptText(chinese) !== comparablePromptText(original)
    && detectPromptLanguage(chinese) === 'zh'
  );
  const hasChineseReference = originalLanguage === 'en' && hasDistinctChinese;
  return {
    original,
    chinese,
    originalLanguage,
    hasChineseReference,
    originalLabel: originalLanguage === 'zh' ? '中文原版' : (originalLanguage === 'en' ? '英文原版' : '来源原文'),
    languageNote: hasChineseReference
      ? '原始语言：英文。当前样例对应英文原版提示词；中文内容是参考版本，可以直接使用，也请根据高亮变量、模型参数和你的目标自行调试。'
      : (originalLanguage === 'zh'
        ? '原始语言：中文。当前展示的是来源原文，无需翻译。'
        : (originalLanguage === 'en' ? '原始语言：英文。当前展示的是来源原文。' : '当前展示的是来源原文。'))
  };
}

function promptTextForLanguage(item, language = state.language) {
  const meta = promptDisplayMeta(item);
  if (meta.hasChineseReference && language === 'zh') return meta.chinese;
  return meta.original;
}

function promptVariablePattern() {
  return /(\{argument\b[^{}\r\n]{1,160}\}|\{\{[^{}\r\n]{1,80}\}\}|\[[A-Z][A-Z0-9_ -]{1,40}\]|\[[\u3400-\u9fff][\u3400-\u9fff0-9_ -]{0,24}\]|\{[A-Z][A-Z0-9_ -]{1,40}\}|<[A-Z][A-Z0-9_ -]{1,40}>)/giu;
}

function normalizeAsset(item, fallbackMedia, title) {
  const source = typeof item === 'string' ? { url: item } : (item || {});
  const url = safeUrl(source.url || source.src || source.path || source.assetUrl);
  if (!url) return null;
  const extensionVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);
  const explicitType = String(source.type || source.mediaType || '').toLowerCase();
  return {
    url,
    type: explicitType === 'video' || explicitType === 'image'
      ? explicitType
      : (extensionVideo ? 'video' : 'image'),
    alt: String(source.alt || source.description || `${title}效果预览`),
    poster: safeUrl(source.poster || source.posterUrl || ''),
    sourceUrl: safeUrl(source.sourceUrl || source.source_url || ''),
    storage: String(source.storage || ''),
    rightsStatus: String(source.rightsStatus || source.rights_status || 'unknown')
  };
}

function normalizeAccess(raw) {
  const value = raw?.access;
  if (typeof value === 'string') return value === 'free' ? 'free' : 'paid';
  if (value && typeof value === 'object') {
    return value.tier === 'free' || value.type === 'free' || value.isFree === true ? 'free' : 'paid';
  }
  return raw?.isFree === true || raw?.free === true ? 'free' : 'paid';
}

function ownValue(raw, names) {
  for (const name of names) {
    if (raw && Object.hasOwn(raw, name)) return { present: true, value: raw[name] };
  }
  return { present: false, value: undefined };
}

function normalizePrompt(raw, { includeFull = false } = {}) {
  const slug = String(raw?.slug || raw?.id || '').trim();
  const legacyTitle = String(raw?.title || raw?.name || '未命名提示词').trim();
  const rawTitleZh = safeChineseDisplayTitle(raw?.titleZh ?? raw?.title_zh);
  const rawTitleEn = String(raw?.titleEn ?? raw?.title_en ?? '').replace(/\s+/gu, ' ').trim();
  const sourceModel = String(raw?.sourceModel ?? raw?.source_model ?? raw?.model ?? raw?.recommendedModel ?? raw?.recommended_model ?? '').trim();
  const sourceMedia = String(raw?.sourceMedia ?? raw?.source_media ?? raw?.mediaType ?? raw?.media ?? raw?.media_type ?? '').trim();
  const model = normalizeModel(raw?.model ?? sourceModel);
  const mediaType = normalizeMedia(raw?.mediaType ?? raw?.media ?? raw?.media_type ?? sourceMedia);
  const displayModel = String(raw?.modelName || raw?.model_name || (model === 'other' ? (sourceModel || '其他模型') : modelName(model)));
  const title = customerTitle(rawTitleZh || legacyTitle, { displayModel, mediaType });
  const titleOriginalCandidate = rawTitleEn || (!rawTitleZh ? '' : legacyTitle);
  const titleOriginal = titleOriginalCandidate
    && titleOriginalCandidate !== title
    && /[A-Za-z]/u.test(titleOriginalCandidate)
    && !isInternalCustomerText(titleOriginalCandidate)
    ? titleOriginalCandidate
    : '';
  const collection = raw?.collection === 'openlab'
    ? 'openlab'
    : (raw?.collection === 'full' ? 'full' : 'curated');
  const access = collection === 'openlab' ? 'paid' : normalizeAccess(raw);
  const declaredPreviewSource = raw?.previewAssets || raw?.preview_assets || raw?.previewUrls || raw?.preview_urls || raw?.assets || [];
  const declaredPreviewAssets = asArray(declaredPreviewSource);
  const rawVideoUrl = raw?.video_url || raw?.videoUrl || '';
  const declaredPoster = declaredPreviewAssets.find((candidate) => {
    const source = typeof candidate === 'string' ? { url: candidate } : (candidate || {});
    const url = String(source.url || source.src || source.path || source.assetUrl || '');
    return String(source.type || source.mediaType || '').toLowerCase() === 'image'
      || !/\.(mp4|webm|mov)(\?|$)/i.test(url);
  });
  const declaredPosterUrl = typeof declaredPoster === 'string'
    ? declaredPoster
    : (declaredPoster?.url || declaredPoster?.src || declaredPoster?.path || declaredPoster?.assetUrl || '');
  const rawPosterUrl = raw?.image_url || raw?.imageUrl || raw?.previewUrl || raw?.preview_url || declaredPosterUrl || '';
  const hasDeclaredVideo = declaredPreviewAssets.some((candidate) => {
    const source = typeof candidate === 'string' ? { url: candidate } : (candidate || {});
    const url = String(source.url || source.src || source.path || source.assetUrl || '');
    return String(source.type || source.mediaType || '').toLowerCase() === 'video'
      || /\.(mp4|webm|mov)(\?|$)/i.test(url);
  });
  const previewSource = mediaType === 'video' && rawVideoUrl && !hasDeclaredVideo
    ? [{ url: rawVideoUrl, type: 'video', poster: rawPosterUrl }]
    : (declaredPreviewAssets.length
      ? declaredPreviewAssets
      : (raw?.previewUrl || raw?.preview_url || rawPosterUrl || []));
  const previewAssets = asArray(previewSource)
    .map((item) => normalizeAsset(item, mediaType, title))
    .filter(Boolean);
  const referenceAssets = asArray(raw?.referenceAssets || raw?.reference_assets)
    .map((item) => normalizeAsset(item, 'image', `${title}参考图`))
    .filter(Boolean);
  const categories = normalizeCategories(raw?.categories);
  const stats = raw?.stats && typeof raw.stats === 'object' ? raw.stats : {};
  const usageRaw = String(raw?.usageType ?? raw?.usage_type ?? '').trim();
  const usageType = USAGE_LABELS[usageRaw] ? usageRaw : 'unknown';
  const referenceState = String(raw?.referenceState || raw?.reference_state || '');
  const requiredSource = ownValue(raw, ['referenceImageRequired', 'reference_image_required']);
  const countSource = ownValue(raw, ['referenceImageCount', 'reference_image_count']);
  const referenceImageRequired = OPEN_REFERENCE_STATES.has(referenceState)
    ? referenceState !== 'not-required'
    : requiredSource.present
    ? (requiredSource.value === null ? null : Boolean(requiredSource.value))
    : (referenceAssets.length ? true : null);
  const referenceImageCount = countSource.present
    ? (Number.isInteger(countSource.value) && countSource.value > 0 ? countSource.value : null)
    : (referenceAssets.length ? referenceAssets.length : null);
  const editCountSource = ownValue(raw, ['requiredEditCount', 'required_edit_count']);
  const sourceDisplayModel = sourceModel || null;
  const guidance = raw?.usageGuidance && typeof raw.usageGuidance === 'object'
    ? raw.usageGuidance
    : (raw?.usage_guidance && typeof raw.usage_guidance === 'object' ? raw.usage_guidance : {});
  const item = {
    id: String(raw?.id || slug),
    slug,
    title,
    titleZh: rawTitleZh || (/[\u3400-\u9fff]/u.test(title) ? title : ''),
    titleEn: titleOriginal,
    titleOriginal,
    collection,
    summary: customerSummary(raw?.summary || raw?.description, { title, displayModel, mediaType }),
    mediaType,
    model,
    sourceModel: sourceDisplayModel,
    sourceMedia: sourceMedia || null,
    metadataOnly: Boolean(raw?.metadataOnly ?? raw?.metadata_only),
    modelName: displayModel,
    promptPreview: String(raw?.promptPreview || raw?.prompt_preview || raw?.preview || ''),
    previewAssets,
    referenceAssets,
    categories,
    categorySlugs: asTextList(raw?.categorySlugs || raw?.category_slugs),
    categoryDetails: asArray(raw?.categoryDetails || raw?.category_details),
    tags: asTextList(raw?.tags),
    packId: String(raw?.packId || raw?.pack_id || ''),
    packName: String(raw?.packName || raw?.pack_name || ''),
    relatedPromptIds: asTextList(raw?.relatedPromptIds || raw?.related_prompt_ids),
    access,
    sourceUrl: safeUrl(raw?.sourceUrl || raw?.source_url || ''),
    sourceType: String(raw?.sourceType || raw?.source_type || ''),
    sourceLicense: String(raw?.sourceLicense || raw?.source_license || 'UNKNOWN'),
    sourceRepository: safeUrl(raw?.sourceRepository || raw?.source_repository || ''),
    sourceCommit: String(raw?.sourceCommit || raw?.source_commit || ''),
    originalLanguage: normalizePromptLanguage(raw?.originalLanguage || raw?.original_language || raw?.sourceLanguage || raw?.source_language),
    compatibilityStatus: String(raw?.compatibilityStatus || raw?.compatibility_status || ''),
    publishedAt: String(raw?.publishedAt || raw?.pub_date || raw?.published_at || ''),
    updatedAt: String(raw?.updatedAt || raw?.updated_at || ''),
    usageType,
    recommendedModel: String(raw?.recommendedModel || raw?.recommended_model || displayModel),
    inputRequirements: customerTextList(raw?.inputRequirements || raw?.input_requirements || guidance.preparation),
    referenceImageCount,
    referenceImageRequired,
    referenceState,
    requiredEdits: asArray(raw?.requiredEdits || raw?.required_edits).map(normalizeEdit).filter((edit) => (
      (edit.key || edit.label) && !isInternalCustomerText(`${edit.key} ${edit.label} ${edit.example}`)
    )),
    requiredEditCount: editCountSource.present
      ? (Number.isInteger(editCountSource.value) && editCountSource.value >= 0 ? editCountSource.value : null)
      : (asArray(raw?.requiredEdits || raw?.required_edits).length || null),
    optionalEdits: asArray(raw?.optionalEdits || raw?.optional_edits).map(normalizeEdit).filter((edit) => (
      (edit.key || edit.label) && !isInternalCustomerText(`${edit.key} ${edit.label} ${edit.example}`)
    )),
    preserveInstructions: customerTextList(raw?.preserveInstructions || raw?.preserve_instructions || guidance.preserve || guidance.keep),
    aspectRatio: String(raw?.aspectRatio || raw?.aspect_ratio || ''),
    duration: String(raw?.duration || ''),
    shotCount: Number(raw?.shotCount ?? raw?.shot_count ?? 0) || 0,
    negativeConstraints: customerTextList(raw?.negativeConstraints || raw?.negative_constraints),
    usageSteps: customerTextList(raw?.usageSteps || raw?.usage_steps || guidance.steps),
    usageTips: customerTextList(raw?.usageTips || raw?.usage_tips),
    needsReview: Boolean(raw?.needsReview ?? raw?.needs_review),
    featured: Boolean(raw?.featured || raw?.recommended),
    popularity: Number(stats.views || stats.likes || stats.popularity || raw?.popularity || 0) || 0
  };
  // Only trusted full-body inputs set includeFull: the ten public free records
  // or a server-authorized paid detail response.
  if (includeFull) {
    item.promptZh = String(raw?.promptZh || raw?.prompt_zh || raw?.prompt_text_zh || (collection === 'openlab' ? '' : raw?.prompt_text) || '');
    item.promptOriginal = String(raw?.promptOriginal || raw?.prompt_original || raw?.prompt_text_original || raw?.prompt_text || '');
  }
  return item;
}

function modelName(slug) {
  if (slug === 'other') return OTHER_MODEL.name;
  return MODELS.find((model) => model.slug === slug)?.name || String(slug || '').replaceAll('-', ' ');
}

function mediaName(slug) {
  return MEDIA.find((media) => media.slug === slug)?.short || '提示词';
}

function extractData(payload) {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.items) ? payload.items : [];
}

function normalizePack(raw) {
  return {
    id: String(raw?.id || raw?.slug || ''),
    name: String(raw?.title || raw?.name || raw?.id || '未命名合集'),
    summary: String(raw?.summary || DEFAULT_PACK_SUMMARY),
    featuredReason: String(raw?.featuredReason || raw?.featured_reason || ''),
    whatYouCanCreate: asTextList(raw?.whatYouCanCreate || raw?.what_you_can_create),
    usageAdvice: asTextList(raw?.usageAdvice || raw?.usage_advice),
    sharedRequirements: asTextList(raw?.sharedRequirements || raw?.shared_requirements),
    promptIds: asTextList(raw?.promptIds || raw?.prompt_ids),
    relatedPackIds: asTextList(raw?.relatedPackIds || raw?.related_pack_ids)
  };
}

function packNameLooksInternal(pack) {
  const name = String(pack?.name || '').trim().toLowerCase();
  const id = String(pack?.id || '').trim().toLowerCase();
  return !name || name === id || name === readableSlug(id).toLowerCase();
}

function mergePackMetadata(currentPacks, incomingPacks) {
  const merged = new Map(asArray(currentPacks).map((pack) => {
    const normalized = normalizePack(pack);
    return [normalized.id, normalized];
  }));
  for (const raw of asArray(incomingPacks)) {
    const incoming = normalizePack(raw);
    if (!incoming.id) continue;
    const current = merged.get(incoming.id);
    if (!current) {
      merged.set(incoming.id, incoming);
      continue;
    }
    merged.set(incoming.id, {
      ...current,
      ...incoming,
      name: packNameLooksInternal(incoming) && !packNameLooksInternal(current) ? current.name : incoming.name,
      summary: incoming.summary === DEFAULT_PACK_SUMMARY && current.summary !== DEFAULT_PACK_SUMMARY
        ? current.summary
        : incoming.summary,
      featuredReason: incoming.featuredReason || current.featuredReason,
      whatYouCanCreate: incoming.whatYouCanCreate.length ? incoming.whatYouCanCreate : current.whatYouCanCreate,
      usageAdvice: incoming.usageAdvice.length ? incoming.usageAdvice : current.usageAdvice,
      sharedRequirements: incoming.sharedRequirements.length ? incoming.sharedRequirements : current.sharedRequirements,
      promptIds: incoming.promptIds.length ? incoming.promptIds : current.promptIds,
      relatedPackIds: incoming.relatedPackIds.length ? incoming.relatedPackIds : current.relatedPackIds
    });
  }
  return [...merged.values()].filter((pack) => pack.id);
}

function retryableHttpStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function fetchJson(url, { timeoutMs = 8_000, maxAttempts = 2 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    let mayRetry = true;
    try {
      const response = await fetch(url, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        mayRetry = retryableHttpStatus(response.status);
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }
      return payload;
    } catch (error) {
      lastError = error;
      if (!mayRetry || attempt === maxAttempts) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 180 * attempt));
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw lastError;
}

function installCatalogPayload(payload, { full = false } = {}) {
  state.items = extractData(payload).map((raw) => normalizePrompt(raw)).filter((item) => item.slug);
  state.packs = mergePackMetadata(state.packs, payload?.packs);
  if (!full) state.packMetadataLoaded = true;
  state.catalogTotal = Number(payload?.total) || state.items.length;
  state.catalogStats = payload?.stats && typeof payload.stats === 'object'
    ? payload.stats
    : { byModel: {}, byMedia: {}, byUsage: {} };
  state.itemBySlug = new Map(state.items.map((item) => [item.slug, item]));
  for (const freeItem of state.freeItems) {
    installCanonicalFreeMetadata(freeItem);
  }
  state.catalogLoaded = full;
}

async function ensurePackMetadata() {
  if (state.packMetadataLoaded) return;
  if (!state.packMetadataPromise) {
    state.packMetadataPromise = fetchJson('/assets/prompts-home.json?v=20260914-1')
      .then((payload) => {
        state.packs = mergePackMetadata(state.packs, payload?.packs);
        state.packMetadataLoaded = true;
      })
      .finally(() => { state.packMetadataPromise = null; });
  }
  await state.packMetadataPromise;
}

function installCanonicalFreeMetadata(freeItem) {
  const safeFree = normalizePrompt(freeItem);
  const existingIndex = state.items.findIndex((item) => item.slug === safeFree.slug);
  if (existingIndex >= 0) state.items[existingIndex] = safeFree;
  else state.items.push(safeFree);
  state.itemBySlug.set(safeFree.slug, safeFree);
  return safeFree;
}

function installFreeSamplesPayload(payload) {
  state.freeItems = extractData(payload).map((raw) => normalizePrompt(raw, { includeFull: true })).filter((item) => item.slug);
  state.freeBySlug = new Map(state.freeItems.map((item) => [item.slug, item]));
  for (const freeItem of state.freeItems) {
    installCanonicalFreeMetadata(freeItem);
  }
  state.freeSamplesLoaded = true;
}

async function ensureFreeSamples() {
  if (state.freeSamplesLoaded) return;
  if (!state.freeSamplesPromise) {
    state.freeSamplesPromise = fetchJson('/assets/prompts-free-samples.json?v=20260914-1')
      .then(installFreeSamplesPayload)
      .finally(() => { state.freeSamplesPromise = null; });
  }
  await state.freeSamplesPromise;
}

async function ensureFullCatalog() {
  if (!state.catalogLoaded && !state.fullCatalogPromise) {
    state.fullCatalogPromise = fetchJson('/assets/prompts-public-index.json?v=20260914-1')
      .then((payload) => installCatalogPayload(payload, { full: true }))
      .finally(() => { state.fullCatalogPromise = null; });
  }
  await Promise.all([
    state.catalogLoaded ? Promise.resolve() : state.fullCatalogPromise,
    ensureFreeSamples()
  ]);
}

async function ensureProductCatalog() {
  if (!PRODUCT_CATALOG_AVAILABLE || state.productCatalogChecked) return state.productAvailable;
  if (!state.productCatalogPromise) {
    const catalogRequest = LOCAL_PRODUCT_CATALOG
      ? Promise.all([
        fetchLocalPromptFacets(),
        fetchProductPromptModels(),
        searchOpenPrompts({ limit: 1, offset: 0 }).catch(() => ({ total: 0 })),
      ]).then(([facets, models, updates]) => ({
        derived: mergeUnifiedCatalogState(deriveLocalProductCatalogState({
          ...facets,
          coverageTotal: Number(facets?.coverageTotal ?? facets?.total) || Number(models?.total) || 0,
        }), updates),
        productModels: facets?.productModels,
      }))
      : Promise.all([
        searchProductPrompts({ limit: 1, offset: 0 }),
        fetchProductPromptModels(),
        searchOpenPrompts({ limit: 1, offset: 0 }).catch(() => ({ total: 0 })),
      ]).then(([search, models, updates]) => ({
        derived: mergeUnifiedCatalogState(deriveProductionProductCatalogState({ search, models }), updates),
        productModels: models?.data,
      }));
    state.productCatalogPromise = catalogRequest.then(({ derived, productModels }) => {
      if (!derived.productSearchTotal) throw new Error('prompt catalog unavailable');
      installLocalProductModels(productModels);
      state.productAvailable = true;
      state.productCatalogChecked = true;
      state.productStats = derived.productStats;
      state.productCoverageTotal = derived.coverageTotal;
      state.productSearchCatalogTotal = derived.productSearchTotal;
      state.productEnrichmentAvailable = derived.enrichmentSearchAvailable;
      state.productPrimaryStatus = derived.primaryStatus;
      state.productSecondaryStatus = derived.secondaryStatus;
      return true;
    }).catch(() => {
      state.productAvailable = false;
      state.productEnrichmentAvailable = false;
      state.productSearchCatalogTotal = 0;
      state.productPrimaryStatus = '';
      state.productSecondaryStatus = '';
      state.productCatalogChecked = true;
      return false;
    }).finally(() => {
      state.productCatalogPromise = null;
    });
  }
  return state.productCatalogPromise;
}

function isOpenDetailSlug(slug) {
  return /^openlab-\d+$/.test(String(slug || ''));
}

function routeNeedsFullCatalog(route = state.route) {
  if (!route || route.kind === 'home' || route.kind === 'not-found') return false;
  if (route.kind === 'item' && isOpenDetailSlug(route.slug)) return false;
  if (route.kind === 'item' && PRODUCTION_PRODUCT_CATALOG && state.productAvailable
    && isValidLocalProductSlug(route.slug)) return false;
  if (route.kind === 'item' && canResolveLocalProductDetailDirectly({
    localCatalogEnabled: LOCAL_PRODUCT_CATALOG && state.productAvailable,
    enrichmentSearchAvailable: state.productEnrichmentAvailable,
    slug: route.slug,
  })) return false;
  if (state.productAvailable && ['all', 'full'].includes(state.collection)
    && ['media', 'model', 'explore', 'category', 'search'].includes(route.kind)) return false;
  if (state.collection === 'full') return !state.productAvailable;
  return true;
}

function beginViewGeneration() {
  window.clearTimeout(state.openDebounce);
  state.openDebounce = null;
  state.viewAbortController?.abort();
  state.viewAbortController = new AbortController();
  state.viewGeneration += 1;
  return state.viewGeneration;
}

function generationIsCurrent(generation) {
  return generation === state.viewGeneration && !state.viewAbortController?.signal.aborted;
}

function generationSignal(generation) {
  return generationIsCurrent(generation) ? state.viewAbortController.signal : AbortSignal.abort();
}

function routeSupportsOpenSearch() {
  if (state.collection === 'curated') return false;
  if (state.filters.freeOnly) return false;
  if (state.productAvailable && ['all', 'full'].includes(state.collection)) return false;
  const route = state.route || { kind: 'home' };
  if (['home', 'item', 'pack', 'not-found'].includes(route.kind)) return false;
  if (routeSupportsProductSearch()) return false;
  if (route.kind === 'search') return true;
  if (route.kind === 'media') return route.media === 'image';
  if (route.kind === 'model' || route.kind === 'explore') return route.model === 'nano-banana-pro';
  return Boolean(state.filters.openCategory);
}

function activeProductCategory() {
  return state.filters.useCase || state.filters.style || state.filters.subject || '';
}

function localProductQuery() {
  const typed = state.query.trim();
  if (typed) return typed;
  const category = activeProductCategory();
  return LOCAL_CATEGORY_QUERIES.get(category) || category;
}

function routeSupportsProductSearch() {
  if (!state.productAvailable || !['all', 'full'].includes(state.collection)) return false;
  const route = state.route || { kind: 'home' };
  if (!['media', 'model', 'explore', 'category', 'search'].includes(route.kind)) return false;
  if (state.filters.openCategory) return false;
  if (state.filters.freeOnly) return false;
  if (state.filters.model === 'other') return false;
  return true;
}

function resetProductResults() {
  state.productItems = [];
  state.productBySlug = new Map();
  state.productTotal = 0;
  state.productOffset = 0;
  state.productHasMore = false;
}

async function loadProductResults({ generation = state.viewGeneration } = {}) {
  if (!generationIsCurrent(generation)) return;
  if (!routeSupportsProductSearch()) {
    state.productError = '';
    state.productLoading = false;
    resetProductResults();
    return;
  }
  resetProductResults();
  state.productLoading = true;
  state.productError = '';
  try {
    const offset = (state.productPage - 1) * PAGE_SIZE;
    const searchCatalog = LOCAL_PRODUCT_CATALOG ? searchLocalPrompts : searchProductPrompts;
    const filters = LOCAL_PRODUCT_CATALOG ? {
      query: localProductQuery(),
      model: state.filters.model,
      media: state.filters.media,
      usage: state.filters.usage,
      reference: state.filters.reference,
      limit: PAGE_SIZE,
      offset
    } : {
      query: state.query.trim(),
      model: state.filters.model ? modelName(state.filters.model) : '',
      media: state.filters.media,
      category: activeProductCategory(),
      usage: state.filters.usage,
      reference: state.filters.reference,
      freeOnly: state.filters.freeOnly,
      limit: PAGE_SIZE,
      offset
    };
    const updateQuery = [state.query.trim(), activeProductCategory()].filter(Boolean).join(' ');
    const payload = await searchUnifiedPromptCatalog({
      searchPrimary: searchCatalog,
      searchUpdates: state.filters.freeOnly ? null : searchOpenPrompts,
      primaryFilters: filters,
      updateFilters: {
        query: updateQuery,
        category: state.filters.openCategory,
        model: state.filters.model ? modelName(state.filters.model) : '',
        media: state.filters.media,
        usage: state.filters.usage,
        reference: OPEN_REFERENCE_STATES.has(state.filters.reference) ? state.filters.reference : '',
      },
      limit: PAGE_SIZE,
      offset,
    }, { signal: generationSignal(generation) });
    if (!generationIsCurrent(generation)) return;
    const rawItems = asArray(payload?.data);
    const incoming = rawItems
      .map((raw) => normalizePrompt({
        ...raw,
        collection: raw?.collection === 'openlab' ? 'openlab' : 'full',
      }))
      .map((item) => state.freeBySlug.has(item.slug)
        ? { ...item, ...normalizePrompt(state.freeBySlug.get(item.slug)) }
        : item)
      .filter((item) => item.slug);
    state.productItems = [...new Map(incoming.map((item) => [item.slug, item])).values()];
    state.productBySlug = new Map(state.productItems.map((item) => [item.slug, item]));
    state.productTotal = Number(payload?.total) || 0;
    state.productOffset = Number(payload?.offset || 0) + rawItems.length;
    const lastPage = pageCount(state.productTotal);
    if (state.productPage > lastPage) {
      state.productPage = lastPage;
      syncUrlFromState({ replace: true });
      return loadProductResults({ generation });
    }
    state.productHasMore = state.productPage < lastPage;
  } catch (error) {
    if (!generationIsCurrent(generation) || error?.name === 'AbortError') return;
    state.productError = error instanceof Error ? error.message : String(error);
    resetProductResults();
  } finally {
    if (generationIsCurrent(generation)) state.productLoading = false;
  }
}

function resetOpenResults() {
  state.openItems = [];
  state.openBySlug = new Map();
  state.openTotal = 0;
  state.openOffset = 0;
  state.openHasMore = false;
}

async function ensureOpenCategories({ generation = state.viewGeneration } = {}) {
  if (state.openCategoriesLoaded) return;
  if (!generationIsCurrent(generation)) return;
  if (!state.openCategoriesPromise || state.openCategoriesPromise.generation !== generation) {
    const request = { generation, promise: null };
    request.promise = fetchOpenCategories({ signal: generationSignal(generation) })
      .then((payload) => {
        if (!generationIsCurrent(generation)) return;
        state.openCategories = asArray(payload?.data).filter((category) => category?.slug);
        state.openCategoriesLoaded = true;
        state.openCategoriesError = '';
      })
      .catch((error) => {
        if (generationIsCurrent(generation) && error?.name !== 'AbortError') {
          state.openCategoriesError = error instanceof Error ? error.message : String(error);
        }
        throw error;
      })
      .finally(() => {
        if (state.openCategoriesPromise === request) state.openCategoriesPromise = null;
      });
    state.openCategoriesPromise = request;
  }
  await state.openCategoriesPromise.promise;
}

async function loadOpenResults({ generation = state.viewGeneration } = {}) {
  if (!generationIsCurrent(generation)) return;
  if (!routeSupportsOpenSearch()) {
    state.openError = '';
    state.openLoading = false;
    resetOpenResults();
    return;
  }
  resetOpenResults();
  state.openLoading = true;
  state.openError = '';
  try {
    const offset = (state.openPage - 1) * PAGE_SIZE;
    const payload = await searchOpenPrompts({
      query: state.query.trim(),
      category: state.filters.openCategory,
      model: (state.filters.model || state.route?.model) === 'nano-banana-pro' ? 'Nano Banana Pro' : '',
      reference: OPEN_REFERENCE_STATES.has(state.filters.reference) ? state.filters.reference : '',
      limit: PAGE_SIZE,
      offset
    }, { signal: generationSignal(generation) });
    if (!generationIsCurrent(generation)) return;
    const rawItems = asArray(payload?.data);
    const incoming = rawItems.map((raw) => normalizePrompt({ ...raw, collection: 'openlab' })).filter((item) => item.slug);
    state.openItems = [...new Map(incoming.map((item) => [item.slug, item])).values()];
    state.openBySlug = new Map(state.openItems.map((item) => [item.slug, item]));
    state.openTotal = Number(payload?.total) || 0;
    state.openOffset = Number(payload?.offset || 0) + rawItems.length;
    const lastPage = pageCount(state.openTotal);
    if (state.openPage > lastPage) {
      state.openPage = lastPage;
      syncUrlFromState({ replace: true });
      return loadOpenResults({ generation });
    }
    state.openHasMore = state.openPage < lastPage;
  } catch (error) {
    if (!generationIsCurrent(generation) || error?.name === 'AbortError') return;
    state.openError = error instanceof Error ? error.message : String(error);
    resetOpenResults();
  } finally {
    if (generationIsCurrent(generation)) state.openLoading = false;
  }
}

async function prepareOpenListing(generation = state.viewGeneration) {
  if (!generationIsCurrent(generation)) return;
  if (!routeSupportsOpenSearch()) {
    await loadOpenResults({ generation });
    return;
  }
  await Promise.allSettled([
    ensureOpenCategories({ generation }),
    loadOpenResults({ generation })
  ]);
}

async function prepareDynamicListing(generation = state.viewGeneration) {
  await Promise.allSettled([
    prepareOpenListing(generation),
    loadProductResults({ generation })
  ]);
}

async function loadData() {
  const generation = beginViewGeneration();
  state.loadError = '';
  state.loaded = false;
  app.innerHTML = loadingTemplate();
  try {
    state.route = parseRoute(location.pathname);
    applyRouteDefaults();
    await ensureProductCatalog();
    if (!generationIsCurrent(generation)) return;
    // The localhost-only model list comes from validated product facets. Parse
    // the initial URL again so a direct Grok route resolves after that merge.
    state.route = parseRoute(location.pathname);
    applyRouteDefaults();
    await ensureFreeSamples();
    if (!generationIsCurrent(generation)) return;
    if (state.route.kind === 'home') {
      const homePayload = await fetchJson('/assets/prompts-home.json?v=20260914-1');
      if (!generationIsCurrent(generation)) return;
      installCatalogPayload(homePayload);
    } else if (routeNeedsFullCatalog()) {
      await ensureFullCatalog();
    }
    if (!generationIsCurrent(generation)) return;
    state.loaded = true;
    await renderApp(generation, { preservePanels: true });
  } catch (error) {
    if (!generationIsCurrent(generation)) return;
    state.loadError = error instanceof Error ? error.message : String(error);
    renderLoadError();
  }
}

function parseRoute(pathname) {
  let segments = String(pathname || '/prompts/')
    .replace(/\/+$/, '')
    .split('/')
    .filter(Boolean);
  const promptsIndex = segments.indexOf('prompts');
  if (promptsIndex >= 0) segments = segments.slice(promptsIndex + 1);
  if (!segments.length) return { kind: 'home' };
  const first = decodeURIComponent(segments[0]);
  if (MEDIA.some((media) => media.slug === first) || first === 'web') {
    const media = first === 'web' ? 'webpage' : first;
    if (segments[1] === 'use-cases') return { kind: 'category', group: 'use-cases', slug: 'all', media };
    if (segments[1]) return { kind: 'category', group: 'subjects', slug: decodeURIComponent(segments[1]), media };
    return { kind: 'media', media };
  }
  if (first === 'model' && segments[1]) {
    return { kind: segments[2] === 'explore' ? 'explore' : 'model', model: normalizeModel(segments[1]) };
  }
  if (first === 'category' && segments[1] && segments[2]) {
    return { kind: 'category', group: segments[1], slug: decodeURIComponent(segments[2]) };
  }
  if (first === 'search') return { kind: 'search' };
  if (first === 'item' && segments[1]) return { kind: 'item', slug: decodeURIComponent(segments[1]) };
  if (first === 'pack' && segments[1]) return { kind: 'pack', slug: decodeURIComponent(segments[1]) };
  if (/-prompts$/.test(first)) {
    const legacyModel = first
      .replace(/-prompts$/, '')
      .replace('seedream-4-dot-5', 'seedream-4-5');
    return { kind: segments[1] === 'explore' ? 'explore' : 'model', model: normalizeModel(legacyModel) };
  }
  return { kind: 'not-found' };
}

function applyRouteDefaults() {
  const params = new URLSearchParams(location.search);
  state.query = params.get('q') || '';
  const requestedCollection = params.get('collection');
  state.collection = requestedCollection === 'openlab'
    ? 'full'
    : (COLLECTIONS.has(requestedCollection) ? requestedCollection : 'all');
  if (requestedCollection === 'openlab') {
    params.set('collection', 'full');
    if (params.has('openPage') && !params.has('page')) params.set('page', params.get('openPage'));
    params.delete('openPage');
    history.replaceState({}, '', `${location.pathname}?${params}`);
  }
  const route = state.route;
  if (!params.has('collection') && state.productAvailable && ['media', 'model', 'explore', 'category'].includes(route.kind)) {
    state.collection = 'full';
  }
  resetResultPages();
  if (state.collection === 'full') state.productPage = parsePageNumber(params.get('page') || params.get('productPage') || params.get('openPage'));
  if (state.collection === 'curated') state.curatedPage = parsePageNumber(params.get('page'));
  if (state.collection === 'all') {
    state.curatedPage = parsePageNumber(params.get('curatedPage'));
    state.productPage = parsePageNumber(params.get('page') || params.get('productPage') || params.get('openPage'));
  }
  state.filters = freshFilters();
  state.visibleLimit = PAGE_SIZE;
  state.language = 'zh';
  state.packIndex = 0;
  if (route.kind === 'media') state.filters.media = route.media;
  if (route.kind === 'model' || route.kind === 'explore') state.filters.model = route.model;
  if (route.kind === 'category') {
    const key = CATEGORY_GROUPS[route.group]?.key;
    if (key === 'useCases' && route.slug !== 'all') state.filters.useCase = route.slug;
    if (key === 'styles') state.filters.style = route.slug;
    if (key === 'subjects') state.filters.subject = route.slug;
    if (route.media) state.filters.media = route.media;
  }
  for (const key of ['model', 'media', 'usage', 'reference', 'openCategory', 'useCase', 'style', 'subject', 'sort']) {
    if (params.has(key)) state.filters[key] = params.get(key) || '';
  }
  if (params.get('free') === '1') state.filters.freeOnly = true;
  if (route.kind === 'home') {
    state.openError = '';
    state.openCategoriesError = '';
    resetOpenResults();
    resetProductResults();
  }
}

function loadingTemplate() {
  const cards = Array.from({ length: 3 }, () => `
    <div class="loading-card" aria-hidden="true">
      <span class="loading-media"></span>
      <span class="loading-body"><i></i><i></i><i></i></span>
    </div>`).join('');
  return `
    <section class="loading-shell" data-ui="loading-state" aria-label="正在加载">
      <div class="loading-line loading-line-wide"></div>
      <div class="loading-line"></div>
      <div class="loading-grid">${cards}</div>
    </section>`;
}

function renderLoadError() {
  app.innerHTML = `
    <section class="page-shell section" data-ui="error-state">
      <strong>暂时无法读取做图提示词库</strong>
      <p>页面暂时没有加载成功，请稍后重试。</p>
      <button class="button button-primary" type="button" data-action="retry">重新加载</button>
    </section>`;
}

async function renderApp(generation = state.viewGeneration, { preservePanels = false } = {}) {
  if (!generationIsCurrent(generation)) return;
  if (!preservePanels) closeMobilePanels();
  const route = state.route || { kind: 'home' };
  if (route.kind === 'pack') await ensurePackMetadata();
  if (!generationIsCurrent(generation)) return;
  if (routeNeedsFullCatalog(route)) await ensureFullCatalog();
  if (!generationIsCurrent(generation)) return;
  if (route.kind === 'item') {
    await renderDetailPage(route.slug, generation);
  } else if (route.kind === 'pack') {
    await renderPackPage(route.slug, generation);
  } else if (route.kind === 'home') {
    renderHomePage();
  } else if (['media', 'model', 'explore', 'category', 'search'].includes(route.kind)) {
    await prepareDynamicListing(generation);
    if (!generationIsCurrent(generation)) return;
    renderListingPage(route);
  } else {
    renderNotFound();
  }
  if (generationIsCurrent(generation)) {
    updateHeaderCurrent();
    updateSeo(route);
  }
}

function homeHeroTemplate() {
  return `
    <section class="page-shell hero" data-ui="hero">
      <div class="hero-copy">
        <p class="eyebrow">中国大陆直接访问</p>
        <h1>KevinSolo<br><mark>做图提示词库</mark></h1>
        <p class="hero-lead">用中文搜索图片、视频和网页提示词。12 条完整样例可直接查看和复制；其他内容先看任务、模型与预览，解锁后查看完整提示词。</p>
        <p class="hero-bridge">这是给创作任务已经明确的人使用的执行工具；不负责方向判断，也不提供在线生成服务。</p>
        ${state.productAvailable ? `
          <div class="catalog-ready" data-ui="full-catalog-status">
            <strong>${escapeHtml(state.productPrimaryStatus)}</strong>
            <span>${escapeHtml(state.productSecondaryStatus)}</span>
          </div>` : ''}
        <div class="hero-actions">
          <a class="button button-primary" href="/prompts/search" data-nav>搜索提示词</a>
          <button class="button button-secondary" type="button" data-action="free">只看免费样例</button>
          <button class="button" type="button" data-action="unlock">99元解锁完整库</button>
        </div>
      </div>
      <div class="hero-collage" aria-label="图片、视频和网页提示词示意">
        <div class="collage-card collage-a"><span>商业图片·中文说明</span></div>
        <div class="collage-card collage-b"><span>视频分镜</span></div>
        <div class="collage-card collage-c"><span>网页需求</span></div>
      </div>
    </section>`;
}

function mediaSectionTemplate() {
  const displayedMediaTotal = MEDIA.reduce((sum, media) => sum + countBy('mediaType', media.slug), 0);
  const catalogTotal = state.productAvailable ? state.productSearchCatalogTotal : state.catalogTotal;
  const otherMediaTotal = Math.max(0, catalogTotal - displayedMediaTotal);
  return `
    <section class="section section-yellow">
      <div class="page-shell">
        <div class="section-heading">
          <h2>先按你要做的媒介开始</h2>
          <p>不需要先理解模型。先选图片、视频或网页，再找具体任务。</p>
        </div>
        <div class="media-grid">
          ${MEDIA.map((media, index) => `
            <a class="media-card" href="/prompts/${media.slug}" data-nav data-media-link="${media.slug}">
              <span class="card-index">0${index + 1}</span>
              <div>
                <h3>${escapeHtml(media.name)}</h3>
                <p>${escapeHtml(media.description)}</p>
                <span class="arrow-link">浏览 ${countBy('mediaType', media.slug)} 条 →</span>
              </div>
            </a>`).join('')}
        </div>
        ${otherMediaTotal > 0 ? `<p class="media-count-note" data-ui="other-media-count">另有 ${otherMediaTotal.toLocaleString('zh-CN')} 条媒介未标注，已计入总数，可通过搜索查找。</p>` : ''}
      </div>
    </section>`;
}

function modelSectionTemplate() {
  return `
    <section class="section section-paper">
      <div class="page-shell">
        <div class="section-heading">
          <h2>按你手上的模型找提示词</h2>
          <p>可按 ${MODELS.length} 个常用模型直接浏览，也可以在搜索里继续筛选。</p>
        </div>
        <div class="model-grid">
          ${MODELS.map((model) => `
            <a class="model-card" href="/prompts/model/${model.slug}" data-nav data-model-link="${model.slug}">
              <div class="model-topline">
                <span class="model-media">${escapeHtml(mediaName(model.media))}</span>
                <span aria-label="箭头">↗</span>
              </div>
              <h3>${escapeHtml(model.name)}</h3>
              <p>${escapeHtml(model.description)}</p>
              <span class="arrow-link">${countBy('model', model.slug)} 条提示词</span>
            </a>`).join('')}
        </div>
      </div>
    </section>`;
}

function renderHomePage() {
  const packs = collectPacks().slice(0, 3);
  app.innerHTML = `
    ${homeHeroTemplate()}
    ${mediaSectionTemplate()}
    ${packs.length ? packSectionTemplate(packs) : ''}
    ${modelSectionTemplate()}
    ${categorySectionTemplate()}
    <section class="section section-paper home-library-section">
      <div class="page-shell">
        <div class="section-heading">
          <h2>12 条免费完整样例</h2>
          <p>这 12 条均可直接查看中文、原文和完整用法，也可以复制到你自己的 AI 应用中使用。</p>
        </div>
        ${listingTemplate()}
        ${homeLibraryCtaTemplate()}
      </div>
    </section>`;
}

function homeLibraryCtaTemplate() {
  const total = state.productAvailable
    ? (state.productEnrichmentAvailable ? state.productSearchCatalogTotal : state.productCoverageTotal)
    : state.catalogTotal;
  const formattedTotal = Math.max(0, total).toLocaleString('zh-CN');
  const freeCount = state.freeItems.length;
  const browseHref = '/prompts/search?collection=full';
  return `
    <aside class="home-library-cta" data-ui="home-library-cta" aria-labelledby="home-library-cta-title">
      <div class="home-library-cta__copy">
        <strong id="home-library-cta-title">还没找到合适的提示词？</strong>
        <p>进入完整列表，继续按关键词、模型、媒介和使用方式筛选。</p>
      </div>
      <div class="home-library-cta__actions">
        <a class="button button-primary" href="${browseHref}" data-nav>浏览全部 ${formattedTotal} 条提示词</a>
        <a class="button button-plain" href="/prompts/search?free=1" data-nav>查看 ${freeCount} 条免费完整样例</a>
      </div>
    </aside>`;
}

function packSectionTemplate(packs) {
  return `
    <section class="section section-green">
      <div class="page-shell">
        <div class="section-heading">
          <h2>新手从这 3 个任务开始</h2>
          <p>每个合集包含 3—4 条配套提示词，按顺序使用，完成一个具体创作任务。</p>
        </div>
        <div class="pack-grid">
          ${packs.map((pack) => `
            <a class="pack-card" href="/prompts/pack/${encodeURIComponent(pack.id)}" data-nav>
              <div class="prompt-media"><div class="media-placeholder"><strong>${escapeHtml(pack.name)}</strong><span>${pack.items.length} 条提示词</span></div></div>
              <div class="prompt-card-body">
                <h3>${escapeHtml(pack.name)}</h3>
                <p>${escapeHtml(pack.summary)}</p>
                <p class="pack-step-note">共 ${pack.items.length} 步 · 建议从第 1 条开始</p>
                <span class="arrow-link">打开合集 →</span>
              </div>
            </a>`).join('')}
        </div>
      </div>
    </section>`;
}

function categorySectionTemplate() {
  const groups = [
    ['useCases', '使用场景', '从海报、封面、电商到人像，先按任务找。'],
    ['styles', '风格', '从编辑感、电影感到手绘和新粗野主义。'],
    ['subjects', '主体', '从人物、产品、食物到空间和植物。']
  ];
  return `
    <section class="section section-yellow">
      <div class="page-shell">
        <div class="section-heading">
          <h2>不知道搜什么，就从分类开始</h2>
          <p>分类只用来找内容，不会替你生成图片或视频。</p>
        </div>
        <div class="category-grid">
          ${groups.map(([key, label, description]) => {
            const values = collectCategoryValues(key).slice(0, 4);
            const first = values[0] || 'all';
            const routeGroup = key === 'useCases' ? 'use-cases' : key;
            return `
              <a class="category-card" href="/prompts/category/${routeGroup}/${encodeURIComponent(first)}" aria-label="浏览${label}分类" data-nav>
                <h3>${label}</h3>
                <p>${description}</p>
                <div class="tag-list">${values.map((value) => `<span class="tag">${escapeHtml(value)}</span>`).join('')}</div>
                <span class="arrow-link">浏览分类 →</span>
              </a>`;
          }).join('')}
        </div>
      </div>
    </section>`;
}

function listingIntro(route) {
  if (route.kind === 'media') {
    const media = MEDIA.find((item) => item.slug === route.media) || MEDIA[0];
    return {
      eyebrow: `${media.short}提示词`,
      title: media.name,
      description: `${media.description}用中文搜索任务和模型，先看标题与预览，解锁后查看完整提示词。`
    };
  }
  if (route.kind === 'model' || route.kind === 'explore') {
    const model = MODELS.find((item) => item.slug === route.model) || MODELS[0];
    return {
      eyebrow: `${mediaName(model.media)}模型`,
      title: `${model.name} 提示词`,
      description: `${model.description}${route.kind === 'explore' ? '这里展示可组合筛选的完整列表。' : '先看推荐，也可进入完整探索列表。'}`
    };
  }
  if (route.kind === 'category') {
    const group = CATEGORY_GROUPS[route.group] || CATEGORY_GROUPS['use-cases'];
    return {
      eyebrow: group.label,
      title: route.slug === 'all' ? `${group.label}分类` : route.slug,
      description: `按「${route.slug === 'all' ? group.label : route.slug}」浏览，并继续叠加模型、媒介、用法和免费条件。`
    };
  }
  return {
    eyebrow: '普通关键词搜索',
    title: '搜索提示词',
    description: '支持中文关键词搜索标题、任务、模型、场景、标签和摘要；部分来源保留英文标题与原文。'
  };
}

function renderListingPage(route) {
  const intro = listingIntro(route);
  const crumbs = [{ href: '/prompts/', label: '做图提示词库' }, { label: intro.title }];
  const modelExplore = route.kind === 'model'
    ? `<a class="button button-secondary" href="/prompts/model/${route.model}/explore" data-nav>进入完整探索</a>`
    : '';
  const model = route.kind === 'model' ? MODELS.find((item) => item.slug === route.model) : null;
  const modelCount = model ? countBy('model', model.slug) : 0;
  const coverageNote = model && modelCount < 6
    ? `<aside class="page-shell">
        <div class="coverage-note" data-ui="coverage-note">
          <strong>当前收录 ${modelCount} 条经校验的 ${escapeHtml(model.name)} 提示词。</strong>
          <p>这里不把其他模型内容改名凑数。你仍可浏览<a href="/prompts/${model.media}" data-nav>同媒介提示词</a>，并在使用前核对自己的模型能力。</p>
        </div>
      </aside>`
    : '';
  app.innerHTML = `
    <section class="page-shell page-intro listing-intro">
      <div>
        ${breadcrumbTemplate(crumbs)}
        <p class="eyebrow">${escapeHtml(intro.eyebrow)}</p>
        ${route.kind === 'search' ? '' : `<h1>${escapeHtml(intro.title)}</h1>`}
        <p>${escapeHtml(intro.description)}</p>
      </div>
      <div class="intro-stamp${modelExplore ? ' has-action' : ''}">
        <div class="intro-stamp-copy">
          <strong>复制后去你自己的 AI 应用</strong>
          <span>不提供在线生成，不代替模型账号或应用。</span>
        </div>
        ${modelExplore}
      </div>
    </section>
    ${coverageNote}
    <section class="page-shell library-section">
      ${listingTemplate()}
    </section>`;
}

function listingTemplate() {
  return `
    <form class="search-panel" data-ui="search-form" role="search">
      <div class="search-wrap">
        <input class="search-input" type="search" name="q" value="${escapeHtml(state.query)}" aria-label="搜索提示词" placeholder="试试：咖啡海报、职业人像、电商产品图">
        <button class="search-submit" type="submit" aria-label="搜索">搜索</button>
      </div>
    </form>
    ${mobilePrimaryFiltersTemplate()}
    ${filterPanelTemplate()}
    <section id="results-region" tabindex="-1" role="region" aria-label="搜索结果">${resultsTemplate()}</section>`;
}

function mobileSecondaryFilterText() {
  const referenceLabels = {
    'not-required': '不需要参考图',
    'required-count-unknown': '需要参考图，数量未提供',
    'required-count-known': '需要明确数量的参考图'
  };
  const active = [
    state.filters.reference ? `参考图：${referenceLabels[state.filters.reference] || state.filters.reference}` : '',
    state.filters.useCase ? `场景：${state.filters.useCase}` : '',
    state.filters.style ? `风格：${state.filters.style}` : '',
    state.filters.subject ? `主体：${state.filters.subject}` : '',
    state.filters.sort !== 'default' ? `排序：${new Map(sortOptions()).get(state.filters.sort) || state.filters.sort}` : ''
  ].filter(Boolean);
  return active.length ? `更多筛选：${active.join(' · ')}` : '更多筛选：未设置';
}

function mobilePrimaryFiltersTemplate() {
  return `
    <section class="mobile-primary-filters" data-ui="mobile-primary-filters" role="region" aria-label="常用筛选">
      <div class="mobile-primary-grid">
        ${selectTemplate('model', '模型', [['', '全部模型'], ...FILTER_MODELS.map((item) => [item.slug, item.name])], state.filters.model, { idPrefix: 'mobile-filter' })}
        ${selectTemplate('media', '媒介', [['', '全部媒介'], ...MEDIA.map((item) => [item.slug, item.short])], state.filters.media, { idPrefix: 'mobile-filter' })}
        ${selectTemplate('usage', '使用类型', [['', '全部用法'], ...Object.entries(USAGE_LABELS).filter(([value]) => value !== 'unknown')], state.filters.usage, { idPrefix: 'mobile-filter' })}
      </div>
      <div class="mobile-primary-actions">
        <button class="free-toggle" type="button" data-action="toggle-free" aria-pressed="${state.filters.freeOnly}">只看免费内容</button>
        <button class="button mobile-filter-button" type="button" data-action="open-filter" aria-label="更多筛选" aria-expanded="false" aria-controls="prompt-filter-panel">更多筛选</button>
      </div>
      <p class="mobile-filter-summary" data-ui="secondary-filter-summary" aria-live="polite">${escapeHtml(mobileSecondaryFilterText())}</p>
    </section>`;
}

function filterPanelTemplate() {
  const useCases = collectCategoryValues('useCases');
  const styles = collectCategoryValues('styles');
  const subjects = collectCategoryValues('subjects');
  return `
    <section class="filter-panel" id="prompt-filter-panel" data-ui="filter-panel" aria-label="提示词筛选" role="region" tabindex="-1">
      <div class="filter-panel-heading">
        <strong id="prompt-filter-title">更多筛选</strong>
        <button class="button button-plain" type="button" data-action="close-filter" aria-label="关闭筛选">关闭</button>
      </div>
      ${selectTemplate('model', '模型', [['', '全部模型'], ...FILTER_MODELS.map((item) => [item.slug, item.name])], state.filters.model, { className: 'filter-field-primary' })}
      ${selectTemplate('media', '媒介', [['', '全部媒介'], ...MEDIA.map((item) => [item.slug, item.short])], state.filters.media, { className: 'filter-field-primary' })}
      ${selectTemplate('usage', '使用类型', [['', '全部用法'], ...Object.entries(USAGE_LABELS).filter(([value]) => value !== 'unknown')], state.filters.usage, { className: 'filter-field-primary' })}
      ${selectTemplate('reference', '参考图', [['', '参考图要求'], ['not-required', '不需要参考图'], ['required-count-unknown', '需要参考图，数量未提供'], ['required-count-known', '需要明确数量的参考图']], state.filters.reference)}
      ${selectTemplate('useCase', '使用场景', [['', '全部场景'], ...useCases.map((value) => [value, value])], state.filters.useCase)}
      ${selectTemplate('style', '风格', [['', '全部风格'], ...styles.map((value) => [value, value])], state.filters.style)}
      ${selectTemplate('subject', '主体', [['', '全部主体'], ...subjects.map((value) => [value, value])], state.filters.subject)}
      ${selectTemplate('sort', '排序', sortOptions(), state.filters.sort)}
      <button class="free-toggle filter-panel-free" type="button" data-action="toggle-free" aria-pressed="${state.filters.freeOnly}">只看免费内容</button>
      <button class="button button-plain" type="button" data-action="clear" aria-label="清空搜索和筛选">清空</button>
      <button class="button button-primary filter-apply" type="button" data-action="apply-filter">应用筛选</button>
    </section>`;
}

function selectTemplate(name, label, options, current, { idPrefix = 'filter', className = '' } = {}) {
  return `
    <div class="filter-field${className ? ` ${className}` : ''}">
      <label for="${idPrefix}-${name}">${label}</label>
      <select id="${idPrefix}-${name}" name="${name}" aria-label="${label}" data-filter-control>
        ${options.map(([value, optionLabel]) => `<option value="${escapeHtml(value)}"${String(value) === String(current) ? ' selected' : ''}>${escapeHtml(optionLabel)}</option>`).join('')}
      </select>
    </div>`;
}

function sortOptions() {
  const options = [['default', '默认'], ['latest', '最新'], ['recommended', '推荐']];
  if (state.items.some((item) => item.popularity > 0)) options.push(['popular', '热门']);
  return options;
}

function getFilteredItems() {
  const items = state.items.filter((item) => {
    if (state.filters.model && item.model !== state.filters.model) return false;
    if (state.filters.media && item.mediaType !== state.filters.media) return false;
    if (state.filters.usage && item.usageType !== state.filters.usage) return false;
    if (['none', 'not-required'].includes(state.filters.reference) && item.referenceImageRequired !== false) return false;
    if (state.filters.reference === 'required' && item.referenceImageRequired !== true) return false;
    if (state.filters.reference === 'required-count-unknown' && !(item.referenceImageRequired === true && item.referenceImageCount === null)) return false;
    if (state.filters.reference === 'required-count-known' && !(item.referenceImageRequired === true && Number(item.referenceImageCount) > 0)) return false;
    if (state.filters.useCase && !item.categories.useCases.includes(state.filters.useCase)) return false;
    if (state.filters.style && !item.categories.styles.includes(state.filters.style)) return false;
    if (state.filters.subject && !item.categories.subjects.includes(state.filters.subject)) return false;
    if (state.filters.freeOnly && item.access !== 'free') return false;
    if (!state.query.trim()) return true;
    const publicMetadataFields = [
      item.title,
      item.summary,
      item.model,
      item.modelName,
      item.mediaType,
      mediaName(item.mediaType),
      ...item.categories.useCases,
      ...item.categories.styles,
      ...item.categories.subjects,
      ...item.tags
    ];
    return matchesPromptSearch(state.query, publicMetadataFields);
  });
  return items.sort((a, b) => {
    if (state.filters.sort === 'latest') return dateNumber(b.publishedAt) - dateNumber(a.publishedAt) || a.title.localeCompare(b.title, 'zh-CN');
    if (state.filters.sort === 'recommended') return Number(b.featured) - Number(a.featured) || Number(a.access !== 'free') - Number(b.access !== 'free');
    if (state.filters.sort === 'popular') return b.popularity - a.popularity;
    if (state.query) {
      const query = state.query.trim().toLocaleLowerCase('zh-CN');
      const aExact = a.title.toLocaleLowerCase('zh-CN') === query ? 1 : 0;
      const bExact = b.title.toLocaleLowerCase('zh-CN') === query ? 1 : 0;
      return bExact - aExact;
    }
    return Number(a.access !== 'free') - Number(b.access !== 'free') || dateNumber(b.publishedAt) - dateNumber(a.publishedAt);
  });
}

function dateNumber(value) {
  const date = Date.parse(value || '');
  return Number.isFinite(date) ? date : 0;
}

function pageWindow(current, totalPages) {
  const candidates = new Set([1, totalPages]);
  for (let page = current - 2; page <= current + 2; page += 1) {
    if (page > 0 && page <= totalPages) candidates.add(page);
  }
  const pages = [...candidates].sort((a, b) => a - b);
  const result = [];
  pages.forEach((page, index) => {
    if (index && page - pages[index - 1] > 1) result.push('ellipsis');
    result.push(page);
  });
  return result;
}

function paginationTemplate({ source, total, label }) {
  const totalPages = pageCount(total);
  if (totalPages <= 1) return '';
  const current = clampPage(currentPageFor(source), total);
  const first = ((current - 1) * PAGE_SIZE) + 1;
  const last = Math.min(current * PAGE_SIZE, total);
  const numberItems = pageWindow(current, totalPages).map((page) => page === 'ellipsis'
    ? '<li class="result-pager__ellipsis" aria-hidden="true">…</li>'
    : `<li><button type="button" data-action="page" data-page-source="${source}" data-page="${page}" aria-label="第 ${page} 页"${page === current ? ' aria-current="page"' : ''}>${page}</button></li>`).join('');
  return `
    <nav class="result-pager" data-ui="result-pager" data-page-source="${source}" aria-label="${escapeHtml(label)}分页">
      <p class="result-pager__summary" aria-live="polite">第 ${current} 页，共 ${totalPages} 页 <span>· 显示 ${first}–${last} / ${total} 条</span></p>
      <div class="result-pager__desktop">
        <button type="button" class="result-pager__nav" data-action="page-prev" data-page-source="${source}" aria-label="上一页"${current === 1 ? ' disabled' : ''}>上一页</button>
        <ol class="result-pager__numbers">${numberItems}</ol>
        <button type="button" class="result-pager__nav" data-action="page-next" data-page-source="${source}" aria-label="下一页"${current === totalPages ? ' disabled' : ''}>下一页</button>
      </div>
      <div class="result-pager__mobile">
        <button type="button" class="result-pager__nav" data-action="page-prev" data-page-source="${source}" aria-label="上一页"${current === 1 ? ' disabled' : ''}>上一页</button>
        <output class="result-pager__current" aria-label="当前页">${current} / ${totalPages}</output>
        <button type="button" class="result-pager__nav" data-action="page-next" data-page-source="${source}" aria-label="下一页"${current === totalPages ? ' disabled' : ''}>下一页</button>
      </div>
      <form class="result-pager__jump" data-ui="page-jump" data-page-source="${source}">
        <label for="page-jump-${source}">跳至页码</label>
        <input id="page-jump-${source}" name="page" type="number" inputmode="numeric" min="1" max="${totalPages}" value="${current}" aria-label="跳至页码" required>
        <button type="submit">跳转</button>
      </form>
    </nav>`;
}

function resultsTemplate() {
  const useStaticFreeFallback = state.filters.freeOnly
    && ['all', 'full'].includes(state.collection);
  const useStaticCatalog = state.route?.kind === 'home'
    || !state.productAvailable
    || state.collection === 'curated'
    || useStaticFreeFallback;
  const includeStaticFreeSearchResults = state.productAvailable
    && state.route?.kind === 'search'
    && !state.filters.freeOnly
    && state.productTotal === 0
    && ['all', 'full'].includes(state.collection);
  const dynamicSlugs = new Set([...state.productItems, ...state.openItems].map((item) => item.slug));
  const staticFreeSearchResults = includeStaticFreeSearchResults
    ? getFilteredItems().filter((item) => item.access === 'free' && !dynamicSlugs.has(item.slug))
    : [];
  const unpagedCuratedResults = (!useStaticFreeFallback && ((state.collection === 'full' && state.productAvailable) || !useStaticCatalog))
    ? staticFreeSearchResults
    : getFilteredItems();
  const curatedResults = state.route?.kind === 'home'
    ? unpagedCuratedResults.filter((item) => item.access === 'free')
    : unpagedCuratedResults;
  const curatedPage = clampPage(state.curatedPage, curatedResults.length);
  if (curatedPage !== state.curatedPage) {
    state.curatedPage = curatedPage;
    syncUrlFromState({ replace: true });
  }
  const curatedStart = (curatedPage - 1) * PAGE_SIZE;
  const curatedVisible = curatedResults.slice(curatedStart, curatedStart + PAGE_SIZE);
  const productVisible = state.collection === 'curated'
    ? []
    : state.productItems;
  const openVisible = state.collection === 'curated' ? [] : state.openItems;
  const visible = [...new Map([...curatedVisible, ...productVisible, ...openVisible].map((item) => [item.slug, item])).values()];
  const isHomeSummary = state.route?.kind === 'home'
    && !state.catalogLoaded
    && !state.query
    && !state.filters.freeOnly;
  const openTotal = state.collection === 'curated' || !routeSupportsOpenSearch() ? 0 : state.openTotal;
  const productTotal = state.collection === 'curated' || !routeSupportsProductSearch()
    ? 0
    : state.productTotal;
  const resultTotal = isHomeSummary
    ? curatedResults.length
    : curatedResults.length + productTotal + openTotal;
  const shouldGroupResults = ['all', 'full'].includes(state.collection)
    && state.route?.kind !== 'home'
    && visible.length > 0;
  const freeCompleteTotal = shouldGroupResults
    ? getFilteredItems().filter((item) => item.collection !== 'openlab' && item.access === 'free').length
    : 0;
  const groupedSummary = shouldGroupResults
    ? formatGroupedResultSummary({
      productTotal: Math.max(productTotal, curatedResults.length, freeCompleteTotal),
      freeCompleteTotal,
      openTotal,
    })
    : null;
  const catalogSource = productVisible.length ? 'product' : (openVisible.length ? 'open' : (curatedVisible.length ? 'curated' : ''));
  const catalogPager = productTotal > PAGE_SIZE
    ? paginationTemplate({ source: 'product', total: productTotal, label: '完整做图提示词库' })
    : (curatedResults.length > PAGE_SIZE
      ? paginationTemplate({ source: 'curated', total: curatedResults.length, label: 'KevinSolo精选' })
      : '');
  const openPager = openTotal > PAGE_SIZE
    ? paginationTemplate({ source: 'open', total: openTotal, label: '完整做图提示词库' })
    : '';
  const singleSource = productVisible.length || (state.collection === 'full' && routeSupportsProductSearch()) ? 'product' : 'curated';
  const singlePager = singleSource === 'open'
    ? openPager
    : (singleSource === 'product' ? catalogPager : (curatedResults.length > PAGE_SIZE
      ? paginationTemplate({ source: 'curated', total: curatedResults.length, label: 'KevinSolo精选' })
      : ''));
  const resultContent = shouldGroupResults
    ? groupedResultsTemplate(visible, {
      catalogSource,
      catalogPager: catalogPager || openPager,
      groupCounts: groupedSummary,
      mergeFreeIntoLibrary: !state.filters.freeOnly && (
        state.collection === 'full'
        || (state.route?.kind === 'search' && state.collection === 'all')
      ),
    })
    : `<div class="prompt-grid" data-page-source-anchor="${singleSource}" tabindex="-1">
      ${visible.length ? promptCardsTemplate(visible, { priorityCount: state.route?.kind === 'home' ? 0 : 3 }) : (state.openError || state.openCategoriesError || state.openLoading ? '' : emptyStateTemplate())}
    </div>${singlePager}`;
  const resultHint = state.paid
    ? '已恢复完整库访问权限'
    : (visible.some((item) => item.access !== 'free')
      ? '未解锁内容先显示标题、模型和预览'
      : (visible.length ? '当前结果可免费打开查看和复制' : '调整搜索词或筛选条件继续查找'));
  return `
    ${state.productError && ['all', 'full'].includes(state.collection) ? productErrorTemplate() : ''}
    <div class="result-toolbar">
      <p data-ui="result-count">${groupedSummary
        ? escapeHtml(state.collection === 'full' && !state.filters.freeOnly
          ? `完整库共 ${groupedSummary.total} 条。`
          : groupedSummary.summary)
        : `找到 <strong>${resultTotal}</strong> 条${state.filters.freeOnly || isHomeSummary ? '免费内容' : '提示词'}`}</p>
      <p>${resultHint}</p>
    </div>
    ${resultContent}`;
}

function groupedResultsTemplate(items, {
  catalogSource = '', catalogPager = '', groupCounts = null,
  mergeFreeIntoLibrary = false,
} = {}) {
  const catalogItems = items;
  const directLibraryItems = mergeFreeIntoLibrary
    ? [...catalogItems].sort((a, b) => Number(a.access === 'free') - Number(b.access === 'free'))
    : catalogItems.filter((item) => item.access !== 'free');
  const groups = [
    ...(!mergeFreeIntoLibrary ? [{
      key: 'free-complete',
      title: '免费完整体验',
      count: groupCounts?.freeCompleteTotal,
      description: '可直接打开全文并复制，先用这些内容判断产品是否适合你。',
      items: items.filter((item) => item.access === 'free')
    }] : []),
    {
      key: 'library-preview',
      title: mergeFreeIntoLibrary ? '完整做图提示词库' : '完整库预览',
      count: mergeFreeIntoLibrary && Number.isInteger(groupCounts?.total)
        ? groupCounts.total
        : groupCounts?.libraryPreviewTotal,
      description: mergeFreeIntoLibrary
        ? '直接浏览完整库内容；未解锁项目先显示标题、模型和预览。'
        : '先看任务、模型、素材要求和效果预览；解锁后查看完整提示词。',
      items: directLibraryItems
    }
  ];
  const visibleGroups = groups.filter((group) => group.items.length);
  const catalogIndexes = visibleGroups.map((group, index) => index);
  const firstCatalogIndex = catalogIndexes[0] ?? -1;
  const lastCatalogIndex = catalogIndexes.at(-1) ?? -1;
  return visibleGroups
    .map((group, index) => {
      const sourceAnchor = catalogSource && index === firstCatalogIndex
        ? ` data-page-source-anchor="${catalogSource}" tabindex="-1"`
        : '';
      const pager = index === lastCatalogIndex ? catalogPager : '';
      return `
      <section class="result-group" data-ui="result-group" data-result-group="${group.key}" aria-labelledby="result-group-${group.key}"${sourceAnchor}>
        <div class="result-group-heading">
          <h2 id="result-group-${group.key}">${group.title}${Number.isInteger(group.count) ? ` <span>(${group.count} 条)</span>` : ''}</h2>
          <p>${group.description}</p>
        </div>
        <div class="prompt-grid">${promptCardsTemplate(group.items, { priorityCount: index === firstCatalogIndex ? 3 : 0 })}</div>
      </section>${pager}`;
    })
    .join('');
}

function productErrorTemplate() {
  return `
    <div class="open-load-error" data-ui="product-error" role="status">
      <div><strong>提示词目录暂时无法读取</strong><p>已收录内容和扩展内容仍可浏览。</p></div>
      <button class="button button-secondary" type="button" data-action="retry-product">重试提示词目录</button>
    </div>`;
}

function promptCardsTemplate(items, { priorityCount = 0 } = {}) {
  return items.map((item, index) => promptCardTemplate(item, { priority: index < priorityCount })).join('');
}

function promptCardTemplate(item, { priority = false } = {}) {
  const asset = item.previewAssets[0];
  const href = `/prompts/item/${encodeURIComponent(item.slug)}`;
  return `
    <article class="prompt-card" data-ui="prompt-card">
      <div class="prompt-card-media-shell">
        <a href="${href}" data-nav aria-label="查看：${escapeHtml(item.title)}">
          ${mediaPreviewTemplate(item, { card: true, priority })}
        </a>
        ${imageRetryTemplate(asset, { card: true })}
      </div>
      <div class="prompt-card-body">
        <span class="collection-label">${collectionLabel(item)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        ${item.titleOriginal ? `<p class="prompt-title-original" data-ui="title-original" lang="en">${escapeHtml(item.titleOriginal)}</p>` : ''}
        <p>${escapeHtml(item.summary)}</p>
        <div class="card-footer">
          <span>${escapeHtml(item.modelName)}</span>
          <span>${escapeHtml(referenceStatusLabel(item))}</span>
        </div>
      </div>
    </article>`;
}

function referenceStatusLabel(item, { detail = false } = {}) {
  return formatReferenceRequirement(item, { detail });
}

function collectionLabel(item) {
  if (item.collection === 'openlab') return '扩展内容';
  if (item.access === 'free') return '免费完整体验';
  return '完整库预览';
}

function imageRetryTemplate(asset, { card = false } = {}) {
  const imageUrl = asset?.type === 'video' ? asset.poster : asset?.url;
  if (!imageUrl) return '';
  return `
    <div class="media-load-error${card ? ' is-card' : ''}" data-image-error role="status" hidden>
      <span data-image-error-message>预览图加载失败</span>
      <button type="button" data-action="image-retry" data-image-src="${escapeHtml(imageUrl)}" aria-label="重试预览图">重试一次</button>
    </div>`;
}

function videoErrorTemplate() {
  return `
    <div class="media-load-error media-load-error--video" data-video-error role="status" hidden>
      <span data-video-error-message>视频暂时无法播放</span>
      <button type="button" data-action="video-retry" aria-label="重新加载视频">重新加载</button>
    </div>`;
}

function imageLoadAttributes(priority = false) {
  return priority
    ? 'width="960" height="720" loading="eager" decoding="async" fetchpriority="high"'
    : 'width="960" height="720" loading="lazy" decoding="async"';
}

function mediaPreviewTemplate(item, { card = false, priority = false } = {}) {
  const asset = item.previewAssets[0];
  const usageBadge = item.usageType === 'unknown' ? '' : `<span class="usage-badge">${escapeHtml(USAGE_LABELS[item.usageType])}</span>`;
  const badges = card ? `
    <div class="prompt-badges">
      <span class="status-tag${item.access === 'free' ? ' is-free' : ''}">${item.access === 'free' ? '免费完整体验' : '解锁后看全文'}</span>
      ${usageBadge}
    </div>` : '';
  const placeholder = `<div class="media-placeholder"><strong>${escapeHtml(mediaName(item.mediaType))}</strong><span>${escapeHtml(item.modelName)}</span></div>`;
  if (!asset) return `<div class="${card ? 'prompt-media' : 'detail-media'}">${badges}${placeholder}</div>`;
  if (asset.type === 'video') {
    const poster = asset.poster
      ? `<img class="video-poster" src="${escapeHtml(asset.poster)}" alt="${escapeHtml(asset.alt)}" ${imageLoadAttributes(priority)} data-image-preview data-video-poster>`
      : '';
    if (card) {
      return `<div class="prompt-media">${badges}${placeholder}${poster}<span class="video-play-badge" data-video-play-badge aria-hidden="true">▶</span></div>`;
    }
    return `<div class="detail-media" data-video-shell>${placeholder}${poster}<video controls preload="metadata" playsinline${asset.poster ? ` poster="${escapeHtml(asset.poster)}"` : ''} aria-label="${escapeHtml(asset.alt)}" data-video-preview><source src="${escapeHtml(asset.url)}"></video>${videoErrorTemplate()}${imageRetryTemplate(asset)}</div>`;
  }
  const unavailable = item.mediaType === 'video'
    ? '<span class="video-unavailable" data-video-unavailable>暂无可播放视频</span>'
    : '';
  return `<div class="${card ? 'prompt-media' : 'detail-media'}">${badges}${placeholder}<img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.alt)}" ${imageLoadAttributes(priority)} data-image-preview${item.mediaType === 'video' ? ' data-video-poster' : ''}>${unavailable}${card ? '' : imageRetryTemplate(asset)}</div>`;
}

function emptyStateTemplate() {
  return `
    <div class="empty-state" data-ui="empty-state">
      <strong>没有找到匹配的提示词</strong>
      <p>试试减少一个筛选条件，或换成更宽泛的中文任务词。</p>
      <button class="button button-primary" type="button" data-action="clear">清空搜索和筛选</button>
    </div>`;
}

function refreshResults(generation = state.viewGeneration) {
  if (!generationIsCurrent(generation)) return;
  const region = document.querySelector('#results-region');
  if (region) region.innerHTML = resultsTemplate();
  document.querySelectorAll('[data-action="toggle-free"]').forEach((button) => {
    button.setAttribute('aria-pressed', String(state.filters.freeOnly));
  });
  syncFilterControls();
}

function syncFilterControls() {
  document.querySelectorAll('[data-filter-control]').forEach((field) => {
    if (Object.hasOwn(state.filters, field.name)) field.value = state.filters[field.name];
  });
  const summary = document.querySelector('[data-ui="secondary-filter-summary"]');
  if (summary) summary.textContent = mobileSecondaryFilterText();
}

async function resolveDetail(meta, generation = state.viewGeneration) {
  if (!meta) return null;
  if (meta.collection === 'openlab' || isOpenDetailSlug(meta.slug)) {
    try {
      const payload = await getOpenPrompt(meta.slug, { signal: generationSignal(generation) });
      if (!generationIsCurrent(generation)) return null;
      if (!payload?.data) return null;
      const item = normalizePrompt(
        { ...meta, ...payload.data, collection: 'openlab', access: 'paid' },
        { includeFull: payload.success === true && payload?.access?.paid === true },
      );
      item.unlocked = Boolean(item.promptOriginal || item.promptZh);
      state.openBySlug.set(item.slug, item);
      return item;
    } catch {
      return null;
    }
  }
  if (meta.access === 'free' && state.freeBySlug.has(meta.slug)) {
    return { ...meta, ...state.freeBySlug.get(meta.slug), unlocked: true };
  }
  let currentMeta = meta.access === 'free' ? meta : mergeSafeLocalPromptMetadata(meta, null);
  if (meta.productionLookupRequired) {
    try {
      const productionMetadata = await getProductPromptMetadata(meta.slug, {
        signal: generationSignal(generation),
      });
      if (!generationIsCurrent(generation)) return null;
      if (!productionMetadata) return null;
      currentMeta = mergeSafeLocalPromptMetadata(
        currentMeta,
        normalizePrompt({ ...productionMetadata, collection: 'full' }),
      );
      state.productBySlug.set(currentMeta.slug, currentMeta);
    } catch {
      return null;
    }
  }
  if (isLocalProductDetailCandidate({ localCatalogEnabled: LOCAL_PRODUCT_CATALOG, item: meta })) {
    try {
      const localPayload = await getLocalPromptDetail(meta.slug, { signal: generationSignal(generation) });
      if (!generationIsCurrent(generation)) return null;
      if (localPayload?.data) {
        const localMetadata = normalizePrompt({ ...localPayload.data, collection: 'full' });
        currentMeta = mergeSafeLocalPromptMetadata(currentMeta, localMetadata);
        state.productBySlug.set(currentMeta.slug, currentMeta);
      }
    } catch {
      if (meta.localLookupRequired) return null;
      currentMeta = mergeSafeLocalPromptMetadata(currentMeta, null);
    }
  }
  try {
    const payload = await fetchJson(`/api/prompts/get?slug=${encodeURIComponent(currentMeta.slug)}`);
    if (payload?.success && payload.data) {
      const unlocked = normalizePrompt({
        ...payload.data,
        access: currentMeta.access === 'free' ? 'free' : 'paid',
      }, { includeFull: true });
      // Keep canonical public metadata authoritative, but merge the fields that
      // are deliberately omitted from the public index and returned only after
      // the server has verified entitlement.
      return {
        ...currentMeta,
        promptZh: unlocked.promptZh,
        promptOriginal: unlocked.promptOriginal,
        inputRequirements: unlocked.inputRequirements,
        requiredEdits: unlocked.requiredEdits,
        optionalEdits: unlocked.optionalEdits,
        preserveInstructions: unlocked.preserveInstructions,
        negativeConstraints: unlocked.negativeConstraints,
        usageSteps: unlocked.usageSteps,
        usageTips: unlocked.usageTips,
        unlocked: Boolean(unlocked.promptZh || unlocked.promptOriginal)
      };
    }
  } catch {
    return { ...currentMeta, unlocked: false };
  }
  return { ...currentMeta, unlocked: false };
}

async function renderDetailPage(slug, generation = state.viewGeneration) {
  if (!generationIsCurrent(generation)) return;
  let meta = state.itemBySlug.get(slug)
    || state.productBySlug.get(slug)
    || state.openBySlug.get(slug)
    || (isOpenDetailSlug(slug) ? { slug, collection: 'openlab' } : null)
    || (canResolveLocalProductDetailDirectly({
      localCatalogEnabled: LOCAL_PRODUCT_CATALOG && state.productAvailable,
      enrichmentSearchAvailable: state.productEnrichmentAvailable,
      slug,
    })
      ? { slug, collection: 'full', access: 'paid', localLookupRequired: true }
      : null)
    || (PRODUCTION_PRODUCT_CATALOG && state.productAvailable && isValidLocalProductSlug(slug)
      ? { slug, collection: 'full', access: 'paid', productionLookupRequired: true }
      : null);
  if (!meta) {
    renderNotFound('没有找到这条提示词');
    return;
  }
  app.innerHTML = loadingTemplate();
  const item = await resolveDetail(meta, generation);
  if (!generationIsCurrent(generation)) return;
  if (!item) {
    if (meta.productionLookupRequired) {
      renderNotFound('没有找到这条提示词');
      return;
    }
    app.innerHTML = `
      <section class="page-shell section" data-ui="open-detail-error">
        <strong>暂时无法读取这条扩展内容</strong>
        <p>你可以重试；KevinSolo 精选和 99 元解锁入口仍可使用。</p>
        <button class="button button-primary" type="button" data-action="retry">重新加载</button>
      </section>`;
    return;
  }
  if (item.packId) { try { await ensurePackMetadata(); } catch {} }
  if (!generationIsCurrent(generation)) return;
  state.activeDetail = item;
  const related = item.collection === 'openlab' ? await relatedOpenItems(item, generation) : relatedItems(item).slice(0, 3);
  if (!generationIsCurrent(generation)) return;
  const relatedSlugs = new Set(related.map((candidate) => candidate.slug));
  const sameModel = item.collection === 'openlab' ? [] : sameModelItems(item, relatedSlugs).slice(0, 3);
  app.innerHTML = `
    <article class="page-shell detail-shell">
      ${breadcrumbTemplate([
        { href: '/prompts/', label: '做图提示词库' },
        { href: item.mediaType === 'unknown' ? '/prompts/search' : `/prompts/${item.mediaType}`, label: mediaName(item.mediaType) },
        { label: compactChineseTitle(item.title) }
      ])}
      <div class="detail-grid">
        <div class="detail-visual">
          ${mediaPreviewTemplate(item, { priority: true })}
          ${runnableWebpagePreviewTemplate(item)}
          ${referenceAssetsTemplate(item)}
        </div>
        <div class="detail-content">
          <p class="eyebrow">${escapeHtml(mediaName(item.mediaType))}·${escapeHtml(item.modelName)}</p>
          <h1 class="detail-title">${escapeHtml(item.title)}</h1>
          ${item.titleOriginal ? `<p class="detail-title-original" data-ui="detail-title-original" lang="en">${escapeHtml(item.titleOriginal)}</p>` : ''}
          <p class="detail-summary" data-ui="detail-summary">${escapeHtml(item.summary)}</p>
          <div class="detail-meta">
            <span class="status-tag${item.unlocked && item.access === 'free' ? ' is-free' : ''}">${item.unlocked ? (item.access === 'free' ? '免费完整体验' : '已解锁') : '解锁后看全文'}</span>
            ${item.usageType === 'unknown' ? '' : `<span class="usage-badge">${escapeHtml(USAGE_LABELS[item.usageType])}</span>`}
            <span class="tag">${escapeHtml(referenceStatusLabel(item, { detail: true }))}</span>
          </div>
          ${sourceAttributionTemplate(item)}
          ${item.unlocked ? promptPanelTemplate(item) : lockedPanelTemplate(item)}
          ${usagePanelTemplate(item)}
          ${tagsTemplate(item)}
        </div>
      </div>
      ${related.length ? `
        <section class="related-section">
          <h2>相关提示词</h2>
          <div class="prompt-grid">${promptCardsTemplate(related)}</div>
        </section>` : ''}
      ${sameModel.length ? `
        <section class="related-section" data-ui="same-model-prompts">
          <h2>同模型更多提示词</h2>
          <div class="prompt-grid">${promptCardsTemplate(sameModel)}</div>
        </section>` : ''}
    </article>`;
  syncPromptBody();
}

function promptPanelTemplate(item) {
  const promptMeta = promptDisplayMeta(item);
  state.language = promptMeta.hasChineseReference ? 'zh' : 'original';
  return `
    <section class="prompt-panel">
      <div class="panel-heading">
        <h2>完整提示词</h2>
        ${promptMeta.hasChineseReference ? `<div class="prompt-tabs" role="tablist" aria-label="提示词版本">
          <button type="button" role="tab" aria-selected="${state.language === 'zh'}" data-action="language" data-language="zh">中文参考版</button>
          <button type="button" role="tab" aria-selected="${state.language === 'original'}" data-action="language" data-language="original">英文原版</button>
        </div>` : `<span class="prompt-language-state">${escapeHtml(promptMeta.originalLabel)}</span>`}
      </div>
      <p class="prompt-language-note" data-ui="prompt-language-note">${escapeHtml(promptMeta.languageNote)}</p>
      <p class="prompt-variable-note" data-ui="prompt-variable-note" hidden>高亮内容是可替换变量，复制后改成你的主体、品牌、场景或文字即可。</p>
      <pre class="prompt-body" data-ui="prompt-body" tabindex="0"></pre>
      <div class="prompt-actions">
        <button class="button button-primary" type="button" data-action="copy" aria-label="复制当前提示词">复制当前提示词</button>
        <span class="access-note">复制后到你自己的 ${escapeHtml(item.recommendedModel)} 或其他 AI 应用中使用。</span>
      </div>
    </section>`;
}

function lockedPanelTemplate(item) {
  const editStatus = item.requiredEditCount === null
    ? '解锁后检查需要替换的名称、人物、品牌、文字或场景'
    : (item.requiredEditCount ? `需修改 ${item.requiredEditCount} 处` : '未标注必改变量');
  const preparation = referenceStatusLabel(item, { detail: true });
  const structuralPreview = `<p><strong>现在可以判断</strong></p><div class="lock-preview" aria-label="提示词公开预览">任务：${escapeHtml(item.title)}\n推荐模型：${escapeHtml(item.recommendedModel)}\n内容类型：${escapeHtml(mediaName(item.mediaType))}\n参考图：${escapeHtml(preparation)}\n${escapeHtml(editStatus)}</div>`;
  return `
    <section class="locked-panel" data-ui="locked-panel">
      <h2>解锁后查看完整提示词</h2>
      <p>当前先看任务、推荐模型和样图；解锁后可查看并复制完整原文。</p>
      ${structuralPreview}
      <p class="access-note">99元一次付费解锁完整做图提示词库，不是月付、年付或订阅。</p>
      <button class="button button-primary button-wide" type="button" data-action="unlock">99元解锁完整库</button>
    </section>`;
}

function sourceAttributionTemplate(item) {
  if (item.collection === 'openlab') {
    const sourceLink = item.sourceUrl
      ? `<a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看固定版本来源</a>`
      : '';
    return `
      <section class="source-panel" data-ui="source-panel" aria-label="内容说明">
        <h2>内容说明</h2>
        <ul>
          <li>此条已纳入 99 元完整库，授权来源为 YouMind OpenLab 官方 GitHub。</li>
          <li>解锁后可查看英文原版；如后续提供中文内容，只作为参考翻译，模型效果未逐条复测。</li>
          <li>样图用于帮助判断画面方向，不代表固定复现结果。</li>
        </ul>
        ${sourceLink}
      </section>`;
  }
  const original = item.sourceType === 'kevinsolo-original';
  const sourceLink = item.sourceUrl
    ? `<a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看记录来源</a>`
    : '';
  const notes = original
    ? [
      'KevinSolo 原创完整样例，可直接查看提示词与用法。',
      '样图用于说明提示词结构和画面方向，不代表客户项目或业务结果。'
    ]
    : [
      '当前页面先展示任务、推荐模型和样图；解锁后可查看完整提示词。',
      '样图用于帮助判断画面方向，不代表不同模型或参数都能复现同样结果。'
    ];
  return `
    <section class="source-panel" data-ui="source-panel" aria-label="内容说明">
      <h2>内容说明</h2>
      <ul>
        ${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
      </ul>
      ${sourceLink}
    </section>`;
}

async function relatedOpenItems(item, generation = state.viewGeneration) {
  try {
    const payload = await searchOpenPrompts({
      category: item.categorySlugs[0] || '',
      model: 'Nano Banana Pro',
      limit: 4,
      offset: 0
    }, { signal: generationSignal(generation) });
    if (!generationIsCurrent(generation)) return [];
    return asArray(payload?.data)
      .map((raw) => normalizePrompt({ ...raw, collection: 'openlab' }))
      .filter((candidate) => candidate.slug && candidate.slug !== item.slug)
      .slice(0, 3);
  } catch {
    return [];
  }
}

function usagePanelTemplate(item) {
  const type = item.usageType;
  if (type === 'unknown') {
    return `
      <section class="usage-panel" data-ui="usage-panel">
        <h2>拿到全文后怎么开始</h2>
        <p><strong>先完整阅读，再替换与你任务有关的内容</strong>·推荐模型：${escapeHtml(item.recommendedModel)}</p>
        <div class="usage-block"><h3>四步检查</h3><ol>
          <li>先看完整提示词是否要求上传参考图。</li>
          <li>替换名称、人物、品牌、文字和场景等与你任务有关的内容。</li>
          <li>保留构图、镜头、材质与禁止项等结构性约束。</li>
          <li>第一次生成后，一次只调整一类内容。</li>
        </ol></div>
      </section>`;
  }
  const steps = item.usageSteps.length ? item.usageSteps : defaultUsageSteps(type);
  const required = item.requiredEdits;
  const optional = item.optionalEdits;
  const preserve = item.preserveInstructions;
  const requiredFallback = formatRequiredEditGuidance(item);
  return `
    <section class="usage-panel" data-ui="usage-panel">
      <h2>具体使用方法</h2>
      <p><strong>${escapeHtml(USAGE_LABELS[type] || '直接复制')}</strong>·推荐模型：${escapeHtml(item.recommendedModel)}</p>
      <ul class="usage-legend" aria-label="修改图例">
        <li>必须修改</li><li>可选修改</li><li>建议保持</li>
      </ul>
      <div class="usage-columns">
        ${usageSpecificTemplate(item)}
        ${listBlock('使用步骤', steps, true)}
        ${editBlock('必须修改', required, requiredFallback)}
        ${editBlock('可选修改', optional, '可按你的品牌或发布场景调整色彩、构图和文字。')}
        ${listBlock('建议保持', preserve.length ? preserve : ['先保留原有结构出第一版，再一次只调整一类变量。'])}
        ${listBlock('使用建议', item.usageTips.length ? item.usageTips : ['先检查模型是否支持当前媒介和参考图数量。'])}
        ${item.negativeConstraints.length ? listBlock('禁止项与负面约束', item.negativeConstraints) : ''}
      </div>
    </section>`;
}

function usageSpecificTemplate(item) {
  if (item.usageType === 'reference-image' || item.usageType === 'reference-style') {
    const referencePreparation = formatReferencePreparation(item);
    return listBlock('参考图准备', item.inputRequirements.length ? item.inputRequirements : [
      referencePreparation,
      '人物图控制身份，产品图控制外观，风格图只控制视觉语言。'
    ]);
  }
  if (item.usageType === 'structured-json') {
    return listBlock('JSON 格式', [
      '只替换标注为可修改的字段值。',
      '保留双引号、花括号、逗号和层级。',
      '复制前检查末尾逗号和引号是否成对。'
    ]);
  }
  if (item.usageType === 'video-storyboard') {
    const details = [
      item.duration ? `时长：${item.duration}` : '时长：按模型当前上限设置',
      item.shotCount ? `镜头数：${item.shotCount}` : '镜头数：保留原有分镜顺序',
      '先确定主体和场景，再按顺序处理运镜、光线和物理效果。',
      '不要删除人物或产品一致性约束。'
    ];
    return listBlock('分镜与一致性', details);
  }
  if (item.usageType === 'webpage') {
    return listBlock('网页需求清单', [
      '替换品牌名或客户名、网站目标和页面类型。',
      '说清视觉风格、功能需求、技术栈和真实文案。',
      '保留输出要求和响应式、可访问性约束。'
    ]);
  }
  if (item.usageType === 'variable') {
    return listBlock('变量替换', [
      formatRequiredEditGuidance(item),
      '完整复制后，搜索方括号或大写变量，确认没有遗漏。'
    ]);
  }
  const directPreparation = item.referenceState === 'not-required'
    ? '这条提示词不需要参考图。'
    : '完整说明中未标注参考图要求，使用前请先检查全文。';
  return listBlock('使用前准备', item.inputRequirements.length ? item.inputRequirements : [
    directPreparation,
    `在你自己的 ${item.recommendedModel} 或兼容应用中使用。`
  ]);
}

function defaultUsageSteps(type) {
  const first = type.startsWith('reference') ? '按顺序上传并检查参考图' : '检查使用前需要的素材';
  return [first, '替换页面标注的必改内容', '复制当前语言的完整提示词', '粘贴到你自己的 AI 应用并检查结果'];
}

function listBlock(title, values, ordered = false) {
  const list = asTextList(values);
  if (!list.length) return '';
  const tag = ordered ? 'ol' : 'ul';
  return `<div class="usage-block"><h3>${escapeHtml(title)}</h3><${tag}>${list.map((value) => `<li>${escapeHtml(value)}</li>`).join('')}</${tag}></div>`;
}

function editBlock(title, edits, fallback) {
  if (!edits.length) return `<div class="usage-block"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(fallback)}</p></div>`;
  return `<div class="usage-block"><h3>${escapeHtml(title)}</h3><ul>${edits.map((edit) => `<li><strong>${escapeHtml(edit.key || edit.label)}</strong>${edit.label && edit.label !== edit.key ? `：${escapeHtml(edit.label)}` : ''}${edit.example ? `，例如「${escapeHtml(edit.example)}」` : ''}</li>`).join('')}</ul></div>`;
}

function referenceAssetsTemplate(item) {
  if (!item.referenceAssets.length) return '';
  return `
    <section class="info-panel">
      <h2>参考图</h2>
      <p>按下方顺序准备，不要用截图或模糊素材替代清晰原图。</p>
      <div class="reference-grid">
        ${item.referenceAssets.map((asset, index) => `<figure><img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.alt || `参考图 ${index + 1}`)}" width="960" height="720" loading="lazy" decoding="async" data-image-preview><figcaption>参考图 ${index + 1}：${escapeHtml(asset.alt || '按此顺序上传')}</figcaption></figure>`).join('')}
      </div>
    </section>`;
}

function runnableWebpagePreviewTemplate(item) {
  if (item.mediaType !== 'webpage') return '';
  const sourceUrl = item.previewAssets.find((asset) => asset.sourceUrl)?.sourceUrl;
  if (!sourceUrl) return '';
  try {
    const url = new URL(sourceUrl, location.origin);
    if (!url.pathname.startsWith('/prompts/previews/') || url.pathname.includes('..')) return '';
    return `<a class="button button-secondary runnable-preview-link" href="${escapeHtml(url.pathname)}" target="_blank" rel="noopener noreferrer">打开可运行网页样例</a>`;
  } catch {
    return '';
  }
}

function tagsTemplate(item) {
  const tags = [...item.categories.useCases, ...item.categories.styles, ...item.categories.subjects, ...item.tags];
  if (!tags.length && !item.packId) return '';
  const pack = state.packs.find((candidate) => candidate.id === item.packId);
  const packLabel = pack?.name || pack?.title || item.packName || '相关合集';
  return `
    <section class="info-panel">
      <h2>分类与归属</h2>
      <div class="tag-list">
        ${[...new Set(tags)].map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        ${item.packId ? `<a class="tag" href="/prompts/pack/${encodeURIComponent(item.packId)}" data-nav>合集：${escapeHtml(packLabel)}</a>` : ''}
      </div>
    </section>`;
}

function syncPromptBody() {
  const body = document.querySelector('[data-ui="prompt-body"]');
  const variableNote = document.querySelector('[data-ui="prompt-variable-note"]');
  const item = state.activeDetail;
  if (!body || !item?.unlocked) return;
  const text = promptTextForLanguage(item);
  body.replaceChildren();
  const matches = [...text.matchAll(promptVariablePattern())];
  if (variableNote) variableNote.hidden = matches.length === 0;
  if (!matches.length) {
    body.textContent = text;
    return;
  }
  let cursor = 0;
  for (const match of matches) {
    body.append(document.createTextNode(text.slice(cursor, match.index)));
    const mark = document.createElement('mark');
    mark.textContent = match[0];
    mark.setAttribute('aria-label', `可替换变量 ${match[0]}`);
    body.append(mark);
    cursor = Number(match.index) + match[0].length;
  }
  body.append(document.createTextNode(text.slice(cursor)));
}

async function renderPackPage(packSlug, generation = state.viewGeneration) {
  if (!generationIsCurrent(generation)) return;
  const pack = collectPacks().find((item) => item.id === packSlug);
  if (!pack) {
    renderNotFound('没有找到这个提示词合集');
    return;
  }
  const meta = pack.items[Math.min(state.packIndex, pack.items.length - 1)];
  app.innerHTML = loadingTemplate();
  const current = await resolveDetail(meta, generation);
  if (!generationIsCurrent(generation)) return;
  state.activeDetail = current;
  app.innerHTML = `
    <article class="page-shell pack-shell">
      ${breadcrumbTemplate([{ href: '/prompts/', label: '做图提示词库' }, { label: pack.name }])}
      <section class="pack-hero">
        <div class="pack-copy">
          <p class="eyebrow">精选提示词合集</p>
          <h1 class="pack-title">${escapeHtml(pack.name)}</h1>
          <p>${escapeHtml(pack.summary)}</p>
          <p><strong>精选理由：</strong>${escapeHtml(pack.featuredReason || '共享同一创作方向，又保留每条的独立用法。')}</p>
          <span class="tag">${pack.items.length} 条提示词</span>
        </div>
        <div class="pack-poster"><strong>你可以<br>创作什么</strong><p>${escapeHtml(pack.whatYouCanCreate.join('、') || '一套视觉一致、构图各有重点的系列内容。')}</p></div>
      </section>
      <p class="pack-sequence-note">建议从第 1 条开始，按顺序完成；如果已经明确需要，也可以直接切换到对应提示词。</p>
      <div class="pack-switcher" role="tablist" aria-label="合集内提示词">
        ${pack.items.map((item, index) => `<button type="button" role="tab" aria-selected="${index === state.packIndex}" data-action="pack-switch" data-index="${index}">${index + 1}. ${escapeHtml(item.title)}</button>`).join('')}
      </div>
      <section class="detail-grid">
        <div class="detail-visual">${mediaPreviewTemplate(current)}${referenceAssetsTemplate(current)}</div>
        <div class="detail-content">
          <p class="eyebrow">第 ${state.packIndex + 1}/${pack.items.length} 步 · 当前提示词 · ${escapeHtml(current.modelName)}</p>
          <h2 class="detail-title">${escapeHtml(current.title)}</h2>
          <p class="detail-summary" data-ui="detail-summary">${escapeHtml(current.summary)}</p>
          ${sourceAttributionTemplate(current)}
          ${current.unlocked ? promptPanelTemplate(current) : lockedPanelTemplate(current)}
          ${usagePanelTemplate(current)}
        </div>
      </section>
      <section class="info-panel">
        <h2>共用素材要求与统一使用建议</h2>
        <div class="usage-columns">
          ${listBlock('共用素材要求', pack.sharedRequirements.length ? pack.sharedRequirements : ['同一人物或产品尽量沿用同一组清晰原图。', '统一画布比例、主色和品牌文字。'])}
          ${listBlock('统一使用建议', pack.usageAdvice.length ? pack.usageAdvice : ['先用第一条确定视觉基准，再继续后续提示词。', '每次只替换一类变量，便于判断变化来源。'])}
        </div>
      </section>
      ${relatedPacksTemplate(pack)}
    </article>`;
  syncPromptBody();
}

function relatedPacksTemplate(pack) {
  const related = pack.relatedPackIds
    .map((id) => state.packs.find((candidate) => candidate.id === id))
    .filter(Boolean);
  if (!related.length) return '';
  return `
    <section class="info-panel" data-ui="related-packs">
      <h2>继续浏览相关合集</h2>
      <div class="tag-list">
        ${related.map((item) => `<a class="tag" href="/prompts/pack/${encodeURIComponent(item.id)}" data-nav>${escapeHtml(item.name)}</a>`).join('')}
      </div>
    </section>`;
}

function collectPacks() {
  const map = new Map(state.packs.map((pack) => [pack.id, { ...pack, items: [] }]));
  for (const pack of state.packs) {
    const target = map.get(pack.id);
    for (const promptId of pack.promptIds) {
      const item = state.items.find((candidate) => candidate.id === promptId || candidate.slug === promptId);
      if (item && !target.items.some((candidate) => candidate.slug === item.slug)) target.items.push(item);
    }
  }
  for (const item of state.items) {
    if (!item.packId) continue;
    if (!map.has(item.packId)) {
      map.set(item.packId, normalizePack({ id: item.packId, title: item.packName || readableSlug(item.packId) }));
      map.get(item.packId).items = [];
    }
    const target = map.get(item.packId);
    if (!target.items.some((candidate) => candidate.slug === item.slug)) target.items.push(item);
  }
  return [...map.values()].filter((pack) => pack.items.length);
}

function relatedItems(item) {
  const candidates = [...state.items, ...state.productItems];
  const explicit = item.relatedPromptIds.map((id) => candidates.find((candidate) => candidate.id === id || candidate.slug === id)).filter(Boolean);
  const fallback = candidates.filter((candidate) => candidate.slug !== item.slug && candidate.model === item.model);
  return [...new Map([...(explicit.length ? explicit : fallback)].map((candidate) => [candidate.slug, candidate])).values()];
}

function sameModelItems(item, excludedSlugs = new Set()) {
  if (item.model === 'other') return [];
  return [...state.items, ...state.productItems].filter((candidate) => (
    candidate.slug !== item.slug
    && candidate.model === item.model
    && !excludedSlugs.has(candidate.slug)
  ));
}

function breadcrumbTemplate(items) {
  return `<nav class="breadcrumb" aria-label="面包屑">${items.map((item, index) => `${index ? '<span class="breadcrumb-separator" aria-hidden="true">/</span>' : ''}${item.href ? `<a href="${escapeHtml(item.href)}" data-nav>${escapeHtml(item.label)}</a>` : `<span class="breadcrumb-current" aria-current="page">${escapeHtml(item.label)}</span>`}`).join('')}</nav>`;
}

function compactChineseTitle(value) {
  const title = String(value || '').replace(/\s+/gu, ' ').trim();
  const firstChinese = title.search(/[\u3400-\u9fff]/u);
  return firstChinese > 0 ? title.slice(firstChinese).trim() : title;
}

function countBy(key, value) {
  if (state.productAvailable) {
    if (key === 'model') return Number(state.productStats.byModel?.[modelName(value)]) || 0;
    if (key === 'mediaType') return Number(state.productStats.byMedia?.[value]) || 0;
  }
  if (!state.catalogLoaded) {
    if (key === 'model') return Number(state.catalogStats.byModel?.[modelName(value)]) || 0;
    if (key === 'mediaType') return Number(state.catalogStats.byMedia?.[value]) || 0;
  }
  return state.items.filter((item) => item[key] === value).length;
}

function collectCategoryValues(key) {
  const counts = new Map();
  for (const item of state.items) {
    for (const value of item.categories[key] || []) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN')).map(([value]) => value);
}

function readableSlug(slug) {
  return decodeURIComponent(String(slug || '')).replaceAll('-', ' ');
}

function renderNotFound(message = '没有找到这个页面') {
  app.innerHTML = `
    <section class="page-shell section">
      <div class="empty-state">
        <strong>${escapeHtml(message)}</strong>
        <p>这个链接可能已经调整，请返回做图提示词库继续浏览。</p>
        <a class="button button-primary" href="/prompts/" data-nav>返回做图提示词库</a>
      </div>
    </section>`;
}

function updateHeaderCurrent() {
  document.querySelectorAll('.primary-nav a').forEach((link) => link.removeAttribute('aria-current'));
  const route = state.route;
  const href = route?.kind === 'home'
    ? '/prompts/'
    : (route?.kind === 'media' ? `/prompts/${route.media}` : '');
  if (href) document.querySelector(`.primary-nav a[href="${href}"]`)?.setAttribute('aria-current', 'page');
}

function updateSeo(route) {
  let title = 'KevinSolo做图提示词库｜中文搜索图片、视频与网页提示词';
  let description = '中国大陆直接访问。中文搜索图片、视频和网页提示词，12条免费样例，完整库99元一次付费解锁。';
  if (route.kind === 'item') {
    const item = state.activeDetail?.slug === route.slug
      ? state.activeDetail
      : (state.itemBySlug.get(route.slug) || state.productBySlug.get(route.slug) || state.openBySlug.get(route.slug));
    if (item) { title = `${item.title}｜KevinSolo做图提示词库`; description = item.summary; }
  } else if (['media', 'model', 'explore', 'category', 'search'].includes(route.kind)) {
    const intro = listingIntro(route);
    title = `${intro.title}｜KevinSolo做图提示词库`;
    description = intro.description;
  } else if (route.kind === 'pack') {
    const pack = collectPacks().find((item) => item.id === route.slug);
    if (pack) title = `${pack.name}｜提示词合集｜KevinSolo`;
  }
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = `https://kevinsolo.cn${location.pathname}`;
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', `https://kevinsolo.cn${location.pathname}`);
}

async function navigate(href) {
  const url = new URL(href, location.origin);
  if (url.origin !== location.origin) {
    location.href = url.href;
    return;
  }
  const generation = beginViewGeneration();
  history.pushState({}, '', `${url.pathname}${url.search}`);
  state.route = parseRoute(url.pathname);
  applyRouteDefaults();
  await renderApp(generation);
  if (!generationIsCurrent(generation)) return;
  window.scrollTo({ top: 0, behavior: 'auto' });
  document.querySelector('#main-content')?.focus({ preventScroll: true });
}

function syncUrlFromState({ replace = false, pathname = location.pathname } = {}) {
  const url = new URL(pathname, location.origin);
  if (state.query.trim()) url.searchParams.set('q', state.query.trim());
  if (state.collection !== 'all') url.searchParams.set('collection', state.collection);
  for (const key of ['model', 'media', 'usage', 'reference', 'openCategory', 'useCase', 'style', 'subject']) {
    if (state.filters[key]) url.searchParams.set(key, state.filters[key]);
  }
  if (state.filters.sort !== 'default') url.searchParams.set('sort', state.filters.sort);
  if (state.filters.freeOnly) url.searchParams.set('free', '1');
  if (state.route?.kind !== 'home') {
    if (state.collection === 'full') {
      if (state.productPage > 1) url.searchParams.set('page', String(state.productPage));
    }
    if (state.collection === 'curated' && state.curatedPage > 1) url.searchParams.set('page', String(state.curatedPage));
    if (state.collection === 'all') {
      if (state.productPage > 1) url.searchParams.set('page', String(state.productPage));
    }
  }
  const next = `${url.pathname}${url.search}`;
  if (`${location.pathname}${location.search}` === next) return;
  history[replace ? 'replaceState' : 'pushState']({}, '', next);
}

async function clearSearchAndFilters() {
  const generation = beginViewGeneration();
  state.query = '';
  state.collection = 'all';
  state.filters = freshFilters();
  resetResultPages();
  state.visibleLimit = PAGE_SIZE;
  syncUrlFromState();
  await renderApp(generation);
}

function totalForPageSource(source) {
  if (source === 'product') return state.productTotal;
  if (source === 'open') return state.openTotal;
  return getFilteredItems().length;
}

function focusPageSource(source) {
  const target = document.querySelector(`[data-page-source-anchor="${source}"]`)
    || document.querySelector('#results-region');
  target?.scrollIntoView({ block: 'start', behavior: 'auto' });
  target?.focus({ preventScroll: true });
}

async function changeResultPage(source, requestedPage) {
  if (!['curated', 'product', 'open'].includes(source)) return;
  const nextPage = clampPage(requestedPage, totalForPageSource(source));
  if (nextPage === currentPageFor(source)) {
    focusPageSource(source);
    return;
  }
  const generation = beginViewGeneration();
  setCurrentPage(source, nextPage);
  syncUrlFromState();
  if (source === 'product') await loadProductResults({ generation });
  if (source === 'open') await loadOpenResults({ generation });
  if (!generationIsCurrent(generation)) return;
  refreshResults(generation);
  focusPageSource(source);
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  state.toastTimer = setTimeout(() => { toast.hidden = true; }, 2400);
}

function renderAccessStatus() {
  const target = document.querySelector('[data-ui="access-status"]');
  if (!target) return;
  const role = ['owner', 'customer', 'visitor', 'unknown'].includes(state.accessRole)
    ? state.accessRole
    : 'checking';
  const labels = {
    owner: '站长模式',
    customer: '已解锁用户',
    visitor: '游客浏览',
    unknown: '暂时无法确认访问权限，请刷新重试',
    checking: '正在检查访问权限'
  };
  target.dataset.role = role;
  target.innerHTML = `
    <span class="access-status__label">${labels[role]}</span>
    ${role === 'owner' ? '<button class="access-status__logout" type="button" data-action="access-logout" aria-label="退出站长模式">退出</button>' : ''}`;
  const authenticated = role === 'owner' || role === 'customer';
  document.querySelectorAll('[data-action="unlock"]').forEach((button) => {
    button.hidden = authenticated;
  });
}

async function loadAccessSession() {
  state.accessRole = 'checking';
  renderAccessStatus();
  try {
    const response = await fetch('/api/prompts/session', {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    const payload = await response.json();
    const role = payload?.role;
    state.accessRole = response.ok && ['owner', 'customer', 'visitor'].includes(role)
      ? role
      : 'unknown';
  } catch {
    state.accessRole = 'unknown';
  }
  state.paid = state.accessRole === 'owner' || state.accessRole === 'customer';
  renderAccessStatus();
}

async function logoutAccess(button) {
  button.disabled = true;
  try {
    const response = await fetch('/api/prompts/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' })
    });
    const payload = await response.json();
    if (!response.ok || payload?.role !== 'visitor') throw new Error('logout failed');
    state.accessRole = 'visitor';
    state.paid = false;
    state.activeDetail = null;
    renderAccessStatus();
    showToast('已退出站长模式');
    if (state.loaded) await renderApp(beginViewGeneration());
  } catch {
    state.accessRole = 'unknown';
    renderAccessStatus();
    showToast('退出失败，身份状态暂时无法确认');
  } finally {
    if (button.isConnected) button.disabled = false;
  }
}

async function writeClipboardText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

async function copyCurrentPrompt() {
  const item = state.activeDetail;
  if (!item?.unlocked) return;
  const text = promptTextForLanguage(item);
  if (!text) {
    showToast('当前语言没有可复制内容');
    return;
  }
  await writeClipboardText(text);
  showToast('已复制完整提示词');
  const button = document.querySelector('[data-action="copy"]');
  if (button) {
    clearTimeout(state.copyTimer);
    button.textContent = '已复制';
    state.copyTimer = setTimeout(() => {
      if (button.isConnected) button.textContent = '复制当前提示词';
    }, 2400);
  }
}

async function copyWechatId(button) {
  await writeClipboardText('kevin0915');
  showToast('已复制微信号');
  clearTimeout(state.wechatCopyTimer);
  button.textContent = '已复制';
  state.wechatCopyTimer = setTimeout(() => {
    if (button.isConnected) button.textContent = '复制微信号';
  }, 2400);
}

function openUnlockDialog() {
  if (dialogRoot.firstElementChild) return;
  state.dialogReturnFocus = document.activeElement;
  state.dialogMode = 'purchase';
  dialogRoot.innerHTML = `
    <div class="dialog-backdrop" data-action="dialog-backdrop">
      <section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="unlock-dialog-title">
        <div class="dialog-header">
          <h2 id="unlock-dialog-title">解锁做图提示词库</h2>
          <button class="dialog-close" type="button" data-action="close-dialog" aria-label="关闭解锁对话框">×</button>
        </div>
        <div class="unlock-tabs" role="tablist" aria-label="购买与解锁方式">
          <button id="unlock-tab-purchase" type="button" role="tab" data-action="unlock-mode" data-mode="purchase" aria-selected="true" aria-controls="unlock-panel-purchase">第一次购买</button>
          <button id="unlock-tab-redeem" type="button" role="tab" data-action="unlock-mode" data-mode="redeem" aria-selected="false" aria-controls="unlock-panel-redeem" tabindex="-1">已付款 / 已有兑换码</button>
        </div>
        <section id="unlock-panel-purchase" class="unlock-panel" role="tabpanel" aria-labelledby="unlock-tab-purchase">
          <h3>99 元一次付费买断</h3>
          <p>不是月付、年付或订阅。付款后需要 Kevin 人工核对并发放个人兑换码，付款不会自动解锁。</p>
          <div class="unlock-price">¥99 · 一次付费买断</div>
          <img class="payment-qr" src="/prompts/wechat-pay.jpg" width="180" height="180" alt="KevinSolo做图提示词库99元微信收款码" decoding="async">
          <p class="mobile-qr-note">如果你正在微信内打开本页，可长按二维码识别并付款。</p>
          <div class="wechat-id-row">
            <span>微信号：<strong>kevin0915</strong></span>
            <button class="button button-secondary" type="button" data-action="copy-wechat">复制微信号</button>
          </div>
          <ol class="unlock-steps">
            <li>支付 99 元；</li>
            <li>添加 Kevin 微信并发送付款信息；</li>
            <li>Kevin 人工核对后发放个人兑换码。</li>
            <li>发码需要人工处理；付款前可先加微信确认当次发码安排，避免等待时间不合适。</li>
          </ol>
        </section>
        <section id="unlock-panel-redeem" class="unlock-panel" role="tabpanel" aria-labelledby="unlock-tab-redeem" hidden>
          <h3>已付款 / 已有兑换码</h3>
          <p>闲鱼买家无需先在聊天里提供手机号。首次兑换时，请填写你自己的中国大陆手机号和个人兑换码；兑换码会与该手机号绑定。之后可用同一手机号和兑换码恢复访问。</p>
          <form class="unlock-form" data-ui="unlock-form" novalidate>
            <label for="buyer-phone">你的手机号</label>
            <input id="buyer-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="18" placeholder="请输入首次绑定使用的中国大陆手机号" required aria-describedby="buyer-phone-error">
            <p id="buyer-phone-error" class="field-error" data-ui="phone-error" data-field-error="phone" role="alert" aria-live="polite"></p>
            <label for="access-code">兑换码</label>
            <input id="access-code" name="accessCode" autocomplete="one-time-code" placeholder="KS-XXXX-XXXX-XXXX" required aria-describedby="access-code-error">
            <p id="access-code-error" class="field-error" data-ui="access-code-error" data-field-error="accessCode" role="alert" aria-live="polite"></p>
            <div class="dialog-actions">
              <button class="button button-primary button-wide" type="submit">校验并解锁</button>
              <button class="button button-plain button-wide" type="button" data-action="unlock-mode" data-mode="purchase">返回购买说明</button>
            </div>
            <p class="dialog-message" data-ui="dialog-message" role="status" aria-live="polite"></p>
          </form>
        </section>
      </section>
    </div>`;
  document.body.style.overflow = 'hidden';
  document.querySelector('#unlock-tab-purchase')?.focus();
}

function switchUnlockMode(mode) {
  state.dialogMode = mode === 'redeem' ? 'redeem' : 'purchase';
  const purchase = state.dialogMode === 'purchase';
  const purchaseTab = document.querySelector('#unlock-tab-purchase');
  const redeemTab = document.querySelector('#unlock-tab-redeem');
  const purchasePanel = document.querySelector('#unlock-panel-purchase');
  const redeemPanel = document.querySelector('#unlock-panel-redeem');
  purchaseTab?.setAttribute('aria-selected', String(purchase));
  purchaseTab?.setAttribute('tabindex', purchase ? '0' : '-1');
  redeemTab?.setAttribute('aria-selected', String(!purchase));
  redeemTab?.setAttribute('tabindex', purchase ? '-1' : '0');
  if (purchasePanel) purchasePanel.hidden = !purchase;
  if (redeemPanel) redeemPanel.hidden = purchase;
  if (purchase) purchaseTab?.focus();
  else document.querySelector('#buyer-phone')?.focus();
}

function closeDialog() {
  dialogRoot.replaceChildren();
  document.body.style.overflow = '';
  clearTimeout(state.wechatCopyTimer);
  if (state.dialogReturnFocus instanceof HTMLElement) state.dialogReturnFocus.focus();
}

function dialogMessage(message) {
  const target = document.querySelector('[data-ui="dialog-message"]');
  if (target) target.textContent = message;
}

function setUnlockFieldError(form, name, message) {
  const field = form.elements.namedItem(name);
  const error = form.querySelector(`[data-field-error="${name}"]`);
  if (error) error.textContent = message;
  if (field instanceof HTMLElement) field.setAttribute('aria-invalid', String(Boolean(message)));
}

function validateUnlockForm(form) {
  const formData = new FormData(form);
  const compactPhone = String(formData.get('phone') || '').trim().replace(/[\s-]+/g, '');
  const phone = compactPhone.startsWith('+86')
    ? compactPhone.slice(3)
    : compactPhone.startsWith('0086')
      ? compactPhone.slice(4)
      : compactPhone;
  const accessCode = String(formData.get('accessCode') || '').trim().toUpperCase();
  const errors = {
    phone: !phone
      ? '请输入首次绑定使用的中国大陆手机号'
      : (/^1[3-9]\d{9}$/.test(phone) ? '' : '请输入正确的手机号'),
    accessCode: !accessCode
      ? '请输入兑换码'
      : (/^KS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(accessCode) ? '' : '请输入正确的兑换码')
  };
  setUnlockFieldError(form, 'phone', errors.phone);
  setUnlockFieldError(form, 'accessCode', errors.accessCode);
  const firstError = errors.phone ? form.elements.namedItem('phone') : (errors.accessCode ? form.elements.namedItem('accessCode') : null);
  if (firstError instanceof HTMLElement) firstError.focus();
  return { valid: !errors.phone && !errors.accessCode, phone, accessCode };
}

async function submitUnlockRegistration(form) {
  const { valid, phone, accessCode } = validateUnlockForm(form);
  if (!valid) return;
  dialogMessage('正在校验手机号与兑换码……');
  try {
    const response = await fetch('/api/prompts/checkPaid', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, accessCode })
    });
    const payload = await response.json();
    if (response.ok && payload?.paid === true) {
      state.paid = true;
      state.accessRole = 'customer';
      renderAccessStatus();
      closeDialog();
      showToast('兑换成功，已解锁完整库');
      await renderApp();
      return;
    }
    dialogMessage(response.ok && payload?.success === true && payload?.paid === false
      ? '手机号或兑换码无效、已停用或输入有误，请检查后联系Kevin核对。'
      : '暂时无法校验兑换信息。请稍后重试；如果已经付款，请按购买说明联系Kevin核对。');
  } catch {
    dialogMessage('暂时无法校验兑换信息。请检查网络后重试；如果已经付款，请按购买说明联系Kevin核对。');
  }
}

function openFilterDrawer(trigger) {
  const panel = document.querySelector('[data-ui="filter-panel"]');
  if (!panel) return;
  state.filterReturnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
  document.body.classList.add('filter-open');
  trigger?.setAttribute('aria-expanded', 'true');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'prompt-filter-title');
  panel.focus({ preventScroll: true });
  window.setTimeout(() => {
    panel.querySelector('[data-action="close-filter"], select, button, input')?.focus();
  }, 40);
}

function closeFilterDrawer({ restoreFocus = true } = {}) {
  const panel = document.querySelector('[data-ui="filter-panel"]');
  document.body.classList.remove('filter-open');
  document.querySelector('[data-action="open-filter"]')?.setAttribute('aria-expanded', 'false');
  panel?.setAttribute('role', 'region');
  panel?.removeAttribute('aria-modal');
  panel?.removeAttribute('aria-labelledby');
  if (restoreFocus && state.filterReturnFocus instanceof HTMLElement && state.filterReturnFocus.isConnected) {
    state.filterReturnFocus.focus();
  }
  state.filterReturnFocus = null;
}

function closeMobilePanels() {
  closeFilterDrawer({ restoreFocus: false });
  document.body.classList.remove('menu-open');
  document.querySelector('[data-action="menu"]')?.setAttribute('aria-expanded', 'false');
}

function imageErrorPanel(image) {
  const detailMedia = image.closest('.detail-media');
  if (detailMedia) return detailMedia.querySelector(':scope > [data-image-error]');
  return image.closest('.prompt-card-media-shell')?.querySelector(':scope > [data-image-error]') || null;
}

function retryImagePreview(button) {
  const panel = button.closest('[data-image-error]');
  const container = panel?.closest('.detail-media, .prompt-card-media-shell');
  const image = container?.querySelector('img[data-image-preview]');
  if (!panel || !image || Number(image.dataset.retryCount || 0) >= 1) return;
  image.dataset.retryCount = '1';
  delete image.dataset.failed;
  panel.hidden = true;
  const retryUrl = new URL(button.dataset.imageSrc || image.currentSrc || image.src, location.origin);
  retryUrl.searchParams.set('preview-retry', '1');
  image.src = retryUrl.href;
}

function videoErrorPanel(video) {
  return video?.closest('[data-video-shell]')?.querySelector(':scope > [data-video-error]') || null;
}

function retryVideoPreview(button) {
  const panel = button.closest('[data-video-error]');
  const shell = panel?.closest('[data-video-shell]');
  const video = shell?.querySelector('video[data-video-preview]');
  const source = video?.querySelector('source');
  if (!panel || !video || !source || Number(video.dataset.retryCount || 0) >= 1) return;
  video.dataset.retryCount = '1';
  delete video.dataset.failed;
  panel.hidden = true;
  const retryUrl = new URL(source.src, location.origin);
  retryUrl.searchParams.set('video-retry', '1');
  source.src = retryUrl.href;
  video.load();
}

function markVideoReady(video) {
  if (!video?.matches?.('video[data-video-preview]')) return;
  delete video.dataset.failed;
  const panel = videoErrorPanel(video);
  if (panel) panel.hidden = true;
}

document.addEventListener('click', async (event) => {
  const videoRetry = event.target.closest('[data-action="video-retry"]');
  if (videoRetry) {
    event.preventDefault();
    event.stopPropagation();
    retryVideoPreview(videoRetry);
    return;
  }
  const imageRetry = event.target.closest('[data-action="image-retry"]');
  if (imageRetry) {
    event.preventDefault();
    event.stopPropagation();
    retryImagePreview(imageRetry);
    return;
  }
  const link = event.target.closest('a[data-nav]');
  if (link) {
    event.preventDefault();
    await navigate(link.href);
    return;
  }
  const actionNode = event.target.closest('[data-action]');
  if (!actionNode) return;
  const action = actionNode.dataset.action;
  if (action === 'retry') await loadData();
  if (action === 'free') {
    await navigate('/prompts/search?free=1');
    return;
  }
  if (action === 'toggle-free') {
    const generation = beginViewGeneration();
    if (routeNeedsFullCatalog()) await ensureFullCatalog();
    if (!generationIsCurrent(generation)) return;
    state.filters.freeOnly = !state.filters.freeOnly;
    resetResultPages();
    state.visibleLimit = PAGE_SIZE;
    syncUrlFromState();
    await prepareDynamicListing(generation);
    refreshResults(generation);
  }
  if (action === 'clear') await clearSearchAndFilters();
  if (['page', 'page-prev', 'page-next'].includes(action)) {
    const source = actionNode.dataset.pageSource || '';
    const current = currentPageFor(source);
    const requested = action === 'page'
      ? parsePageNumber(actionNode.dataset.page)
      : current + (action === 'page-next' ? 1 : -1);
    await changeResultPage(source, requested);
  }
  if (action === 'retry-product') {
    const generation = beginViewGeneration();
    state.productLoading = true;
    state.productError = '';
    resetProductResults();
    refreshResults(generation);
    await loadProductResults({ generation });
    refreshResults(generation);
  }
  if (action === 'open-filter') openFilterDrawer(actionNode);
  if (action === 'apply-filter' || action === 'close-filter') closeFilterDrawer();
  if (action === 'menu') {
    const open = document.body.classList.toggle('menu-open');
    actionNode.setAttribute('aria-expanded', String(open));
  }
  if (action === 'access-logout') await logoutAccess(actionNode);
  if (action === 'unlock') openUnlockDialog();
  if (action === 'unlock-mode') switchUnlockMode(actionNode.dataset.mode);
  if (action === 'copy-wechat') await copyWechatId(actionNode);
  if (action === 'close-dialog') closeDialog();
  if (action === 'dialog-backdrop' && event.target === actionNode) closeDialog();
  if (action === 'language') {
    state.language = actionNode.dataset.language === 'original' ? 'original' : 'zh';
    document.querySelectorAll('[data-action="language"]').forEach((button) => button.setAttribute('aria-selected', String(button === actionNode)));
    syncPromptBody();
  }
  if (action === 'copy') await copyCurrentPrompt();
  if (action === 'pack-switch') {
    const generation = beginViewGeneration();
    state.packIndex = Number(actionNode.dataset.index) || 0;
    await renderApp(generation);
  }
});

document.addEventListener('input', async (event) => {
  if (event.target.matches('[data-ui="unlock-form"] input')) {
    const form = event.target.form;
    setUnlockFieldError(form, event.target.name, '');
    dialogMessage('');
  }
  if (event.target.matches('[name="q"]')) {
    const generation = beginViewGeneration();
    state.query = event.target.value;
    resetResultPages();
    state.visibleLimit = PAGE_SIZE;
    if (routeNeedsFullCatalog()) await ensureFullCatalog();
    if (!generationIsCurrent(generation)) return;
    refreshResults(generation);
    if (routeSupportsOpenSearch()) {
      state.openLoading = true;
      state.openError = '';
      resetOpenResults();
      refreshResults(generation);
    }
    if (routeSupportsProductSearch()) {
      state.productLoading = true;
      state.productError = '';
      resetProductResults();
      refreshResults(generation);
    }
    state.openDebounce = window.setTimeout(async () => {
      if (!generationIsCurrent(generation)) return;
      syncUrlFromState({ replace: true });
      await Promise.allSettled([
        routeSupportsOpenSearch() ? ensureOpenCategories({ generation }) : Promise.resolve(),
        loadOpenResults({ generation }),
        loadProductResults({ generation })
      ]);
      refreshResults(generation);
    }, 250);
  }
});

document.addEventListener('change', async (event) => {
  const field = event.target.closest('[data-filter-control]');
  if (!field) return;
  const generation = beginViewGeneration();
  state.filters[field.name] = field.value;
  syncFilterControls();
  resetResultPages();
  state.visibleLimit = PAGE_SIZE;
  if (routeNeedsFullCatalog()) await ensureFullCatalog();
  if (!generationIsCurrent(generation)) return;
  syncUrlFromState();
  state.openLoading = routeSupportsOpenSearch();
  state.openError = '';
  resetOpenResults();
  state.productLoading = routeSupportsProductSearch();
  state.productError = '';
  resetProductResults();
  refreshResults(generation);
  await Promise.allSettled([
    ensureOpenCategories({ generation }),
    loadOpenResults({ generation }),
    loadProductResults({ generation })
  ]);
  refreshResults(generation);
});

document.addEventListener('submit', async (event) => {
  if (event.target.matches('[data-ui="page-jump"]')) {
    event.preventDefault();
    const source = event.target.dataset.pageSource || '';
    const requested = String(new FormData(event.target).get('page') || '');
    await changeResultPage(source, parsePageNumber(requested));
  }
  if (event.target.matches('[data-ui="search-form"]')) {
    event.preventDefault();
    const generation = beginViewGeneration();
    state.query = String(new FormData(event.target).get('q') || '').trim();
    state.route = { kind: 'search' };
    resetResultPages();
    state.visibleLimit = PAGE_SIZE;
    if (routeNeedsFullCatalog()) await ensureFullCatalog();
    if (!generationIsCurrent(generation)) return;
    syncUrlFromState({ pathname: '/prompts/search' });
    await renderApp(generation);
    if (!generationIsCurrent(generation)) return;
    const results = document.querySelector('#results-region');
    results?.scrollIntoView({ block: 'start', behavior: 'auto' });
    results?.focus({ preventScroll: true });
  }
  if (event.target.matches('[data-ui="unlock-form"]')) {
    event.preventDefault();
    await submitUnlockRegistration(event.target);
  }
});

document.addEventListener('error', (event) => {
  const video = event.target.closest?.('video[data-video-preview]');
  if (video) {
    video.dataset.failed = 'true';
    const panel = videoErrorPanel(video);
    if (!panel) return;
    const retried = Number(video.dataset.retryCount || 0) >= 1;
    panel.hidden = false;
    const message = panel.querySelector('[data-video-error-message]');
    const button = panel.querySelector('[data-action="video-retry"]');
    if (message) message.textContent = retried ? '视频仍无法播放' : '视频暂时无法播放';
    if (button) {
      button.disabled = retried;
      button.textContent = retried ? '已重新加载' : '重新加载';
    }
    return;
  }
  const image = event.target.closest?.('img[data-image-preview]');
  if (!image) return;
  image.dataset.failed = 'true';
  image.setAttribute('aria-label', `${image.alt || '效果图'}加载失败`);
  const panel = imageErrorPanel(image);
  if (!panel) return;
  const retried = Number(image.dataset.retryCount || 0) >= 1;
  panel.hidden = false;
  const message = panel.querySelector('[data-image-error-message]');
  const button = panel.querySelector('[data-action="image-retry"]');
  if (message) message.textContent = retried ? '预览图仍无法加载' : '预览图加载失败';
  if (button) {
    button.disabled = retried;
    button.textContent = retried ? '已重试' : '重试一次';
  }
}, true);

document.addEventListener('load', (event) => {
  const image = event.target.closest?.('img[data-image-preview]');
  if (!image) return;
  delete image.dataset.failed;
  const panel = imageErrorPanel(image);
  if (panel) panel.hidden = true;
}, true);

document.addEventListener('loadedmetadata', (event) => {
  markVideoReady(event.target);
}, true);

document.addEventListener('canplay', (event) => {
  markVideoReady(event.target);
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (dialogRoot.firstElementChild) closeDialog();
    else if (document.body.classList.contains('filter-open')) closeFilterDrawer();
    else closeMobilePanels();
    return;
  }
  const dialog = dialogRoot.querySelector('[role="dialog"]');
  if (dialog && event.key === 'Tab') {
    const focusable = [...dialog.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
    )].filter((element) => element.getClientRects().length > 0);
    if (focusable.length) {
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
  const filterPanel = document.body.classList.contains('filter-open')
    ? document.querySelector('[data-ui="filter-panel"]')
    : null;
  if (filterPanel && event.key === 'Tab') {
    const focusable = [...filterPanel.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
    )].filter((element) => element.getClientRects().length > 0);
    if (focusable.length) {
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
  const languageTab = event.target.closest?.('[data-action="language"]');
  if (languageTab && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    const tabs = [...languageTab.parentElement.querySelectorAll('[data-action="language"]')];
    const current = tabs.indexOf(languageTab);
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(current + step + tabs.length) % tabs.length];
    next.focus();
    next.click();
  }
});

window.addEventListener('popstate', async () => {
  const generation = beginViewGeneration();
  state.route = parseRoute(location.pathname);
  applyRouteDefaults();
  await renderApp(generation);
});

async function initializePromptsApp() {
  await loadAccessSession();
  await loadData();
}

void initializePromptsApp();
