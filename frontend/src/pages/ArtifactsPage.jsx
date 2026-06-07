import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Image as ImageIcon, FileCode2, FileText, Trash2, ExternalLink } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { useArtifacts } from '../context/ArtifactContext';
import { imageDisplaySrc } from '../lib/imagePersistence';

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'image', label: 'Изображения' },
  { id: 'code', label: 'Код' },
  { id: 'file', label: 'Файлы' },
];

function kindIcon(kind) {
  if (kind === 'image') return ImageIcon;
  if (kind === 'code') return FileCode2;
  return FileText;
}

function artifactPreviewSrc(art) {
  if (art.kind === 'image') {
    return art.preview || imageDisplaySrc(art.content) || '';
  }
  return '';
}

export default function ArtifactsPage() {
  const { artifacts, artifactsReady, artifactsError, removeArtifact } = useArtifacts();
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return artifacts;
    return artifacts.filter((a) => a.kind === filter);
  }, [artifacts, filter]);

  return (
    <AppShell hideHistory onOpenPricing={() => {}}>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 sm:px-6 py-6 sm:py-8 border-b border-[var(--nx-border)]">
          <h1 className="text-2xl font-semibold">Артефакты</h1>
          <p className="text-sm text-[var(--nx-muted)] mt-1">
            Изображения, код и другие результаты из чата сохраняются автоматически
          </p>
          {artifactsError ? (
            <p className="text-sm text-amber-400/90 mt-2">{artifactsError}</p>
          ) : null}
        </div>

        <div className="px-4 sm:px-6 py-3 flex gap-2 overflow-x-auto border-b border-[var(--nx-border)] custom-scrollbar shrink-0">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                filter === f.id
                  ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-100'
                  : 'border-[var(--nx-border)] text-[var(--nx-muted)] hover:text-zinc-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          {!artifactsReady ? (
            <p className="text-sm text-[var(--nx-muted)]">Загрузка…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl nx-glass flex items-center justify-center mb-5">
                <LayoutGrid size={28} className="text-[var(--nx-muted)]" />
              </div>
              <h2 className="text-lg font-medium mb-2">Пока пусто</h2>
              <p className="text-sm text-[var(--nx-muted)] max-w-md">
                Сгенерируйте изображение в чате или получите код — всё появится здесь и останется после
                перезагрузки страницы.
              </p>
              <Link
                to="/"
                className="mt-6 text-sm text-cyan-400 hover:text-cyan-300"
              >
                Перейти в чат →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((art) => {
                const Icon = kindIcon(art.kind);
                const preview = artifactPreviewSrc(art);
                const openHref =
                  preview ||
                  (art.kind === 'code' && art.content?.code
                    ? `data:text/plain;charset=utf-8,${encodeURIComponent(art.content.code.slice(0, 500))}`
                    : null);
                return (
                  <article
                    key={art.id}
                    className="nx-glass rounded-xl sm:rounded-2xl border border-[var(--nx-border)] overflow-hidden flex flex-col"
                  >
                    <div className="aspect-[4/3] bg-black/30 flex items-center justify-center relative">
                      {preview ? (
                        <img
                          src={preview}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-[var(--nx-muted)]" />
                      )}
                      <button
                        type="button"
                        title="Удалить"
                        onClick={() => removeArtifact(art.id)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-zinc-400 hover:text-red-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="p-2 sm:p-3 flex-1 flex flex-col gap-1.5 sm:gap-2">
                      <h3 className="text-xs sm:text-sm font-medium line-clamp-2">{art.title}</h3>
                      <p className="text-[10px] sm:text-xs text-[var(--nx-muted)]">
                        {new Date(art.createdAt || Date.now()).toLocaleString('ru-RU')}
                      </p>
                      {art.sourceChatId ? (
                        <Link
                          to="/"
                          className="text-[10px] sm:text-xs text-cyan-400/90 hover:text-cyan-300 truncate"
                        >
                          Из чата
                        </Link>
                      ) : null}
                      {openHref ? (
                        <a
                          href={openHref}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-auto inline-flex items-center gap-1 text-[10px] sm:text-xs text-zinc-300 hover:text-white"
                        >
                          <ExternalLink size={12} />
                          Открыть
                        </a>
                      ) : art.kind === 'code' && art.content?.code ? (
                        <pre className="text-[9px] sm:text-[10px] text-zinc-500 line-clamp-4 font-mono">
                          {art.content.code}
                        </pre>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
