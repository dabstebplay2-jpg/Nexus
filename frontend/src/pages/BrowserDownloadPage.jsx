import { Download, Globe, Shield, Sparkles, ExternalLink } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import DiscordInviteLink from '../components/DiscordInviteLink';

const BROWSER_VERSION = import.meta.env.VITE_BROWSER_VERSION || '0.4.1';
const RELEASES_PAGE =
  import.meta.env.VITE_BROWSER_RELEASES_URL ||
  'https://github.com/dabstebplay2-jpg/Nexus_browser/releases/latest';

const SETUP_URL =
  import.meta.env.VITE_BROWSER_SETUP_URL ||
  `https://github.com/dabstebplay2-jpg/Nexus_browser/releases/latest/download/NexusBrowser-${BROWSER_VERSION}-Setup.exe`;

const PORTABLE_URL =
  import.meta.env.VITE_BROWSER_PORTABLE_URL ||
  `https://github.com/dabstebplay2-jpg/Nexus_browser/releases/latest/download/NexusBrowser-${BROWSER_VERSION}-Portable.exe`;

const HIGHLIGHTS = [
  { icon: Sparkles, title: 'ИИ в браузере', text: 'Встроенная панель Nexus AI, поиск и чат по странице.' },
  { icon: Shield, title: 'Nexus Shields', text: 'Блокировка рекламы и трекеров, защита как в Brave.' },
  { icon: Globe, title: 'Chrome-привычный UX', text: 'Горячие клавиши, группы вкладок, расширения Web Store.' },
];

export default function BrowserDownloadPage() {
  return (
    <AppShell>
      <div className="ide-download-page browser-download-page">
        <header className="ide-download-hero">
          <p className="ide-download-kicker">Nexus Browser · Windows</p>
          <h1>Скачать браузер</h1>
          <p className="ide-download-lead">
            Отдельное десктоп-приложение на Electron — не путать с версией сайта (
            <strong>0.1.x</strong>). Текущая сборка браузера: <strong>v{BROWSER_VERSION}</strong>.
          </p>
        </header>

        <section className="ide-download-cards">
          <article className="ide-download-card ide-download-card--primary">
            <Download size={28} aria-hidden />
            <h2>Установщик (рекомендуется)</h2>
            <p>Ярлык в меню «Пуск», корректная иконка, автообновление папки установки.</p>
            <a className="btn btn-primary btn-lg" href={SETUP_URL} download>
              Скачать Setup.exe
            </a>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              NexusBrowser-{BROWSER_VERSION}-Setup.exe
            </p>
          </article>

          <article className="ide-download-card">
            <Download size={28} aria-hidden />
            <h2>Portable</h2>
            <p>Один .exe без установки — удобно для флешки или теста.</p>
            <a className="btn btn-lg" href={PORTABLE_URL} download>
              Скачать Portable.exe
            </a>
          </article>
        </section>

        <section className="ide-download-features">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="ide-download-feature">
              <Icon size={20} aria-hidden />
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="ide-download-footer-links">
          <a className="btn btn-sm" href={RELEASES_PAGE} target="_blank" rel="noreferrer">
            Все релизы на GitHub <ExternalLink size={14} />
          </a>
          <DiscordInviteLink className="btn btn-sm">Сообщество Discord</DiscordInviteLink>
        </section>
      </div>
    </AppShell>
  );
}
