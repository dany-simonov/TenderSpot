import { RefreshCw, Sun, Moon } from 'lucide-react';
import { Theme } from '@/hooks/useTheme';

interface HeaderProps {
  lastSync: string;
  onRefresh: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

// Format ISO timestamp to Russian locale: DD.MM.YYYY, HH:MM
function formatSyncTime(iso: string): string {
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  } catch {
    return '—';
  }
}

const Header = ({ lastSync, onRefresh, theme, onToggleTheme }: HeaderProps) => {
  const isDark = theme === 'dark';

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 h-12 transition-colors"
      style={{
        backgroundColor: 'var(--ts-surface)',
        borderBottom: '1px solid var(--ts-border)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M10 2L2 8H4V17H9V12H11V17H16V8H18L10 2Z"
            fill="var(--ts-accent)"
            stroke="var(--ts-accent)"
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
        </svg>
        <span
          className="mono font-bold text-base tracking-tight"
          style={{ color: 'var(--ts-text-primary)' }}
        >
          TenderSpot
        </span>
      </div>

      {/* Right side: sync info + buttons */}
      <div className="flex items-center gap-2">
        <span
          className="hidden sm:inline text-xs"
          style={{ color: 'var(--ts-text-secondary)' }}
        >
          Последнее обновление: {formatSyncTime(lastSync)}
        </span>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded btn-outline"
          style={{ borderRadius: '4px' }}
          title={isDark ? 'Светлая тема' : 'Тёмная тема'}
          aria-label={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
        >
          {isDark ? (
            <Sun size={14} style={{ color: 'var(--ts-text-secondary)' }} />
          ) : (
            <Moon size={14} style={{ color: 'var(--ts-text-secondary)' }} />
          )}
        </button>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium btn-outline"
          style={{ borderRadius: '4px' }}
          title="Обновить данные"
        >
          <RefreshCw size={13} />
          <span>Обновить</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
