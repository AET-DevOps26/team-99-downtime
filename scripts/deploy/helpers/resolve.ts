// Resolves every declared DeployInput through a four-step pipeline:
//   1. CLI flag   2. process.env (.env already loaded)
//   3. Existing cluster secret   4. Interactive prompt (TTY only)
// Returns the resolved value map and which features are enabled.

import * as p from '@clack/prompts';
import { type DeployInput, type Feature } from '../inputs';
import { readClusterSecret } from './cluster';
import { isTTY, promptConfirm, promptPassword, promptText } from './prompt';

/** Converts an env var name to the kebab-case CLI flag name citty exposes. */
export function envVarToFlag(envVar: string): string {
  return envVar.toLowerCase().replace(/_/g, '-');
}

export async function resolveInputs(
  inputs: DeployInput[],
  features: Record<string, Feature>,
  cliArgs: Record<string, string>,
  namespace: string
): Promise<{ resolved: Map<string, string>; featureEnabled: Record<string, boolean> }> {
  const resolved = new Map<string, string>();

  // Steps 1 + 2: CLI flags and process.env (which already includes .env values)
  for (const input of inputs) {
    const fromCli = cliArgs[envVarToFlag(input.envVar)];
    if (fromCli) {
      resolved.set(input.envVar, fromCli);
      continue;
    }
    const fromEnv = process.env[input.envVar];
    if (fromEnv) resolved.set(input.envVar, fromEnv);
  }

  // Step 3: cluster secrets — batched under a single spinner
  const needsCluster = inputs.filter((i) => !resolved.has(i.envVar) && i.clusterSecret);
  if (needsCluster.length > 0) {
    const s = p.spinner();
    s.start('Checking cluster for existing secrets');
    for (const input of needsCluster) {
      const val = await readClusterSecret(
        namespace,
        input.clusterSecret!.name,
        input.clusterSecret!.key
      );
      if (val) resolved.set(input.envVar, val);
    }
    s.stop('Cluster check complete.');
  }

  // Bucket still-unresolved inputs
  const featureEnabled: Record<string, boolean> = Object.fromEntries(
    Object.keys(features).map((k) => [k, true])
  );
  const unresolvedByFeature = new Map<string, DeployInput[]>();
  const unresolvedRequired: DeployInput[] = [];

  for (const input of inputs) {
    if (resolved.has(input.envVar)) continue;
    if (input.feature) {
      const group = unresolvedByFeature.get(input.feature) ?? [];
      group.push(input);
      unresolvedByFeature.set(input.feature, group);
    } else if (input.required) {
      unresolvedRequired.push(input);
    }
  }

  // Step 4a: required inputs — hard fail in CI, prompt in TTY
  for (const input of unresolvedRequired) {
    if (!isTTY()) {
      p.cancel(
        `Required: ${input.envVar} is not set. Add it to .env or pass --${envVarToFlag(input.envVar)}.`
      );
      process.exit(1);
    }
    const prompt = input.secret ? promptPassword : promptText;
    const val = await prompt(input.description, true);
    if (val) resolved.set(input.envVar, val);
  }

  // Step 4b: optional feature groups — disable silently in CI, confirm in TTY
  for (const [featureKey, unresolved] of unresolvedByFeature) {
    const feature = features[featureKey];
    const foundKeys = inputs
      .filter((i) => i.feature === featureKey && resolved.has(i.envVar))
      .map((i) => i.envVar);
    const missingList = unresolved.map((i) => i.envVar).join(', ');
    const foundNote = foundKeys.length ? ` (found: ${foundKeys.join(', ')})` : '';

    if (!isTTY()) {
      p.log.warn(`${feature.label} disabled — missing: ${missingList}${foundNote}`);
      featureEnabled[featureKey] = false;
      continue;
    }

    const enable = await promptConfirm(
      `Configure ${feature.label}? Missing: ${missingList}${foundNote}`,
      foundKeys.length > 0
    );

    if (!enable) {
      featureEnabled[featureKey] = false;
      continue;
    }

    for (const input of unresolved) {
      const prompt = input.secret ? promptPassword : promptText;
      const val = await prompt(input.description, false);
      if (val) {
        resolved.set(input.envVar, val);
      } else {
        featureEnabled[featureKey] = false;
        break;
      }
    }
  }

  return { resolved, featureEnabled };
}
