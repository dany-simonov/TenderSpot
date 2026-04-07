import { ExternalLink, ChevronDown } from 'lucide-react';
import { Tender, TenderStatus, STATUS_LABELS } from '@/types/tender';

interface TenderRowProps {
  tender: Tender;
  index: number;
  onRowClick: (tender: Tender) => void;
  onStatusChange: (id: string, status: TenderStatus) => void;
}

// Format YYYY-MM-DD to DD.MM.YYYY
export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

// Format price with spaces
export function formatPrice(price: number): string {
  return price.toLocaleString('ru-RU') + ' ₽';
}

// Days until deadline
function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(dateStr);
  deadline.setHours(0, 0, 0, 0);
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const SOURCE_COLORS: Record<string, string> = {
  'ЕИС 44-ФЗ': '#388BFD',
  'ЕИС 223-ФЗ': '#8957E5',
  'ROOF.ru': '#2EA043',
  'КомТендер': '#D29922',
};

const STATUS_OPTIONS: Array<{ value: TenderStatus; label: string }> = [
  { value: 'new', label: STATUS_LABELS.new },
  { value: 'wip', label: STATUS_LABELS.wip },
  { value: 'submitted', label: STATUS_LABELS.submitted },
  { value: 'rejected', label: STATUS_LABELS.rejected },
];

const STATUS_COLORS: Record<TenderStatus, string> = {
  new: '#388BFD',
  wip: '#D29922',
  submitted: '#2EA043',
  rejected: '#6E7681',
};

const STATUS_BG: Record<TenderStatus, string> = {
  new: 'rgba(56,139,253,0.12)',
  wip: 'rgba(210,153,34,0.12)',
  submitted: 'rgba(46,160,67,0.12)',
  rejected: 'rgba(110,118,129,0.12)',
};

const TenderRow = ({ tender, index, onRowClick, onStatusChange }: TenderRowProps) => {
  const days = daysUntil(tender.deadline);
  const isUrgent = days <= 4;
  const isRejected = tender.status === 'rejected';
  const isHighPrice = tender.price >= 1000000;

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    onStatusChange(tender.id, e.target.value as TenderStatus);
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <tr
      onClick={() => onRowClick(tender)}
      className="cursor-pointer transition-colors"
      style={{
        opacity: isRejected ? 0.45 : 1,
        borderLeft: isUrgent ? '2px solid var(--ts-urgent)' : '2px solid transparent',
        transition: 'background 150ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'var(--ts-row-hover)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent';
      }}
    >
      {/* # */}
      <td
        className="px-3 py-0 text-xs text-right select-none"
        style={{ color: 'var(--ts-text-secondary)', width: '40px', height: '44px' }}
      >
        {index}
      </td>

      {/* Title */}
      <td className="px-3 py-0" style={{ maxWidth: '300px', height: '44px' }}>
        <div
          className="text-sm font-medium truncate"
          title={tender.title}
          style={{ color: 'var(--ts-text-primary)' }}
        >
          {tender.title}
        </div>
      </td>

      {/* Customer */}
      <td
        className="px-3 py-0 hidden md:table-cell"
        style={{ maxWidth: '180px', height: '44px' }}
      >
        <div
          className="text-sm truncate"
          title={tender.customer}
          style={{ color: 'var(--ts-text-secondary)' }}
        >
          {tender.customer}
        </div>
      </td>

      {/* Price — right-aligned */}
      <td
        className="px-3 py-0 text-right whitespace-nowrap hidden sm:table-cell"
        style={{ height: '44px' }}
      >
        <span
          className="text-sm font-medium tabular-nums"
          style={{ color: isHighPrice ? 'var(--ts-price-high)' : 'var(--ts-text-primary)' }}
        >
          {formatPrice(tender.price)}
        </span>
      </td>

      {/* Deadline */}
      <td className="px-3 py-0 whitespace-nowrap hidden sm:table-cell" style={{ height: '44px' }}>
        <span
          className="text-sm"
          style={{ color: isUrgent ? 'var(--ts-urgent)' : 'var(--ts-text-secondary)' }}
          title={isUrgent && days > 0 ? `Осталось ${days} дн.` : undefined}
        >
          {formatDate(tender.deadline)}
          {isUrgent && days > 0 && (
            <span className="ml-1 text-xs" style={{ color: 'var(--ts-urgent)' }}>
              ({days}д)
            </span>
          )}
          {days <= 0 && (
            <span className="ml-1 text-xs" style={{ color: 'var(--ts-urgent)' }}>
              (просрочен)
            </span>
          )}
        </span>
      </td>

      {/* Source */}
      <td className="px-3 py-0 hidden lg:table-cell" style={{ height: '44px' }}>
        <span
          className="source-badge"
          style={{
            borderColor: SOURCE_COLORS[tender.source] || 'var(--ts-border)',
            color: SOURCE_COLORS[tender.source] || 'var(--ts-text-secondary)',
            backgroundColor: `${SOURCE_COLORS[tender.source]}18` || 'transparent',
          }}
        >
          {tender.source}
        </span>
      </td>

      {/* Status */}
      <td className="px-3 py-0" style={{ height: '44px' }} onClick={(e) => e.stopPropagation()}>
        <div className="relative inline-flex items-center">
          <select
            value={tender.status}
            onChange={handleStatusChange}
            className="appearance-none pl-2 pr-6 py-0.5 text-xs font-medium rounded cursor-pointer"
            style={{
              backgroundColor: STATUS_BG[tender.status],
              color: STATUS_COLORS[tender.status],
              border: `1px solid ${STATUS_COLORS[tender.status]}40`,
              borderRadius: '4px',
              outline: 'none',
              minWidth: '120px',
              height: '26px',
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                style={{ backgroundColor: 'var(--ts-surface)', color: 'var(--ts-text-primary)' }}
              >
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={10}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: STATUS_COLORS[tender.status] }}
          />
        </div>
      </td>

      {/* Link */}
      <td className="px-3 py-0 hidden md:table-cell" style={{ height: '44px' }}>
        <a
          href={tender.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
          className="inline-flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--ts-accent)' }}
        >
          Открыть <ExternalLink size={11} />
        </a>
      </td>
    </tr>
  );
};

export default TenderRow;
