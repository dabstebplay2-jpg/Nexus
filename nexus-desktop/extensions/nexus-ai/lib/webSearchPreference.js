/** sync with frontend/src/lib/webSearchPreference.js */
const WEB_SEARCH_DEPTHS = {
  quick: { id: 'quick', label: 'Быстрый', short: 'Быстро' },
  standard: { id: 'standard', label: 'Обычный', short: 'Норма' },
  deep: { id: 'deep', label: 'Глубокий', short: 'Глубоко' },
};

const DEFAULT_WEB_SEARCH_DEPTH = 'standard';

function depthMeta(depth) {
  return WEB_SEARCH_DEPTHS[depth] || WEB_SEARCH_DEPTHS[DEFAULT_WEB_SEARCH_DEPTH];
}

function normalizeDepth(depth) {
  return WEB_SEARCH_DEPTHS[depth] ? depth : DEFAULT_WEB_SEARCH_DEPTH;
}

module.exports = {
  WEB_SEARCH_DEPTHS,
  DEFAULT_WEB_SEARCH_DEPTH,
  depthMeta,
  normalizeDepth,
};
