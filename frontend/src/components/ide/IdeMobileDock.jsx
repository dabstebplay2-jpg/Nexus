import { FolderTree, Menu, Search, Settings, Sparkles, User } from 'lucide-react';

const ITEMS = [
  { tab: 'explorer', icon: FolderTree, label: 'Files' },
  { tab: 'search', icon: Search, label: 'Search' },
  { tab: 'ai', icon: Sparkles, label: 'Agent' },
  { tab: 'profile', icon: User, label: 'Account' },
  { tab: 'settings', icon: Settings, label: 'More' },
];

export default function IdeMobileDock({ activeTab, onSelectTab, onOpenMenu }) {
  return (
    <nav className="md:hidden ide-mobile-dock flex items-center justify-around border-t border-[var(--ide-border)] bg-[var(--ide-activity)] shrink-0 py-1 px-1 safe-area-pb">
      {ITEMS.map(({ tab, icon: Icon, label }) => (
        <button
          key={tab}
          type="button"
          onClick={() => onSelectTab(tab)}
          className={`flex flex-col items-center gap-0.5 min-w-[52px] py-1.5 rounded-xl text-[10px] ${
            activeTab === tab ? 'text-teal-400 bg-teal-500/10' : 'text-[var(--ide-muted)]'
          }`}
        >
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex flex-col items-center gap-0.5 min-w-[52px] py-1.5 rounded-xl text-[10px] text-[var(--ide-muted)]"
      >
        <Menu size={20} />
        <span>Menu</span>
      </button>
    </nav>
  );
}
