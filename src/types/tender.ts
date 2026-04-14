export type TenderStatus = 'new' | 'wip' | 'submitted' | 'rejected';
export type TenderSource = 'ЕИС 44-ФЗ' | 'ЕИС 223-ФЗ' | 'ROOF.ru' | 'КомТендер';

export interface Tender {
  documentId?: string;
  id: string;
  title: string;
  customer: string;
  regionCode: string;
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
  field: SortField | null;
  dir: SortDir | null;
}

export const STATUS_LABELS: Record<TenderStatus, string> = {
  new: 'Новый',
  wip: 'Взяли в работу',
  submitted: 'Подали заявку',
  rejected: 'Отказ',
};

