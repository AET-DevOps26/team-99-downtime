import { apiClient } from '@/shared/api/client';
import type { components } from '@/shared/api/generated/transaction-service';
import { unwrap } from '@/shared/lib/api';

/**
 * api: thin wrappers over the transaction-service endpoints, built on the
 * shared typed apiClient — URL, method, params and body of every call are
 * compile-checked against openapi/transaction-service.json (regenerate with
 * `bun run openapi`). No React, no UI here.
 */

// Responses always carry every field; springdoc types them optional (no
// @NonNull on the records), so re-require them for ergonomic consumers.
export type Transaction = Required<components['schemas']['TransactionResponse']>;

export type TransactionPage = Omit<
  Required<components['schemas']['PageTransactionResponse']>,
  'content'
> & { content: Transaction[] };

export type TransactionInput = components['schemas']['TransactionRequest'];

export type SkippedRow = Required<components['schemas']['SkippedRow']>;

export type ImportResult = {
  imported: Transaction[];
  skipped: SkippedRow[];
};

export async function listTransactions(
  page = 0,
  size = 20,
  signal?: AbortSignal
): Promise<TransactionPage> {
  return unwrap(
    await apiClient.GET('/api/transactions', {
      params: { query: { page, size } },
      signal,
    })
  ) as TransactionPage;
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  return unwrap(await apiClient.POST('/api/transactions', { body: input })) as Transaction;
}

/** Rejects with a 422 ApiError (`error: 'too_vague' | 'no_categories'`). */
export async function createTransactionsFromText(text: string): Promise<Transaction[]> {
  return unwrap(
    await apiClient.POST('/api/transactions/free-text', { body: { text } })
  ) as Transaction[];
}

/** Rejects with a 422 ApiError (`error: 'invalid_file' | 'no_expenses' | 'no_categories'`). */
export async function importTransactionsFile(file: File): Promise<ImportResult> {
  return unwrap(
    await apiClient.POST('/api/transactions/import', {
      // The spec types the multipart part as a binary string; ship the real
      // File via FormData (the browser sets the multipart boundary itself).
      body: { file } as unknown as { file: string },
      bodySerializer: () => {
        const form = new FormData();
        form.append('file', file);
        return form;
      },
    })
  ) as ImportResult;
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<Transaction> {
  return unwrap(
    await apiClient.PATCH('/api/transactions/{id}', { params: { path: { id } }, body: input })
  ) as Transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  unwrap(await apiClient.DELETE('/api/transactions/{id}', { params: { path: { id } } }));
}
