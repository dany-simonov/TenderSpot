import { useState, useMemo, useCallback } from 'react';
import { MOCK_TENDERS } from '@/data/mockTenders';
import { Tender, TenderStatus, SortField, SortState } from '@/types/tender';
import { useLocalStorage, useLastSync } from '@/hooks/useLocalStorage';
import { useTheme } from '@/hooks/useTheme';
import Header from '@/components/layout/Header';
import FilterBar from '@/components/features/FilterBar';
import TenderTable from '@/components/features/TenderTable';
import TenderDrawer from '@/components/features/TenderDrawer';

const Index = () => {
  // ── Theme ─────────────────────────────────────────────────────
  const [theme, toggleTheme] = useTheme();

  // ── Persistence ──────────────────────────────────────────────
  const [savedStatuses, setSavedStatuses] = useLocalStorage<Record<string, TenderStatus>>(
    'tenderspot_statuses',
    {}
  );
  const [savedNotes, setSavedNotes] = useLocalStorage<Record<string, string>>(
    'tenderspot_notes',
    {}
  );
  const [lastSync, refresh] = useLastSync();

  // ── Merge mock data with persisted statuses/notes ─────────────
  const tenders: Tender[] = useMemo(
    () =>
      MOCK_TENDERS.map((t) => ({
        ...t,
        status: savedStatuses[t.id] ?? t.status,
        notes: savedNotes[t.id] ?? t.notes,
      })),
    [savedStatuses, savedNotes]
  );

  // ── UI state ──────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenderStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortState>({ field: 'deadline', dir: 'asc' });
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);

  // ── Handlers ──────────────────────────────────────────────────
  const handleStatusChange = useCallback(
    (id: string, status: TenderStatus) => {
      setSavedStatuses((prev) => ({ ...prev, [id]: status }));
      setSelectedTender((prev) => (prev?.id === id ? { ...prev, status } : prev));
    },
    [setSavedStatuses]
  );

  const handleNotesChange = useCallback(
    (id: string, notes: string) => {
      setSavedNotes((prev) => ({ ...prev, [id]: notes }));
      setSelectedTender((prev) => (prev?.id === id ? { ...prev, notes } : prev));
    },
    [setSavedNotes]
  );

  const handleSort = useCallback(
    (field: SortField) => {
      setSort((prev) =>
        prev.field === field
          ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
          : { field, dir: 'asc' }
      );
    },
    []
  );

  const handleRowClick = useCallback((tender: Tender) => {
    setSelectedTender(tender);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setSelectedTender(null);
  }, []);

  // ── Filtering & sorting ───────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenders.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (sourceFilter !== 'all' && t.source !== sourceFilter) return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.customer.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [tenders, search, statusFilter, sourceFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sort.field === 'deadline') cmp = a.deadline.localeCompare(b.deadline);
      else if (sort.field === 'price') cmp = a.price - b.price;
      else if (sort.field === 'published') cmp = a.published.localeCompare(b.published);
      else if (sort.field === 'title') cmp = a.title.localeCompare(b.title, 'ru');
      else if (sort.field === 'customer') cmp = a.customer.localeCompare(b.customer, 'ru');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sort]);

  // ── Status counts ─────────────────────────────────────────────
  const counts = useMemo(() => {
    const base =
      statusFilter === 'all'
        ? filtered
        : tenders.filter((t) => {
            const q = search.trim().toLowerCase();
            if (sourceFilter !== 'all' && t.source !== sourceFilter) return false;
            if (q && !t.title.toLowerCase().includes(q) && !t.customer.toLowerCase().includes(q))
              return false;
            return true;
          });
    return {
      total: base.length,
      new: base.filter((t) => t.status === 'new').length,
      wip: base.filter((t) => t.status === 'wip').length,
      submitted: base.filter((t) => t.status === 'submitted').length,
      rejected: base.filter((t) => t.status === 'rejected').length,
    };
  }, [tenders, filtered, statusFilter, sourceFilter, search]);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen transition-colors" style={{ backgroundColor: 'var(--ts-bg)' }}>
      <Header
        lastSync={lastSync}
        onRefresh={refresh}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        counts={counts}
      />

      {/* Table container */}
      <main>
        <div style={{ borderBottom: '1px solid var(--ts-border)' }}>
          <TenderTable
            tenders={sorted}
            sort={sort}
            onSort={handleSort}
            onRowClick={handleRowClick}
            onStatusChange={handleStatusChange}
          />
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
