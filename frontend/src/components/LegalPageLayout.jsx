import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SiteNav from './SiteNav';
import LegalFooter from './LegalFooter';

export default function LegalPageLayout({ title, children }) {
  return (
    <div className="relative nx-dvh-screen bg-[#07070a] text-zinc-200 flex flex-col">
      <SiteNav />
      <main className="relative z-10 flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-cyan-400 mb-8"
          >
            <ArrowLeft size={16} /> К тарифам
          </Link>
          <h1 className="text-3xl font-bold text-white mb-8">{title}</h1>
          <article className="legal-prose space-y-6 text-sm text-zinc-400 leading-relaxed">
            {children}
          </article>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}
