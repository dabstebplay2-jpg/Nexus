import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpCircle,
  Boxes,
  Cable,
  Clock3,
  Code2,
  Globe2,
  LayoutGrid,
  LifeBuoy,
  Menu,
  MessageSquare,
  PanelLeftClose,
  Plus,
  Puzzle,
  Radio,
  RefreshCw,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import ProfileMenu from './ProfileMenu';
import BrandLogo from '../brand/BrandLogo';
import DiscordInviteLink from '../DiscordInviteLink';
import AmbientBackground from '../AmbientBackground';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useVisualViewportPadding } from '../../hooks/useVisualViewportPadding';
import { useAuth } from '../../context/AuthContext';

const IDE_WEB_NAV_BADGE_KEY = 'nexus_seen_ide_web_nav';

const NAV_GROUPS = [
  {
    title: 'Workspace',
    items: [
      { path: '/', label: 'Чат', icon: MessageSquare, match: (p) => p === '/' },
      {
        path: '/no-code',
        label: 'No-Code Studio',
        title: 'Сайты, UX, тексты и no-code архитектура',
        icon: Sparkles,
        match: (p) => p === '/no-code',
      },
      {
        path: '/ide/lite',
        label: 'IDE Web',
        title: 'Редактор и Agent в браузере',
        icon: Code2,
        match: (p) => p === '/ide/lite',
        badge: 'new',
      },
      { path: '/spaces', label: 'Пространства', icon: Boxes, match: (p) => p === '/spaces' },
    ],
  },
  {
    title: 'Данные',
    items: [
      { path: '/artifacts', label: 'Артефакты', icon: LayoutGrid, match: (p) => p === '/artifacts' },
      { path: '/connectors', label: 'Коннекторы', icon: Cable, match: (p) => p === '/connectors' },
    ],
  },
  {
    title: 'Приложения',
    items: [
      {
        path: '/browser',
        label: 'Nexus Browser',
        title: 'Nexus Browser для Windows',
        icon: Globe2,
        match: (p) => p === '/browser',
      },
      {
        path: '/ide',
        label: 'Desktop IDE',
        title: 'Desktop и расширение VSIX',
        icon: Puzzle,
        match: (p) => p === '/ide',
      },
    ],
  },
  {
    title: 'Сервис',
    items: [
      {
        path: '/updates',
        label: 'Что нового',
        title: 'Журнал релизов',
        icon: Radio,
        match: (p) => p === '/updates',
      },
      { action: 'support', label: 'Поддержка', icon: LifeBuoy },
    ],
  },
];

const MOBILE_TABS = [
  { path: '/', label: 'Чат', icon: MessageSquare, match: (p) => p === '/' },
  { path: '/no-code', label: 'Studio', icon: Sparkles, match: (p) => p === '/no-code' },
  { path: '/ide/lite', label: 'IDE', icon: Code2, match: (p) => p === '/ide/lite' },
  { path: '/spaces', label: 'Spaces', icon: Boxes, match: (p) => p === '/spaces' },
];

