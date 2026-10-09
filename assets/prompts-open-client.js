const OPEN_API_ROOT = '/api/open-prompts';
const DEFAULT_PAGE_SIZE = 20;

function retryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function requestJson(path, { timeoutMs = 8_000, maxAttempts = 2, signal } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', abortFromCaller, { once: true });
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    let mayRetry = true;
    try {
      const response = await fetch(`${OPEN_API_ROOT}/${path}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 403 && payload?.locked === true) return payload;
        mayRetry = retryableStatus(response.status);
        const error = new Error(payload?.error || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      if (!payload?.success) throw new Error(payload?.error || 'open prompt request failed');
      return payload;
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
      if (error?.name === 'AbortError' && !timedOut) throw error;
      if (!mayRetry || attempt === maxAttempts) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 180 * attempt));
    } finally {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }
  throw lastError;
}

export function openSearchUrl({ query = '', category = '', model = '', media = '', usage = '', reference = '', limit = DEFAULT_PAGE_SIZE, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (category) params.set('category', category);
  if (model) params.set('model', model);
  if (media) params.set('media', media);
  if (usage) params.set('usage', usage);
  if (reference) params.set('reference', reference);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return `search?${params}`;
}

export async function fetchOpenCategories(requestOptions = {}) {
  return requestJson('categories', requestOptions);
}

export async function searchOpenPrompts(options = {}, requestOptions = {}) {
  return requestJson(openSearchUrl(options), requestOptions);
}

export async function getOpenPrompt(slug, requestOptions = {}) {
  return requestJson(`get?slug=${encodeURIComponent(slug)}`, requestOptions);
}
