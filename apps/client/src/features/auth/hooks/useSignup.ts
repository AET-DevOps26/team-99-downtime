import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { signUpWithEmail, signInWithGoogle } from '../api/authApi';
import { signupSchema, type SignupValues } from '../schemas/authSchemas';

/**
 * hooks: orchestrates the sign-up form (see useLogin for the pattern).
 */
export function useSignup() {
  const navigate = useNavigate();

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await signUpWithEmail(values);
    if (error) {
      toast.error(error.message ?? 'Could not create your account.');
      return;
    }
    navigate('/');
  });

  const onGoogle = () => {
    void signInWithGoogle('/');
  };

  return { form, onSubmit, onGoogle, isSubmitting: form.formState.isSubmitting };
}
