import { useEffect, useRef } from 'react';
import { X, ExternalLink, Calendar, Building, Hash, Tag } from 'lucide-react';
import { Tender, TenderStatus, STATUS_LABELS } from '@/types/tender';
import { formatDate, formatPrice } from '@/components/features/TenderRow';

interface TenderDrawerProps {
  tender: Tender | null;
  onClose: () => void;
  onStatusChange: (id: string, status: TenderStatus) => void;
  onNotesChange: (id: string, notes: string) => void;
}

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

const SOURCE_COLORS: Record<string, string> = {
  'ЕИС 44-ФЗ': '#388BFD',
  'ЕИС 223-ФЗ': '#8957E5',
  'ROOF.ru': '#2EA043',
  'КомТендер': '#D29922',
};

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(dateStr);
  deadline.setHours(0, 0, 0, 0);
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const TenderDrawer = ({ tender, onClose, onStatusChange, onNotesChange }: TenderDrawerProps) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    if (tender) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [tender]);

  if (!tender) return null;

  const days = daysUntil(tender.deadline);
  const isUrgent = days <= 4;
  const isHighPrice = tender.price >= 1000000;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={handleBackdropClick}
    >
      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="h-full overflow-y-auto flex flex-col transition-colors"
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--ts-surface)',
          borderLeft: '1px solid var(--ts-border)',
          animation: 'slideIn 150ms ease',
        }}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between px-5 py-4 sticky top-0 transition-colors"
          style={{ backgroundColor: 'var(--ts-surface)', borderBottom: '1px solid var(--ts-border)', zIndex: 1 }}
        >
          <span className="text-xs font-medium" style={{ color: 'var(--ts-text-secondary)' }}>
            Детали тендера
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors btn-outline"
            style={{ borderRadius: '4px', border: 'none' }}
            aria-label="Закрыть"
          >
            <X size={16} style={{ color: 'var(--ts-text-secondary)' }} />
          </button>
        </div>

        {/* Drawer content */}
        <div className="flex-1 px-5 py-4 space-y-5">
          {/* Title */}
          <div>
            <h2 className="text-sm font-semibold leading-snug" style={{ color: 'var(--ts-text-primary)' }}>
              {tender.title}
            </h2>
          </div>

          {/* Meta grid */}
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Building size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--ts-text-secondary)' }} />
              <div>
                <p className="text-xs" style={{ color: 'var(--ts-text-secondary)' }}>Заказчик</p>
                <p className="text-sm" style={{ color: 'var(--ts-text-primary)' }}>{tender.customer}</p>
                {tender.inn && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ts-text-muted)' }}>
                    ИНН: {tender.inn}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Hash size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--ts-text-secondary)' }} />
              <div>
                <p className="text-xs" style={{ color: 'var(--ts-text-secondary)' }}>НМЦ</p>
                <p
                  className="text-base font-semibold tabular-nums"
                  style={{ color: isHighPrice ? 'var(--ts-price-high)' : 'var(--ts-text-primary)' }}
                >
                  {formatPrice(tender.price)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--ts-text-secondary)' }} />
              <div>
                <p className="text-xs" style={{ color: 'var(--ts-text-secondary)' }}>Даты</p>
                <p className="text-sm" style={{ color: 'var(--ts-text-primary)' }}>
                  Опубликован: {formatDate(tender.published)}
                </p>
                <p
                  className="text-sm"
                  style={{ color: isUrgent ? 'var(--ts-urgent)' : 'var(--ts-text-primary)' }}
                >
                  Дедлайн: {formatDate(tender.deadline)}
                  {isUrgent && days > 0 && (
                    <span className="ml-1 text-xs" style={{ color: 'var(--ts-urgent)' }}>
                      (осталось {days} дн.)
                    </span>
                  )}
                  {days <= 0 && (
                    <span className="ml-1 text-xs" style={{ color: 'var(--ts-urgent)' }}>
                      (просрочен)
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Source */}
            <div className="flex items-start gap-2">
              <Tag size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--ts-text-secondary)' }} />
              <div>
                <p className="text-xs" style={{ color: 'var(--ts-text-secondary)' }}>Источник</p>
                <a
                  href={tender.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm"
                  style={{ color: SOURCE_COLORS[tender.source] || 'var(--ts-accent)' }}
                >
                  {tender.source} <ExternalLink size={11} />
                </a>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--ts-border)' }} />

          {/* Description */}
          <div>
            <p className="text-xs mb-1.5" style={{ color: 'var(--ts-text-secondary)' }}>
              Описание / предмет закупки
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--ts-text-primary)' }}>
              {tender.description}
            </p>
          </div>

          {/* Keywords */}
          {tender.keywords && tender.keywords.length > 0 && (
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--ts-text-secondary)' }}>
                Ключевые слова найдены
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tender.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: 'rgba(56,139,253,0.12)',
                      color: 'var(--ts-accent)',
                      border: '1px solid rgba(56,139,253,0.25)',
                      borderRadius: '4px',
                    }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--ts-border)' }} />

          {/* Status selector */}
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--ts-text-secondary)' }}>Статус</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => {
                const isActive = tender.status === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onStatusChange(tender.id, opt.value)}
                    className="px-3 py-1 rounded text-xs font-medium"
                    style={{
                      backgroundColor: isActive ? STATUS_BG[opt.value] : 'transparent',
                      color: isActive ? STATUS_COLORS[opt.value] : 'var(--ts-text-secondary)',
                      border: `1px solid ${isActive ? STATUS_COLORS[opt.value] + '60' : 'var(--ts-border)'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--ts-text-secondary)' }}>Заметки команды</p>
            <textarea
              value={tender.notes}
              onChange={(e) => onNotesChange(tender.id, e.target.value)}
              placeholder="Добавьте заметку для команды..."
              rows={4}
              className="w-full px-3 py-2 text-sm rounded resize-none transition-colors"
              style={{
                backgroundColor: 'var(--ts-bg)',
                border: '1px solid var(--ts-border)',
                color: 'var(--ts-text-primary)',
                outline: 'none',
                borderRadius: '4px',
                lineHeight: '1.6',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--ts-accent)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--ts-border)')}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 sticky bottom-0 transition-colors"
          style={{ backgroundColor: 'var(--ts-surface)', borderTop: '1px solid var(--ts-border)' }}
        >
          <a
            href={tender.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 rounded text-sm font-medium"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--ts-accent)',
              color: 'var(--ts-accent)',
              borderRadius: '4px',
              transition: 'background 150ms ease',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(56,139,253,0.10)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent')}
          >
            Открыть на площадке <ExternalLink size={14} />
          </a>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default TenderDrawer;
