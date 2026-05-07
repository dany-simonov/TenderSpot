import { ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import { Tender, TenderStatus, SortField, SortState } from '@/types/tender';
import TenderRow from '@/components/features/TenderRow';

interface TenderTableProps {
  tenders: Tender[];
  sort: SortState;
  onSort: (field: SortField) => void;
  onRowClick: (tender: Tender) => void;
  onStatusChange: (id: string, status: TenderStatus) => void;
}

const COLUMNS: Array<{ field: SortField | null; label: string; className: string }> = [
  { field: null, label: '#', className: 'text-right w-10' },
  { field: 'title', label: 'Заказчик', className: '' },
  { field: 'customer', label: 'Тип работ', className: 'hidden md:table-cell' },
  { field: 'price', label: 'НМЦ (₽)', className: 'text-right hidden sm:table-cell' },
  { field: 'deadline', label: 'Дедлайн', className: 'hidden sm:table-cell' },
  { field: null, label: 'Источник', className: 'hidden lg:table-cell' },
  { field: null, label: 'Статус', className: '' },
  { field: null, label: 'Ссылка', className: 'hidden md:table-cell' },
];

const TenderTable = ({
  tenders,
  sort,
  onSort,
  onRowClick,
  onStatusChange,
}: TenderTableProps) => {
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sort.field !== field || !sort.dir) {
      return <ChevronUp size={10} style={{ color: 'var(--ts-border)' }} />;
    }
    return sort.dir === 'asc' ? (
      <ChevronUp size={10} style={{ color: 'var(--ts-accent)' }} />
    ) : (
      <ChevronDown size={10} style={{ color: 'var(--ts-accent)' }} />
    );
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse table-fixed min-w-[720px] sm:min-w-0">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--ts-border)' }}>
            {COLUMNS.map((col, i) => (
              <th
                key={i}
                className={`px-3 py-2 ${col.className} table-header-cell`}
                style={{ height: '36px', whiteSpace: 'nowrap', textAlign: col.label === 'НМЦ (₽)' || col.label === '#' ? 'right' : 'left' }}
              >
                {col.field ? (
                  <button
                    onClick={() => onSort(col.field!)}
                    className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity w-full justify-end"
                    style={{
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      justifyContent: col.label === 'НМЦ (₽)' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {col.label}
                    <SortIcon field={col.field} />
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tenders.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle size={32} style={{ color: 'var(--ts-border)' }} />
                  <p className="text-sm" style={{ color: 'var(--ts-text-secondary)' }}>
                    Тендеры не найдены
                  </p>
                  <p className="text-xs" style={{ color: 'var(--ts-text-muted)' }}>
                    Попробуйте изменить параметры поиска или фильтры
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            tenders.map((tender, i) => (
              <TenderRow
                key={tender.id}
                tender={tender}
                index={i + 1}
                onRowClick={onRowClick}
                onStatusChange={onStatusChange}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TenderTable;
