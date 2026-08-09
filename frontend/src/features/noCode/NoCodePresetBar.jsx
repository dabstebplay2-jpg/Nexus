import { Sparkles } from 'lucide-react';
import { NO_CODE_PRESETS } from './noCodeConfig';

export default function NoCodePresetBar({ value = 'auto', onChange, compact = false }) {
  return (
    <div className={`nx-studio-presets w-full ${compact ? 'is-compact' : ''}`}>
      <div className="nx-studio-presets__scroll custom-scrollbar">
        <span className="nx-studio-presets__label">
          <Sparkles size={13} /> Режим
        </span>
        {NO_CODE_PRESETS.map((preset) => {
          const active = preset.id === value;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange?.(preset.id)}
              title={`${preset.title}: ${preset.description}`}
              aria-pressed={active}
              className={`nx-studio-preset ${active ? 'is-active' : ''}`}
            >
              {preset.shortTitle}
            </button>
          );
        })}
      </div>
    </div>
  );
}
