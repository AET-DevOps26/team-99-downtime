import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';

import { LoginForm } from './LoginForm';
import type { LoginValues } from '../schemas/authSchemas';

// The presentational form is testable in isolation: no router, no network, no
// auth client. We feed it a real react-hook-form instance and stub handlers.
function Harness() {
  const form = useForm<LoginValues>({ defaultValues: { email: '', password: '' } });
  return (
    <LoginForm
      form={form}
      onSubmit={(e) => e.preventDefault()}
      onGoogle={() => undefined}
      isSubmitting={false}
    />
  );
}

describe('LoginForm', () => {
  it('renders email and password fields', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });

  it('offers email sign-in and Google sign-in actions', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeTruthy();
  });
});
