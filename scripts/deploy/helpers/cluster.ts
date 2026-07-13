// Reads values from existing Kubernetes Secrets via kubectl.
// Used to reuse credentials already stored in the cluster without re-prompting.

import { $ } from 'bun';

export async function readClusterSecret(
  namespace: string,
  name: string,
  key: string
): Promise<string> {
  try {
    const raw = await $`kubectl get secret ${name} -n ${namespace} -o json`.quiet().text();
    const data: Record<string, string> = JSON.parse(raw).data ?? {};
    return data[key] ? atob(data[key]) : '';
  } catch {
    return '';
  }
}
