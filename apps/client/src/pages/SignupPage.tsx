import { Link } from 'react-router';

import { AuthCard, SignupForm, useSignup } from '@/features/auth';

export function SignupPage() {
  const { form, onSubmit, onGoogle, isSubmitting } = useSignup();

  return (
    <AuthCard
      title="Create your account"
      description="Start tracking your spending with ExpenseFlow"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm form={form} onSubmit={onSubmit} onGoogle={onGoogle} isSubmitting={isSubmitting} />
    </AuthCard>
  );
}

export default SignupPage;
