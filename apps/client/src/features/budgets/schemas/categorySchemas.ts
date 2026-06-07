import { z } from 'zod';

/**
 * schemas: what a valid category row looks like, mirroring the budget-service
 * rules so the user gets instant feedback before a request is even sent — empty
 * name and limit ≤ 0 are caught here; the duplicate-name 409 is server-only.
 */
export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  monthlyLimit: z.coerce.number().positive('Limit must be greater than 0'),
});

export type CategoryValues = z.infer<typeof categorySchema>;
