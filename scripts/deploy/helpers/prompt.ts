// Thin wrappers around @clack/prompts that handle the isCancel check and exit
// so call sites don't need the boilerplate. isTTY() gates interactive behaviour.

import * as p from '@clack/prompts';

export const isTTY = (): boolean => process.stdout.isTTY === true;

export async function promptText(message: string, required = false): Promise<string | undefined> {
  const val = await p.text({
    message,
    validate: required ? (v) => (!v ? 'Required' : undefined) : undefined,
  });
  if (p.isCancel(val)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }
  return (val as string) || undefined;
}

export async function promptPassword(
  message: string,
  required = false
): Promise<string | undefined> {
  const val = await p.password({
    message,
    validate: required ? (v) => (!v ? 'Required' : undefined) : undefined,
  });
  if (p.isCancel(val)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }
  return (val as string) || undefined;
}

export async function promptConfirm(message: string, initialValue = true): Promise<boolean> {
  const val = await p.confirm({ message, initialValue });
  if (p.isCancel(val)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }
  return val as boolean;
}
