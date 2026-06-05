import { useEffect, useState } from 'react';
import { Plug } from 'lucide-react';
import { fetchConnectorsSummary } from './connectorsApi';

const LABELS = {
  google_workspace: 'Gmail',
  github: 'GitHub',
  vercel: 'Vercel',
  discord: 'Discord',
};

export default function ConnectorChips({ authorized, onOpenSettings }) {
  const [connected, setConnected] = useState([]);

  useEffect(() => {
    if (!authorized) {
      setConnected([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchConnectorsSummary();
        if (!cancelled) {
          setConnected((data.connected || []).filter((c) => c.enabled_for_chat));
        }
      } catch {
        if (!cancelled) setConnected([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authorized]);

  if (!connected.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
      <span className="text-[10px] uppercase tracking-wide text-zinc-600 flex items-center gap-1">
        <Plug size={12} />
        Коннекторы
      </span>
      {connected.map((c) => (
        <span
          key={c.id}
          className="text-[11px] rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-teal-200/90"
          title={c.label}
        >
          {LABELS[c.id] || c.label || c.id}
        </span>
      ))}
      <button
        type="button"
        onClick={onOpenSettings}
        className="text-[11px] text-zinc-500 hover:text-teal-300"
      >
        Настроить
      </button>
    </div>
  );
}
