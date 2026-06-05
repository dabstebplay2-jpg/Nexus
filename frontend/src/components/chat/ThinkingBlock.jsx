import { useState, useEffect } from 'react';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';
import SearchActivityTimeline from './SearchActivityTimeline';

export default function ThinkingBlock({
  preSearchThinking,
  thinking,
  searchActivity,
  isStreaming,
}) {
  const preText = (preSearchThinking || '').trim();
  const thinkText = (thinking || '').trim();
  const hasPre = Boolean(preText);
  const hasSearch = Boolean(searchActivity?.steps?.length || searchActivity?.status);
  const hasAnswerThink = Boolean(thinkText);
  const hasThinking = hasPre || hasAnswerThink;
  const busy =
    isStreaming && (hasSearch || hasPre || !hasAnswerThink);

  const [open, setOpen] = useState(busy);

  useEffect(() => {
    if (busy) setOpen(true);
    else if (!isStreaming && (hasSearch || hasThinking)) setOpen(false);
  }, [busy, isStreaming, hasSearch, hasThinking]);

  if (!hasSearch && !hasThinking && !isStreaming) return null;

  const title = hasSearch
    ? hasThinking
      ? 'Поиск и рассуждение'
      : 'Поиск в сети'
    : 'Мышление модели';

  return (
    <div className="mb-3 rounded-xl border border-violet-500/25 bg-violet-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-violet-300/90 hover:bg-violet-500/10"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Brain size={14} className="shrink-0" />
        <span>{title}</span>
        {busy && (
          <span className="ml-auto text-[10px] font-normal normal-case text-violet-400/80 animate-pulse">
            …
          </span>
        )}
      </button>
      {open && (
        <div className="nx-thinking-body px-3 pb-3 pt-0 max-h-80 overflow-y-auto custom-scrollbar space-y-2 select-text">
          {hasPre && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-400/70 mb-1.5">
                Размышление перед поиском
              </p>
              <pre className="text-[12px] leading-relaxed text-violet-100/80 whitespace-pre-wrap font-mono">
                {preText}
              </pre>
            </div>
          )}
          {hasSearch && (
            <div className={hasPre ? 'pt-2 border-t border-violet-500/15' : ''}>
              <SearchActivityTimeline searchActivity={searchActivity} isStreaming={isStreaming} />
            </div>
          )}
          {hasAnswerThink && (
            <div className={hasPre || hasSearch ? 'pt-2 border-t border-violet-500/15' : ''}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-400/70 mb-1.5">
                Рассуждение при ответе
              </p>
              <pre className="text-[12px] leading-relaxed text-violet-100/80 whitespace-pre-wrap font-mono">
                {thinkText}
              </pre>
            </div>
          )}
          {!hasThinking && busy && !hasSearch && (
            <p className="text-[12px] text-violet-100/60">…</p>
          )}
        </div>
      )}
    </div>
  );
}
