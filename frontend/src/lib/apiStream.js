import { getApiBase } from './api';
import { tryRefreshSession } from './apiClient';
import { authHeaders } from './authStorage';

function buildUrl(base, path) {
  return path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** fetch для SSE-потоков (без короткого abort таймаута). */
export async function apiStreamFetch(path, init = {}) {
  const base = await getApiBase();
  const headers = authHeaders(init.headers || {});
  if (init.body && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  let res = await fetch(buildUrl(base, path), { ...init, headers });
  if (res.status === 401) {
    const ok = await tryRefreshSession();
    if (ok) {
      const retryBase = await getApiBase();
      const headers2 = authHeaders(init.headers || {});
      if (init.body && !headers2['Content-Type'] && !headers2['content-type']) {
        headers2['Content-Type'] = 'application/json';
      }
      res = await fetch(buildUrl(retryBase, path), { ...init, headers: headers2 });
    }
  }
  return res;
}

/**
 * Читает SSE с Nexus API (data: {...}\n\n).
 * @param {Response} res
 * @param {{ onThinking?: (t: string) => void, onToken?: (t: string) => void, onImage?: (img: object) => void, onStatus?: (s: string) => void, onSearchRound?: (d: object) => void, onSearchPlan?: (d: object) => void, onPreSearchDone?: (d: object) => void, onToolStart?: (d: object) => void, onToolEnd?: (d: object) => void, onConnectorStatus?: (d: object) => void, onDone?: (d: object) => void, onError?: (msg: string) => void }} handlers
 * @returns {Promise<{ events: number, tokens: number, done: boolean, parseErrors: number }>}
 */
export async function consumeSseResponse(res, handlers = {}) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = typeof err.detail === 'string' ? err.detail : `Ошибка ${res.status}`;
    handlers.onError?.(detail);
    throw new Error(detail);
  }
  if (!res.body) {
    throw new Error('Поток ответа недоступен');
  }

  const ct = res.headers.get('content-type') || '';
  if (import.meta.env.PROD && ct && !ct.includes('text/event-stream')) {
    console.warn('[Nexus] Ответ не SSE — стриминг может не работать. Content-Type:', ct);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const stats = { events: 0, tokens: 0, thinking: 0, done: false, parseErrors: 0, otherTypes: [] };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const block of parts) {
      const line = block
        .split('\n')
        .find((l) => l.startsWith('data:'));
      if (!line) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        stats.parseErrors += 1;
        continue;
      }
      stats.events += 1;
      if (data.type === 'thinking' && data.content) {
        stats.thinking += 1;
        handlers.onThinking?.(data.content);
      } else if (data.type === 'token' && data.content) {
        stats.tokens += 1;
        handlers.onToken?.(data.content);
      } else if (data.type === 'image' && data.url) {
        handlers.onImage?.({
          url: data.url,
          dataUrl: data.dataUrl || (data.url.startsWith('data:') ? data.url : undefined),
        });
      } else if (data.type === 'done') {
        stats.done = true;
        handlers.onDone?.(data);
      } else if (data.type === 'status' && data.content) {
        handlers.onStatus?.(data.content);
      } else if (data.type === 'search_round') {
        handlers.onSearchRound?.(data);
      } else if (data.type === 'search_plan') {
        handlers.onSearchPlan?.(data);
      } else if (data.type === 'pre_search_done') {
        handlers.onPreSearchDone?.(data);
      } else if (data.type === 'tool_start') {
        handlers.onToolStart?.(data);
      } else if (data.type === 'tool_end') {
        handlers.onToolEnd?.(data);
      } else if (data.type === 'connector_status') {
        handlers.onConnectorStatus?.(data);
      } else if (data.type === 'error') {
        handlers.onError?.(data.detail || 'Ошибка потока');
        throw new Error(data.detail || 'Ошибка потока');
      } else {
        stats.otherTypes.push(data.type || 'unknown');
      }
    }
  }
  return stats;
}
