import { Bot, Cloud, GitBranch, Shield, Terminal, Zap } from 'lucide-react';

const ITEMS = [
  { icon: Cloud, title: 'Nexus Cloud', desc: 'Аккаунт, баланс и модели Polza.ai.' },
  { icon: Bot, title: 'ИИ в чате', desc: 'Research с источниками и вложениями.' },
  { icon: Terminal, title: 'IDE Web', desc: 'Редактор и терминал в браузере.' },
  { icon: GitBranch, title: 'Git', desc: 'Статус и коммиты из IDE.' },
  { icon: Shield, title: 'Тарифы', desc: 'Free и платные планы с лимитами.' },
  { icon: Zap, title: 'Коннекторы', desc: 'Gmail, GitHub, Vercel и другие сервисы.' },
];

export default function HomeFeatures({ className = '' }) {
  return (
    <section id="features" className={`scroll-mt-28 ${className}`}>
      <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-6">
        Возможности
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left"
          >
            <Icon className="text-teal-400 mb-2" size={20} aria-hidden />
            <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
