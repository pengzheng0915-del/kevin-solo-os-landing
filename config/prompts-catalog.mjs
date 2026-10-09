export const MEDIA_TYPES = Object.freeze(['image', 'video', 'webpage']);

export const USAGE_TYPES = Object.freeze([
  'direct',
  'variable',
  'reference-image',
  'reference-style',
  'structured-json',
  'video-storyboard',
  'webpage',
  'pack'
]);

export const PROMPT_MODELS = Object.freeze([
  Object.freeze({
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    mediaType: 'image',
    path: '/prompts/model/nano-banana-pro',
    description: '适合参考图改造、角色一致性与日常视觉创作。'
  }),
  Object.freeze({
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    mediaType: 'image',
    path: '/prompts/model/gpt-image-2',
    description: '适合高质量图像生成、文字排版与复杂画面控制。'
  }),
  Object.freeze({
    id: 'gpt-image-1-5',
    name: 'GPT Image 1.5',
    mediaType: 'image',
    path: '/prompts/model/gpt-image-1-5',
    description: '适合稳定的通用图像生成与视觉草案。'
  }),
  Object.freeze({
    id: 'seedream-4-5',
    name: 'Seedream 4.5',
    mediaType: 'image',
    path: '/prompts/model/seedream-4-5',
    description: '适合中文视觉指令与风格化图像创作。'
  }),
  Object.freeze({
    id: 'seedance-2-5',
    name: 'Seedance 2.5',
    mediaType: 'video',
    path: '/prompts/model/seedance-2-5',
    description: '适合镜头调度、角色一致性与视频分镜。'
  }),
  Object.freeze({
    id: 'seedance-2-0',
    name: 'Seedance 2.0',
    mediaType: 'video',
    path: '/prompts/model/seedance-2-0',
    description: '适合中文视频脚本、运镜与短片生成。'
  }),
  Object.freeze({
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    mediaType: 'webpage',
    path: '/prompts/model/gemini-3-pro',
    description: '适合网页结构、视觉说明与前端实现提示词。'
  })
]);

export const PROMPT_MODEL_NAMES = Object.freeze(PROMPT_MODELS.map((model) => model.name));

export const FREE_SAMPLE_COUNT = 12;

// This is the single product-wide source of truth. API and UI layers import it;
// they must not maintain their own free-sample lists.
export const FREE_SAMPLE_SLUGS = Object.freeze([
  'kevin-structured-product-poster-json',
  'kevin-seedream-editorial-still-life',
  'kevin-product-reveal-triptych',
  'kevin-service-process-infographic',
  'kevin-nano-reference-object-scene',
  'kevin-nano-style-reference-paper-collage',
  'kevin-gpt15-variable-workshop-poster',
  'kevin-gpt2-direct-cutaway-workbench',
  'kevin-seedream-variable-botanical-package',
  'kevin-paper-craft-process-board',
  'kevin-gpt2-editorial-professional-portrait',
  'kevin-seedream-experience-method-board'
]);

export const FREE_SAMPLE_SET = new Set(FREE_SAMPLE_SLUGS);
