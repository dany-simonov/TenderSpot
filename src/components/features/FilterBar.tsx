import { Search } from 'lucide-react';
import { TenderStatus, STATUS_LABELS } from '@/types/tender';

interface StatusCount {
  new: number;
  wip: number;
  submitted: number;
  rejected: number;
  total: number;
}

interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: TenderStatus | 'all';
  onStatusFilterChange: (v: TenderStatus | 'all') => void;
  hideNoDeadline: boolean;
  onHideNoDeadlineChange: (v: boolean) => void;
  counts: StatusCount;
}

const STATUS_PILLS: Array<{ value: TenderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'new', label: STATUS_LABELS.new },
  { value: 'wip', label: STATUS_LABELS.wip },
  { value: 'submitted', label: STATUS_LABELS.submitted },
  { value: 'rejected', label: STATUS_LABELS.rejected },
];

const COUNT_COLORS: Record<string, string> = {
  all: 'var(--ts-text-secondary)',
  new: '#388BFD',
  wip: '#D29922',
  submitted: '#2EA043',
  rejected: '#6E7681',
};

const FilterBar = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  hideNoDeadline,
  onHideNoDeadlineChange,
  counts,
}: FilterBarProps) => {
  return (
    <div
      className="sticky top-12 z-30 px-4 sm:px-6 py-3 transition-colors"
      style={{ backgroundColor: 'var(--ts-bg)', borderBottom: '1px solid var(--ts-border)' }}
    >
      {/* Row 1: search + deadline toggle */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3 items-stretch sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--ts-text-secondary)' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Поиск по всем полям..."
            className="w-full pl-8 pr-3 py-2 text-sm rounded transition-colors"
            style={{
              backgroundColor: 'var(--ts-surface)',
              border: '1px solid var(--ts-border)',
              color: 'var(--ts-text-primary)',
              outline: 'none',
              borderRadius: '4px',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--ts-accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--ts-border)')}
          />
        </div>

        <label
          className="inline-flex items-center gap-2 px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: 'var(--ts-surface)',
            border: '1px solid var(--ts-border)',
            color: 'var(--ts-text-primary)',
            borderRadius: '4px',
          }}
        >
          <input
            type="checkbox"
            checked={hideNoDeadline}
            onChange={(e) => onHideNoDeadlineChange(e.target.checked)}
          />
          Скрыть без дедлайна
        </label>
      </div>

      {/* Row 2: status pills + counters */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_PILLS.map((pill) => {
          const isActive = statusFilter === pill.value;
          const count =
            pill.value === 'all'
              ? counts.total
              : counts[pill.value as TenderStatus];

          return (
            <button
              key={pill.value}
              onClick={() => onStatusFilterChange(pill.value)}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor: isActive ? 'var(--ts-row-hover)' : 'transparent',
                border: `1px solid ${isActive ? 'var(--ts-accent)' : 'var(--ts-border)'}`,
                color: isActive ? 'var(--ts-text-primary)' : 'var(--ts-text-secondary)',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {pill.label}
              <span
                className="inline-flex items-center justify-center rounded-full text-[10px] font-semibold px-1.5 min-w-[18px] h-[18px]"
                style={{
                  backgroundColor: 'rgba(128,128,128,0.1)',
                  color: COUNT_COLORS[pill.value] || 'var(--ts-text-secondary)',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FilterBar;
