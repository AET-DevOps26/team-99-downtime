import type { FormEventHandler } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/shared/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';

import type { LoginValues } from '../schemas/authSchemas';
import { GoogleButton } from './GoogleButton';

interface LoginFormProps {
  form: UseFormReturn<LoginValues>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onGoogle: () => void;
  isSubmitting: boolean;
}

/**
 * ui: presentational login form. It binds to the react-hook-form instance passed
 * in but contains no submission, navigation, or data logic.
 */
export function LoginForm({ form, onSubmit, onGoogle, isSubmitting }: LoginFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        OR
        <span className="h-px flex-1 bg-border" />
      </div>

      <GoogleButton onClick={onGoogle} disabled={isSubmitting} />
    </Form>
  );
}
