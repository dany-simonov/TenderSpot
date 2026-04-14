import { useState, useMemo, useCallback } from 'react';
import { Tender, TenderStatus, SortField, SortState } from '@/types/tender';
import {
  useRealtimeTendersSync,
  useTendersQuery,
  useUpdateTenderNotesMutation,
  useUpdateTenderStatusMutation,
} from '@/hooks/useTenders';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/auth/AuthContext';
import Header from '@/components/layout/Header';
import FilterBar from '@/components/features/FilterBar';
import TenderTable from '@/components/features/TenderTable';
import TenderDrawer from '@/components/features/TenderDrawer';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast } from '@/hooks/use-toast';

function isSameLocalDay(aIso: string, bIso: string): boolean {
  const a = new Date(aIso);
  const b = new Date(bIso);

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseDeadlineForSort(value: string): number | null {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const iso = new Date(value);
    return Number.isNaN(iso.getTime()) ? null : iso.getTime();
  }

  const dmY = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dmY) {
    const parsed = new Date(`${dmY[3]}-${dmY[2]}-${dmY[1]}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }

  return null;
}

const Index = () => {
  const [theme, toggleTheme] = useTheme();
  const { logout } = useAuth();

  const {
    data: tenders = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useTendersQuery();
  const updateStatusMutation = useUpdateTenderStatusMutation();
  const updateNotesMutation = useUpdateTenderNotesMutation();

  useRealtimeTendersSync();

  const [lastSync, setLastSync] = useLocalStorage<string>('tenderspot_last_manual_refresh_at', '');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenderStatus | 'all'>('all');
  const [hideNoDeadline, setHideNoDeadline] = useState(false);
  const [sort, setSort] = useState<SortState>({ field: 'deadline', dir: 'asc' });
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);

  const selectedTender = useMemo(
    () => (selectedTenderId ? tenders.find((item) => item.id === selectedTenderId) ?? null : null),
    [selectedTenderId, tenders]
  );

  const handleStatusChange = useCallback(
    (id: string, status: TenderStatus) => {
      const tender = tenders.find((item) => item.id === id);
      if (!tender?.documentId) {
        return;
      }

      updateStatusMutation.mutate({
        documentId: tender.documentId,
        status,
      });
    },
    [tenders, updateStatusMutation]
  );

  const handleNotesChange = useCallback(
    (id: string, notes: string) => {
      const tender = tenders.find((item) => item.id === id);
      if (!tender?.documentId) {
        return;
      }

      updateNotesMutation.mutate({
        documentId: tender.documentId,
        notes,
      });
    },
    [tenders, updateNotesMutation]
  );

  const handleSort = useCallback(
    (field: SortField) => {
      setSort((prev) => {
        if (field === 'deadline') {
          if (prev.field !== 'deadline' || prev.dir === null) {
            return { field: 'deadline', dir: 'asc' };
          }
          if (prev.dir === 'asc') {
            return { field: 'deadline', dir: 'desc' };
          }
          return { field: null, dir: null };
        }

        if (prev.field === field && prev.dir !== null) {
          return { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
        }
        return { field, dir: 'asc' };
      });
    },
    []
  );

  const handleRowClick = useCallback((tender: Tender) => {
    setSelectedTenderId(tender.id);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setSelectedTenderId(null);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenders.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (hideNoDeadline && !t.deadline) return false;
      if (q) {
        const searchHaystack = [
          t.title,
          t.customer,
          t.description,
          t.inn,
          t.id,
          String(t.price),
          t.regionCode,
        ]
          .join(' ')
          .toLowerCase();
        if (!searchHaystack.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [tenders, search, statusFilter, hideNoDeadline]);

  const sorted = useMemo(() => {
    if (!sort.field || !sort.dir) {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sort.field === 'deadline') {
        const aTime = parseDeadlineForSort(a.deadline);
        const bTime = parseDeadlineForSort(b.deadline);

        if (aTime === null && bTime === null) {
          cmp = 0;
        } else if (aTime === null) {
          cmp = 1;
        } else if (bTime === null) {
          cmp = -1;
        } else {
          cmp = aTime - bTime;
        }
      }
      else if (sort.field === 'price') cmp = a.price - b.price;
      else if (sort.field === 'published') cmp = a.published.localeCompare(b.published);
      else if (sort.field === 'title') cmp = a.title.localeCompare(b.title, 'ru');
      else if (sort.field === 'customer') cmp = a.customer.localeCompare(b.customer, 'ru');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sort]);

  const counts = useMemo(() => {
    const base =
      statusFilter === 'all'
        ? filtered
        : tenders.filter((t) => {
            const q = search.trim().toLowerCase();
            if (hideNoDeadline && !t.deadline) return false;
            if (q) {
              const searchHaystack = [
                t.title,
                t.customer,
                t.description,
                t.inn,
                t.id,
                String(t.price),
                t.regionCode,
              ]
                .join(' ')
                .toLowerCase();
              if (!searchHaystack.includes(q)) {
                return false;
              }
            }
            return true;
          });
    return {
      total: base.length,
      new: base.filter((t) => t.status === 'new').length,
      wip: base.filter((t) => t.status === 'wip').length,
      submitted: base.filter((t) => t.status === 'submitted').length,
      rejected: base.filter((t) => t.status === 'rejected').length,
    };
  }, [tenders, filtered, statusFilter, hideNoDeadline, search]);

  const handleRefresh = useCallback(async () => {
    const nowIso = new Date().toISOString();
    if (lastSync && isSameLocalDay(lastSync, nowIso)) {
      toast({
        title: 'Обновление недоступно',
        description: `Вы уже обновляли сегодня. Последнее обновление: ${new Date(lastSync).toLocaleString('ru-RU')}`,
      });
      return;
    }

    await refetch();
    setLastSync(nowIso);
    toast({
      title: 'Данные обновлены',
      description: `Последнее обновление: ${new Date(nowIso).toLocaleString('ru-RU')}`,
    });
  }, [lastSync, refetch, setLastSync]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  return (
    <div className="min-h-screen transition-colors" style={{ backgroundColor: 'var(--ts-bg)' }}>
      <Header
        lastSync={lastSync}
        onRefresh={handleRefresh}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        hideNoDeadline={hideNoDeadline}
        onHideNoDeadlineChange={setHideNoDeadline}
        counts={counts}
      />

      {/* Table container */}
      <main>
        <div style={{ borderBottom: '1px solid var(--ts-border)' }}>
          {isLoading ? (
            <div className="py-16 text-center text-sm" style={{ color: 'var(--ts-text-secondary)' }}>
              Загружаем тендеры из Appwrite...
            </div>
          ) : isError ? (
            <div className="py-16 text-center text-sm" style={{ color: '#ef4444' }}>
              {(error as Error)?.message || 'Не удалось загрузить тендеры.'}
            </div>
          ) : (
            <TenderTable
              tenders={sorted}
              sort={sort}
              onSort={handleSort}
              onRowClick={handleRowClick}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>

        {/* Footer row */}
        <div className="px-4 sm:px-6 py-3">
          <p className="text-xs" style={{ color: 'var(--ts-text-muted)' }}>
            Показано {sorted.length} из {tenders.length} тендеров
          </p>
        </div>
      </main>

      {/* Detail drawer */}
      <TenderDrawer
        tender={selectedTender}
        onClose={handleDrawerClose}
        onStatusChange={handleStatusChange}
        onNotesChange={handleNotesChange}
      />
    </div>
  );
};

export default Index;
