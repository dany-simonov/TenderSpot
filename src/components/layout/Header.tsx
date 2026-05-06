import { Sun, Moon } from 'lucide-react';
import { Theme } from '@/hooks/useTheme';
import BlueRhombusLogo from '@/components/branding/BlueRhombusLogo';
import { ParserStatus } from '@/services/parser';

interface HeaderProps {
  lastSync: string;
  parserStatus?: ParserStatus | null;
  parserStatusError?: string | null;
  parserStatusLoading?: boolean;
  parserRunPending?: boolean;
  onRunParser?: () => void;
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

function formatShortTime(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month} ${hours}:${minutes}`;
}

const Header = ({
  lastSync,
  parserStatus,
  parserStatusError,
  parserStatusLoading,
  parserRunPending,
  onRunParser,
  theme,
  onToggleTheme,
  onLogout,
}: HeaderProps) => {
  const isDark = theme === 'dark';
  const isRunning = parserStatus?.isRunning || false;
  const canRun = parserStatus?.canRun === true;
  const runDisabled = !onRunParser || parserStatusLoading || parserRunPending || isRunning || !canRun;

  let parserHint = 'Парсер: нет данных';
  if (parserStatusLoading) {
    parserHint = 'Парсер: проверяем статус...';
  } else if (parserStatusError) {
    parserHint = 'Парсер: недоступен';
  } else if (parserStatus) {
    if (parserStatus.isRunning) {
      parserHint = 'Парсер: выполняется';
    } else if (parserStatus.canRun) {
      parserHint = 'Парсер: готов к запуску';
    } else if (parserStatus.nextRunAt) {
      parserHint = `Парсер: доступен ${formatShortTime(parserStatus.nextRunAt)}`;
    }
  }

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

        <div className="hidden sm:flex flex-col items-end leading-tight text-[10px] mr-1">
          <span style={{ color: 'var(--ts-text-secondary)' }}>{parserHint}</span>
          <span style={{ color: 'var(--ts-text-secondary)' }}>
            Последний запуск: {formatShortTime(parserStatus?.lastRunAt ?? null)}
          </span>
        </div>

        <button
          onClick={onRunParser}
          disabled={runDisabled}
          className="flex items-center justify-center h-8 px-3 rounded btn-outline text-xs"
          style={{ borderRadius: '4px', opacity: runDisabled ? 0.6 : 1 }}
          title="Запустить парсер (доступно 1 раз в день)"
        >
          {parserRunPending || isRunning ? 'Запуск...' : 'Обновить'}
        </button>

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
