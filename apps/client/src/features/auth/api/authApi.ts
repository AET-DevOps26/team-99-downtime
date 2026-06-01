import { authClient } from '@/shared/lib/auth-client';

/**
 * api: thin, framework-agnostic wrappers over the auth client. These define
 * their own DTOs so the api layer never depends on the validation schemas.
 * No React, no UI, no navigation here.
 */
export interface EmailSignInInput {
  email: string;
  password: string;
}

export interface EmailSignUpInput {
  name: string;
  email: string;
  password: string;
}

export function signInWithEmail(input: EmailSignInInput) {
  return authClient.signIn.email({
    email: input.email,
    password: input.password,
  });
}

export function signUpWithEmail(input: EmailSignUpInput) {
  return authClient.signUp.email({
    name: input.name,
    email: input.email,
    password: input.password,
  });
}

export function signInWithGoogle(callbackURL = '/') {
  return authClient.signIn.social({ provider: 'google', callbackURL });
}

export function signOut() {
  return authClient.signOut();
}
