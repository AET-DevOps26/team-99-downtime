import { z } from 'zod';

/**
 * schemas: validation rules + the types inferred from them.
 * The password floor (12) mirrors the server's `minPasswordLength`.
 */
export const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Enter a valid email'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
});

export type SignupValues = z.infer<typeof signupSchema>;
