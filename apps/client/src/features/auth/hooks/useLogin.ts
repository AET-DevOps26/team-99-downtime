import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { signInWithEmail, signInWithGoogle } from '../api/authApi';
import { loginSchema, type LoginValues } from '../schemas/authSchemas';

/**
 * hooks: orchestrates the login form. Owns form state, submission, error
 * handling, and navigation. Renders nothing — the UI receives this via props.
 */
export function useLogin() {
  const navigate = useNavigate();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await signInWithEmail(values);
    if (error) {
      toast.error(error.message ?? 'Could not sign in. Check your credentials.');
      return;
    }
    navigate('/');
  });

  const onGoogle = () => {
    void signInWithGoogle('/');
  };

  return { form, onSubmit, onGoogle, isSubmitting: form.formState.isSubmitting };
}
