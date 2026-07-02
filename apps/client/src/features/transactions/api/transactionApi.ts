import { apiFetch } from '@/shared/lib/api';

export interface Transaction {
  id: string;
  categoryId: string;
  amount: number;
  currency: string;
  description: string;
  date: string;
  createdAt: string;
}

export interface TransactionPage {
  content: Transaction[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
}

export interface TransactionInput {
  categoryId: string;
  amount: number;
  currency: string;
  description: string;
  date: string;
}

const BASE = '/api/transactions';

export function listTransactions(page = 0, size = 20) {
  return apiFetch<TransactionPage>(`${BASE}?page=${page}&size=${size}`);
}

export function createTransaction(input: TransactionInput) {
  return apiFetch<Transaction>(BASE, { method: 'POST', body: JSON.stringify(input) });
}

/** Rejects with a 422 ApiError (`error: 'too_vague' | 'no_categories'`). */
export function createTransactionsFromText(text: string) {
  return apiFetch<Transaction[]>(`${BASE}/free-text`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export interface SkippedRow {
  row: number;
  reason: string;
}

export interface ImportResult {
  imported: Transaction[];
  skipped: SkippedRow[];
}

/** Rejects with a 422 ApiError (`error: 'invalid_file' | 'no_expenses' | 'no_categories'`). */
export function importTransactionsFile(file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<ImportResult>(`${BASE}/import`, { method: 'POST', body: form });
}

export function updateTransaction(id: string, input: TransactionInput) {
  return apiFetch<Transaction>(`${BASE}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTransaction(id: string) {
  return apiFetch<void>(`${BASE}/${id}`, { method: 'DELETE' });
}
