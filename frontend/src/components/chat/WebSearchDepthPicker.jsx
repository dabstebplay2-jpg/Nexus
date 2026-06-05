import { Globe } from 'lucide-react';

/** Переключатель «Поиск в сети» (глубина всегда standard на бэкенде). */
export default function WebSearchDepthPicker({
  enabled,
  onEnabledChange,
  disabled = false,
}) {
  const active = Boolean(enabled);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onEnabledChange?.(!active)}
      className={`flex items-center gap-2 px-3 py-3 min-h-[52px] rounded-full border transition-colors shrink-0 ${
        active
          ? 'border-teal-500/50 bg-teal-500/15 text-teal-400'
          : 'border-[var(--nx-border)] bg-[var(--nx-surface-hover)] text-[var(--nx-muted)] hover:text-[var(--nx-text)]'
      }`}
      title={active ? 'Выключить поиск в сети' : 'Включить поиск в сети'}
    >
      <Globe size={20} className="shrink-0" />
      <span className="hidden sm:inline text-sm font-medium">Поиск в сети</span>
    </button>
  );
}
