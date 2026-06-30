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

export function updateTransaction(id: string, input: TransactionInput) {
  return apiFetch<Transaction>(`${BASE}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTransaction(id: string) {
  return apiFetch<void>(`${BASE}/${id}`, { method: 'DELETE' });
}