function NavItem({ item, expanded, pathname, setMobileOpen, onOpenSupport }) {
  const { label, icon: Icon, title } = item;

  if (item.action === 'support') {
    return (
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={() => {
          setMobileOpen(false);
          onOpenSupport?.();
        }}
        className={`nx-nav-item w-full ${expanded ? '' : 'justify-center'}`}
      >
        <Icon size={18} className="shrink-0" />
        {expanded ? <span className="truncate">{label}</span> : null}
      </button>
    );
  }

  const active = item.match(pathname);
  let showNewBadge = false;
  if (item.badge === 'new' && expanded && typeof window !== 'undefined') {
    try {
      showNewBadge = !window.localStorage.getItem(IDE_WEB_NAV_BADGE_KEY);
    } catch {
      showNewBadge = false;
    }
  }

  return (
    <Link
      to={item.path}
      title={title || label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onClick={() => {
        if (item.badge === 'new') {
          try {
            window.localStorage.setItem(IDE_WEB_NAV_BADGE_KEY, '1');
          } catch {
            /* storage unavailable */
          }
        }
        setMobileOpen(false);
      }}
      className={`nx-nav-item ${expanded ? '' : 'justify-center'} ${active ? 'nx-nav-item--active' : ''}`}
    >
      <Icon size={18} className="shrink-0" />
      {expanded ? (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate">{label}</span>
          {showNewBadge ? <span className="nx-nav-badge">new</span> : null}
        </span>
      ) : null}
    </Link>
  );
}

function SidebarContent({
  expanded,
  isMobile,
  pathname,
  collapsed,
  hideHistory,
  historyItems,
  activeHistoryId,
  onSelectHistory,
  onDeleteHistory,
  onNewChat,
  onOpenPricing,
  onOpenSupport,
  setCollapsed,
  setMobileOpen,
}) {
  const handleLogoClick = (event) => {
    setMobileOpen(false);
    if (!isMobile && collapsed) {
      event.preventDefault();
      setCollapsed(false);
    }
  };

  return (
    <>
      <div className="nx-sidebar-brand">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2.5 rounded-xl"
          title={!isMobile && collapsed ? 'Развернуть панель' : 'Nexus'}
          onClick={handleLogoClick}
        >
          <BrandLogo variant="icon" className="h-7 w-7 shrink-0" imgClassName="h-7 w-7 object-contain" alt="Nexus" />
          {expanded ? (
            <span className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--nx-text)]">Nexus</span>
          ) : null}
        </Link>
        {expanded ? (
          <button
            type="button"
            onClick={() => (isMobile ? setMobileOpen(false) : setCollapsed(true))}
            className="nx-icon-button"
            title={isMobile ? 'Закрыть меню' : 'Свернуть'}
            aria-label={isMobile ? 'Закрыть меню' : 'Свернуть боковую панель'}
          >
            {isMobile ? <X size={17} /> : <PanelLeftClose size={17} />}
          </button>
        ) : null}
      </div>

      <div className="px-2.5 pb-2 pt-2">
        <button
          type="button"
          onClick={onNewChat}
          aria-label="Новый чат"
          className={`nx-new-chat ${expanded ? '' : 'justify-center px-0'}`}
        >
          <Plus size={17} />
          {expanded ? <span>Новый чат</span> : null}
          {expanded ? <span className="ml-auto hidden text-[10px] text-[var(--nx-faint)] xl:inline">Ctrl N</span> : null}
        </button>
      </div>

      <nav className="nx-sidebar-nav custom-scrollbar">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-3 last:mb-0">
            {expanded ? <p className="nx-nav-group-label">{group.title}</p> : null}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.path || item.action}
                  item={item}
                  expanded={expanded}
                  pathname={pathname}
                  setMobileOpen={setMobileOpen}
                  onOpenSupport={onOpenSupport}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {!hideHistory && expanded && historyItems.length > 0 ? (
        <div className="min-h-0 flex-1 px-2.5 pt-2">
          <p className="nx-nav-group-label flex items-center gap-1.5">
            <Clock3 size={12} /> Недавние
          </p>
          <div className="custom-scrollbar max-h-full overflow-y-auto pb-2">
            {historyItems.map((item) => (
              <div
                key={item.id}
                className={`group flex items-center rounded-xl ${item.id === activeHistoryId ? 'bg-[var(--nx-surface-hover)]' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectHistory?.(item.id);
                    setMobileOpen(false);
                  }}
                  className="min-h-9 min-w-0 flex-1 truncate px-2.5 text-left text-[12.5px] text-[var(--nx-muted)] transition-colors hover:text-[var(--nx-text)]"
                  title={item.title}
                >
                  {item.title}
                </button>
                {onDeleteHistory ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteHistory(item.id);
                    }}
                    className="mr-1 grid h-7 w-7 place-items-center rounded-lg text-sm text-[var(--nx-faint)] opacity-0 transition hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100 focus:opacity-100"
                    aria-label="Удалить чат"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className={`nx-sidebar-footer ${expanded ? '' : 'px-1.5'}`}>
        <button
          type="button"
          aria-label="Тарифы"
          onClick={() => {
            onOpenPricing?.();
            setMobileOpen(false);
          }}
          className={`nx-nav-item w-full ${expanded ? '' : 'justify-center'}`}
        >
          <ArrowUpCircle size={18} />
          {expanded ? <span>Тарифы</span> : null}
        </button>
        <DiscordInviteLink
          showIcon
          onClick={() => setMobileOpen(false)}
          className={`nx-nav-item w-full ${expanded ? '' : 'justify-center'}`}
        >
          {expanded ? 'Discord' : null}
        </DiscordInviteLink>
        <ProfileMenu expanded={expanded} onOpenPricing={onOpenPricing} />
      </div>
    </>
  );
}

export default function AppShell({
  children,
  onNewChat,
  historyItems = [],
  onSelectHistory,
  onDeleteHistory,
  activeHistoryId,
  headerLeft = null,
  headerRight = null,
  onOpenPricing,
  hideHistory = false,
  ambientFocus = 'center',
  compactChrome = false,
  showMobileTabBar = true,
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const pageTitle = usePageTitle();
  const keyboardPad = useVisualViewportPadding();
  const { serviceStatus, serviceIssues = [], loadAuthConfig } = useAuth();
  const isKeyboardOpen = keyboardPad > 50;
  const showMobileTabBarWithKeyboard = showMobileTabBar && !isKeyboardOpen;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const hideMobileHeader = compactChrome;
  const showDesktopHeader = !compactChrome;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const openDrawer = () => setMobileOpen(true);
    window.addEventListener('nexus-open-drawer', openDrawer);
    return () => window.removeEventListener('nexus-open-drawer', openDrawer);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const handleNew = () => {
    if (onNewChat) onNewChat();
    else navigate('/');
    setMobileOpen(false);
  };

  const handleOpenSupport = () => {
    if (pathname === '/' || pathname === '/no-code') {
      window.dispatchEvent(new CustomEvent('nexus-open-support'));
    } else {
      navigate('/?support=1');
    }
    setMobileOpen(false);
  };

  const sidebarProps = {
    pathname,
    collapsed,
    hideHistory,
    historyItems,
    activeHistoryId,
    onSelectHistory,
    onDeleteHistory,
    onNewChat: handleNew,
    onOpenPricing,
    onOpenSupport: handleOpenSupport,
    setCollapsed,
    setMobileOpen,
  };

  return (
    <div className="nx-shell nx-h-dvh">
      <AmbientBackground focus={ambientFocus} />

      <aside
        data-nx-sidebar="desktop"
        className={`nx-sidebar relative z-30 hidden h-full shrink-0 flex-col border-r md:flex ${
          collapsed ? 'w-[var(--nx-sidebar-collapsed-w)]' : 'w-[var(--nx-sidebar-w)]'
        }`}
      >
        <SidebarContent expanded={!collapsed} isMobile={false} {...sidebarProps} />
      </aside>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] md:hidden"
              aria-label="Закрыть меню"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              data-nx-sidebar="mobile"
              initial={{ x: '-104%' }}
              animate={{ x: 0 }}
              exit={{ x: '-104%' }}
              transition={{ type: 'spring', stiffness: 430, damping: 38 }}
              className="nx-sidebar fixed inset-y-0 left-0 z-50 flex h-full w-[min(286px,86vw)] flex-col border-r md:hidden"
            >
              <SidebarContent expanded isMobile {...sidebarProps} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <div data-nx-main className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {showDesktopHeader ? (
          <header className="nx-topbar hidden md:flex">
            <div className="flex min-w-0 items-center gap-2">
              {headerLeft || <span className="nx-topbar-title">{pageTitle}</span>}
            </div>
            <div className="flex shrink-0 items-center gap-2">{headerRight}</div>
          </header>
        ) : null}

        {!hideMobileHeader ? (
          <header className="nx-topbar flex md:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <button type="button" onClick={() => setMobileOpen(true)} className="nx-icon-button" aria-label="Открыть меню">
                <Menu size={18} />
              </button>
              <Link to="/" aria-label="Nexus" className="shrink-0">
                <BrandLogo variant="icon" className="h-7 w-7" imgClassName="h-7 w-7 object-contain" alt="" />
              </Link>
              <div className="min-w-0 flex-1 truncate pl-1">
                {headerLeft || <span className="nx-topbar-title">{pageTitle}</span>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">{headerRight}</div>
          </header>
        ) : null}

        {serviceStatus === 'offline' ? (
          <div className="nx-service-banner" role="status">
            <WifiOff size={14} className="shrink-0" />
            <span className="truncate">Cloud API недоступен. Интерфейс и локальные разделы продолжают работать.</span>
            <button type="button" onClick={() => loadAuthConfig()} className="ml-auto inline-flex shrink-0 items-center gap-1 font-semibold">
              <RefreshCw size={13} /> Повторить
            </button>
          </div>
        ) : serviceStatus === 'degraded' ? (
          <div className="nx-service-banner nx-service-banner--degraded" role="status">
            <RefreshCw size={14} className="shrink-0" />
            <span className="truncate">Cloud работает, но нужно настроить: {serviceIssues.join(', ')}.</span>
            <button type="button" onClick={() => loadAuthConfig()} className="ml-auto inline-flex shrink-0 items-center gap-1 font-semibold">
              Проверить
            </button>
          </div>
        ) : null}

        <div
          className={`nx-page-host flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
            showMobileTabBarWithKeyboard && !compactChrome
              ? 'max-md:pb-[calc(var(--nx-dock-h)+var(--nx-safe-bottom))]'
              : ''
          }`}
        >
          {children}
        </div>

        {showMobileTabBarWithKeyboard && !compactChrome ? (
          <nav className="nx-mobile-dock md:hidden" style={{ paddingBottom: 'var(--nx-safe-bottom)' }}>
            {MOBILE_TABS.map(({ path, label, icon: Icon, match }) => {
              const active = match(pathname);
              return (
                <Link key={path} to={path} aria-current={active ? 'page' : undefined} className={`nx-mobile-dock__item ${active ? 'is-active' : ''}`}>
                  <Icon size={18} />
                  <span>{label}</span>
                </Link>
              );
            })}
            <button type="button" onClick={() => setMobileOpen(true)} className="nx-mobile-dock__item">
              <Menu size={18} />
              <span>Ещё</span>
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
