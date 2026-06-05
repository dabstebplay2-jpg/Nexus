import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SiteNav from '../components/SiteNav';
import LegalFooter from '../components/LegalFooter';
import changelogData from '../data/changelog.json';

export default function UpdatesPage() {
  const entries = changelogData.entries ?? [];

  return (
    <div className="relative min-h-screen bg-[#07070a] text-zinc-200 flex flex-col">
      <SiteNav />
      <main className="relative z-10 flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-cyan-400 mb-8"
          >
            <ArrowLeft size={16} /> На главную
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Что нового</h1>
          <p className="text-sm text-zinc-500 mb-10">
            История обновлений веб-версии Nexus AI.
          </p>

          <div className="space-y-8">
            {entries.map((entry) => (
              <article
                key={`${entry.version}-${entry.dateISO}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                  <span className="text-xs font-medium text-teal-400/90 uppercase tracking-wide">
                    v{entry.version}
                  </span>
                  <time className="text-xs text-zinc-500" dateTime={entry.dateISO}>
                    {entry.date}
                  </time>
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">{entry.title}</h2>
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">{entry.summary}</p>
                {entry.changes?.length > 0 && (
                  <ul className="space-y-3">
                    {entry.changes.map((item, i) => (
                      <li key={i} className="text-sm">
                        <span className="text-zinc-300 font-medium">{item.label}: </span>
                        <span className="text-zinc-500">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}
