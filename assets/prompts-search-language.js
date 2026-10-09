export const SEARCH_CONCEPTS = [
  { aliases: ['汽车内饰'], terms: ['automotive interior', 'car interior', 'vehicle interior'] },
  { aliases: ['车内'], terms: ['car interior', 'inside a car', 'in-car'] },
  { aliases: ['室内效果图'], terms: ['interior rendering', 'interior render', '3d interior', 'home render', 'room render', 'architectural rendering', 'architectural visualization'], mediaIntent: 'image' },
  { aliases: ['房屋户型'], terms: ['floor plan', 'house plan', 'home layout', 'apartment layout'] },
  { aliases: ['网页设计'], terms: ['web design', 'website design', 'webpage design', 'landing page'], mediaIntent: 'webpage' },
  { aliases: ['产品摄影'], terms: ['product photography', 'product photo', 'commercial photography'], mediaIntent: 'image' },
  { aliases: ['人物写真'], terms: ['portrait photography', 'portrait photo', 'editorial portrait', 'fashion portrait'], mediaIntent: 'image' },
  { aliases: ['海报'], terms: ['poster', 'flyer', 'banner'] },
  { aliases: ['封面'], terms: ['cover', 'poster', 'thumbnail', 'banner'] },
  { aliases: ['人像', '肖像', '头像', '人物'], terms: ['portrait', 'headshot', 'profile', 'avatar', 'character', 'person'], mediaIntent: 'image' },
  { aliases: ['咖啡'], terms: ['coffee', 'cafe', 'espresso', 'latte'] },
  { aliases: ['饮料'], terms: ['beverage', 'drink', 'drinks', 'juice', 'soda'] },
  { aliases: ['电商'], terms: ['ecommerce', 'e-commerce', 'product', 'commercial', 'advertising'] },
  { aliases: ['产品发布'], terms: ['product launch', 'product release', 'launch campaign'] },
  { aliases: ['产品', '商品'], terms: ['product', 'commercial', 'packaging'] },
  { aliases: ['品牌宣传', '品牌推广'], terms: ['brand campaign', 'brand promotion', 'branding'] },
  { aliases: ['主图'], terms: ['main image', 'hero image', 'product image'] },
  { aliases: ['信息图'], terms: ['infographic', 'information graphic', 'educational visual'] },
  { aliases: ['漫画', '分镜'], terms: ['comic', 'storyboard', 'story board', 'panel sequence'] },
  { aliases: ['参考图'], terms: ['reference image', 'input image', 'uploaded image'] },
  { aliases: ['改造', '转换', '重绘'], terms: ['transform', 'restyle', 'edit', 'variation', 'convert'] },
  { aliases: ['电影'], terms: ['cinematic', 'movie', 'film'] },
  { aliases: ['场景'], terms: ['scene', 'cinematic'] },
  { aliases: ['室内设计'], terms: ['interior design', 'interior', 'living space'] },
  { aliases: ['室内'], terms: ['indoor'] },
  { aliases: ['社交媒体'], terms: ['social media', 'instagram', 'tiktok'] },
  { aliases: ['故事'], terms: ['story', 'narrative', 'storytelling'] },
  { aliases: ['短片'], terms: ['short film', 'video', 'film'], mediaIntent: 'video' },
  { aliases: ['服务'], terms: ['service', 'services', 'business'] },
  { aliases: ['图片', '图像'], terms: ['image', 'photo', 'photograph'] },
  { aliases: ['视频'], terms: ['video', 'motion', 'storyboard', 'film'], mediaIntent: 'video' },
  { aliases: ['旅行', '旅游'], terms: ['travel', 'destination'] },
  { aliases: ['美食', '食物'], terms: ['food', 'culinary', 'dish'] },
  { aliases: ['职业'], terms: ['professional', 'business', 'corporate', 'career'] },
  { aliases: ['网页', '网站', '官网'], terms: ['webpage', 'website', 'landing page'], mediaIntent: 'webpage' },
];

function normalizeSearchText(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('zh-CN').trim();
}

function uniqueTerms(values) {
  return [...new Set(values.map(normalizeSearchText).filter(Boolean))];
}

const SEARCH_NEGATION_PREFIXES = Object.freeze([
  '无', '没有', '不含', '不包含', '不要', '无需', '避免', '排除',
  'no ', 'not ', 'without ', 'exclude ', 'avoid ',
]);

export function buildNegatedSearchNeedles(term) {
  const normalized = normalizeSearchText(term);
  if (!normalized) return [];
  return SEARCH_NEGATION_PREFIXES.map((prefix) => `${prefix}${normalized}`);
}

function fieldIncludesPositiveTerm(field, term) {
  const normalizedField = normalizeSearchText(field);
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedField || !normalizedTerm) return false;
  const negativeNeedles = buildNegatedSearchNeedles(normalizedTerm);
  let position = normalizedField.indexOf(normalizedTerm);
  while (position >= 0) {
    const prefix = normalizedField.slice(0, position);
    if (!negativeNeedles.some((needle) => prefix.endsWith(needle.slice(0, -normalizedTerm.length)))) return true;
    position = normalizedField.indexOf(normalizedTerm, position + normalizedTerm.length);
  }
  return false;
}

function matchedSearchConcepts(normalized) {
  const candidates = [];
  SEARCH_CONCEPTS.forEach((concept, conceptIndex) => {
    for (const alias of concept.aliases) {
      let position = normalized.indexOf(alias);
      while (position >= 0) {
        candidates.push({ concept, conceptIndex, alias, position });
        position = normalized.indexOf(alias, position + alias.length);
      }
    }
  });
  candidates.sort((left, right) => (
    right.alias.length - left.alias.length
    || left.position - right.position
    || left.conceptIndex - right.conceptIndex
  ));

  const occupied = Array(normalized.length).fill(false);
  const usedConcepts = new Set();
  const selected = [];
  for (const candidate of candidates) {
    if (usedConcepts.has(candidate.conceptIndex)) continue;
    const end = candidate.position + candidate.alias.length;
    if (occupied.slice(candidate.position, end).some(Boolean)) continue;
    occupied.fill(true, candidate.position, end);
    usedConcepts.add(candidate.conceptIndex);
    selected.push({ ...candidate, end });
  }
  return selected.sort((left, right) => left.position - right.position);
}

export function buildPromptSearchGroups(query) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];

  let unmatched = normalized;
  const matchedConcepts = matchedSearchConcepts(normalized).map(({ concept, position, end }) => ({
    position,
    end,
    terms: uniqueTerms([...concept.aliases, ...concept.terms]),
  }));
  for (const { position, end } of [...matchedConcepts].sort((left, right) => right.position - left.position)) {
    unmatched = `${unmatched.slice(0, position)}${' '.repeat(end - position)}${unmatched.slice(end)}`;
  }

  const literalGroups = unmatched
    .split(/[\s,，、/|+]+/u)
    .map(normalizeSearchText)
    .filter(Boolean)
    .map((term) => ({ position: normalized.indexOf(term), terms: [term] }));

  return [...matchedConcepts, ...literalGroups]
    .sort((a, b) => a.position - b.position)
    .map(({ terms }) => terms);
}

export function matchesPromptSearch(query, publicMetadataFields) {
  const groups = buildPromptSearchGroups(query);
  if (!groups.length) return !normalizeSearchText(query);
  return groups.every((group) => group.some((term) => (
    publicMetadataFields.some((field) => fieldIncludesPositiveTerm(field, term))
  )));
}
