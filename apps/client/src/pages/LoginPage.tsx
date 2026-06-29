import { Link } from 'react-router';

import { AuthCard, LoginForm, useLogin } from '@/features/auth';

export function LoginPage() {
  const { form, onSubmit, onGoogle, isSubmitting } = useLogin();

  return (
    <AuthCard
      title="Sign in"
      description="Welcome back to ExpenseFlow"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="text-foreground underline underline-offset-4">
            Sign up
          </Link>
        </>
      }
    >
      <LoginForm form={form} onSubmit={onSubmit} onGoogle={onGoogle} isSubmitting={isSubmitting} />
    </AuthCard>
  );
}

export default LoginPage;
