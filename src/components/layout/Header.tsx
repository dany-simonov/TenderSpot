import { Sun, Moon } from 'lucide-react';
import { Theme } from '@/hooks/useTheme';
import BlueRhombusLogo from '@/components/branding/BlueRhombusLogo';

interface HeaderProps {
  lastSync: string;
  theme: Theme;
  onToggleTheme: () => void;
  onLogout: () => void;
}

// Format ISO timestamp to Russian locale: DD.MM.YYYY, HH:MM
function formatSyncTime(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) {
    return '—';
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year}, ${hours}:${minutes}`;
}

const Header = ({ lastSync, theme, onToggleTheme, onLogout }: HeaderProps) => {
  const isDark = theme === 'dark';

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 h-12 pr-24 sm:pr-28 transition-colors"
      style={{
        backgroundColor: 'var(--ts-surface)',
        borderBottom: '1px solid var(--ts-border)',
      }}
    >
      <BlueRhombusLogo />

      {/* Right side: sync info + buttons */}
      <div className="flex items-center gap-2 mr-2 sm:mr-4">
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

      </div>

      <button
        onClick={onLogout}
        className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 text-xs px-3 py-1.5 rounded btn-outline"
        style={{ borderRadius: '4px' }}
      >
        Выйти
      </button>
    </header>
  );
};

export default Header;
