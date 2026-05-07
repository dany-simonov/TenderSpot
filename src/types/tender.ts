export type TenderStatus = 'new' | 'wip' | 'submitted' | 'rejected';
export type TenderSource = 'ЕИС 44-ФЗ' | 'ЕИС 223-ФЗ' | 'ROOF.ru' | 'КомТендер';

export interface Tender {
  documentId?: string;
  id: string;
  title: string;
  customer: string;
  inn: string;
  price: number;
  published: string; // YYYY-MM-DD
  deadline: string;  // YYYY-MM-DD
  source: TenderSource;
  url: string;
  description: string;
  keywords: string[];
  status: TenderStatus;
  notes: string;
}

export type SortField = 'deadline' | 'price' | 'published' | 'title' | 'customer';
export type SortDir = 'asc' | 'desc';

export interface SortState {
  field: SortField;
  dir: SortDir;
}

export const STATUS_LABELS: Record<TenderStatus, string> = {
  new: 'Новый',
  wip: 'Взяли в работу',
  submitted: 'Подали заявку',
  rejected: 'Отказ',
};

export const SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Все источники' },
  { value: 'ЕИС 44-ФЗ', label: 'ЕИС (44-ФЗ)' },
  { value: 'ЕИС 223-ФЗ', label: 'ЕИС (223-ФЗ)' },
  { value: 'ROOF.ru', label: 'ROOF.ru' },
  { value: 'КомТендер', label: 'КомТендер' },
];
