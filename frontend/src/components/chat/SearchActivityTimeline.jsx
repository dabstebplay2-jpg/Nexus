import { Globe, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

function phaseLabel(step) {
  if (step.phase === 'reason') return 'Размышление перед поиском';
  if (step.phase === 'analyze') return 'Анализ запроса';
  if (step.phase === 'confirm') return 'Проверка фактов';
  if (step.phase === 'merge') return 'Сбор результатов';
  return 'Поиск';
}

export default function SearchActivityTimeline({ searchActivity, isStreaming }) {
  const steps = searchActivity?.steps || [];
  const status = searchActivity?.status;
  if (!steps.length && !status) return null;

  const lastIdx = steps.length - 1;
  const depthLabel = searchActivity?.depthLabel;

  return (
    <div className="space-y-2 mb-3">
      {depthLabel && (
        <p className="text-[10px] uppercase tracking-wide text-violet-400/70 font-semibold">
          Уровень: {depthLabel}
        </p>
      )}
      {status && steps.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-violet-300/80">
          {isStreaming ? (
            <Loader2 size={14} className="animate-spin shrink-0" />
          ) : (
            <Globe size={14} className="shrink-0" />
          )}
          <span>{status}</span>
        </div>
      )}
      {steps.map((step, i) => {
        const active = isStreaming && i === lastIdx;
        const queries = Array.isArray(step.queries) ? step.queries : [];
        return (
          <div
            key={step.id || i}
            className={`relative pl-4 border-l-2 ${
              active ? 'border-violet-400/60' : 'border-violet-500/20'
            }`}
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-violet-300/90">
              {active ? (
                <Loader2 size={12} className="animate-spin shrink-0" />
              ) : step.phase === 'merge' || step.phase === 'analyze' || step.phase === 'reason' ? (
                <CheckCircle2 size={12} className="shrink-0 text-teal-400/80" />
              ) : (
                <Globe size={12} className="shrink-0" />
              )}
              <span>
                {phaseLabel(step)}
                {step.round != null && step.maxRounds != null
                  ? ` · ${step.round}/${step.maxRounds}`
                  : ''}
              </span>
            </div>
            {step.intent && step.phase === 'analyze' && (
              <p className="mt-1.5 text-[12px] text-violet-100/85 leading-snug">{step.intent}</p>
            )}
            {queries.length > 0 && (
              <div className="mt-1.5">
                {step.phase === 'analyze' && (
                  <p className="text-[10px] text-violet-400/70 mb-1">Поисковые запросы:</p>
                )}
                <ul className="space-y-1">
                  {queries.map((q, qi) => (
                    <li
                      key={qi}
                      className="text-[11px] font-mono text-violet-100/75 leading-snug"
                      title={q}
                    >
                      {step.phase === 'analyze' ? `${qi + 1}. ${q}` : `«${q}»`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {step.message && (
              <p className="mt-1 text-[11px] text-violet-200/60">{step.message}</p>
            )}
            {step.sourcesTotal != null && step.phase === 'merge' && (
              <p className="mt-0.5 text-[11px] text-teal-400/80">
                {step.added != null && step.added > 0
                  ? `+${step.added} · всего ${step.sourcesTotal}`
                  : `Всего ${step.sourcesTotal} источников`}
              </p>
            )}
          </div>
        );
      })}
      {status === 'failed' && (
        <div className="flex items-center gap-2 text-xs text-amber-400/90 pl-4">
          <AlertCircle size={14} />
          <span>Поиск недоступен — ответ по знаниям модели</span>
        </div>
      )}
    </div>
  );
}
