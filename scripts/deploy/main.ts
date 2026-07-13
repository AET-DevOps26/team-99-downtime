#!/usr/bin/env bun
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as p from '@clack/prompts';
import { $ } from 'bun';
import { defineCommand, runMain } from 'citty';
import { features, inputs, type DeployInput } from './inputs';

// ─── .env loading ─────────────────────────────────────────────────────────────
// Bun auto-loads .env from CWD, but scripts can be run from any directory.
// Explicitly parse the repo-root .env so process.env is populated regardless.
// Shell-exported variables always take precedence over .env values.
const repoRoot = resolve(import.meta.dir, '../..');
const dotenvFile = Bun.file(join(repoRoot, '.env'));
if (await dotenvFile.exists()) {
  for (const line of (await dotenvFile.text()).split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)/);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key]) continue;
    process.env[key] = raw.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function envVarToFlag(envVar: string): string {
  return envVar.toLowerCase().replace(/_/g, '-');
}

async function readClusterSecret(namespace: string, name: string, key: string): Promise<string> {
  try {
    const raw = await $`kubectl get secret ${name} -n ${namespace} -o json`.quiet().text();
    const data: Record<string, string> = JSON.parse(raw).data ?? {};
    return data[key] ? atob(data[key]) : '';
  } catch {
    return '';
  }
}

function setPath(obj: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] ??= {};
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts.at(-1)!] = value;
}

function toYaml(obj: Record<string, unknown>, depth = 0): string {
  const pad = '  '.repeat(depth);
  return Object.entries(obj)
    .map(([k, v]) =>
      typeof v === 'object' && v !== null
        ? `${pad}${k}:\n${toYaml(v as Record<string, unknown>, depth + 1)}`
        : `${pad}${k}: ${JSON.stringify(v)}`
    )
    .join('\n');
}

const NAMESPACE_BY_ENV: Record<string, string> = { stage: 't99-stage', prod: 't99-prod' };
const VALUES_FILE_BY_ENV: Record<string, string> = {
  stage: 'k8s/helm/t99-app/values.stage.yaml',
  prod: 'k8s/helm/t99-app/values.prod.yaml',
};
const SERVICES = [
  'authService',
  'client',
  'transactionService',
  'notificationService',
  'budgetService',
  'genaiService',
];

// ─── Command ──────────────────────────────────────────────────────────────────
// Build citty args dynamically from inputs so every input gets a CLI override.
const inputArgs = Object.fromEntries(
  inputs.map((i) => [
    envVarToFlag(i.envVar),
    { type: 'string' as const, description: i.description, default: '' },
  ])
);

const main = defineCommand({
  meta: { name: 'deploy', description: 'Deploy ExpenseFlow to a k8s environment' },
  args: {
    env: {
      type: 'string',
      alias: 'e',
      description: 'Environment (stage|prod) — determines which values file is loaded',
      default: 'stage',
    },
    namespace: {
      type: 'string',
      alias: 'n',
      description: 'k8s namespace override (defaults to t99-<env>)',
      default: '',
    },
    version: {
      type: 'string',
      alias: 'v',
      description: 'Image tag to deploy (defaults to latest git tag)',
      default: '',
    },
    'dry-run': {
      type: 'boolean',
      description: 'Pass --dry-run=client to helm — validate without applying',
      default: false,
    },
    ...inputArgs,
  },

  async run({ args }) {
    const env = args.env;
    const namespace = args.namespace || NAMESPACE_BY_ENV[env] || `t99-${env}`;
    const dryRun = args['dry-run'];

    p.intro(`ExpenseFlow deploy → ${namespace}${dryRun ? ' [dry-run]' : ''}`);

    // ── Version ───────────────────────────────────────────────────────────────
    let version = args.version;
    if (!version) {
      try {
        version = (await $`git describe --tags --abbrev=0`.quiet().text()).trim().replace(/^v/, '');
      } catch {
        p.cancel('No git tags found. Provide --version or tag a release first.');
        process.exit(1);
      }
    }
    p.log.info(`Version: v${version}`);

    // ── Resolution: CLI → .env → cluster → (prompt) ───────────────────────────
    const resolved = new Map<string, string>();

    // Steps 1 + 2: CLI flags and process.env (which already includes .env values)
    for (const input of inputs) {
      const flagValue = (args as Record<string, string>)[envVarToFlag(input.envVar)];
      if (flagValue) {
        resolved.set(input.envVar, flagValue);
        continue;
      }
      const envValue = process.env[input.envVar];
      if (envValue) {
        resolved.set(input.envVar, envValue);
        continue;
      }
    }

    // Step 3: cluster secrets (batch, single spinner)
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

    // ── Feature evaluation and interactive prompts ────────────────────────────
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

    // Step 4a: prompt for required non-feature inputs
    for (const input of unresolvedRequired) {
      if (!process.stdout.isTTY) {
        p.cancel(
          `Required: ${input.envVar} is not set. Add it to .env or pass --${envVarToFlag(input.envVar)}.`
        );
        process.exit(1);
      }
      const val = await (input.secret
        ? p.password({ message: input.description, validate: (v) => (!v ? 'Required' : undefined) })
        : p.text({ message: input.description, validate: (v) => (!v ? 'Required' : undefined) }));
      if (p.isCancel(val)) {
        p.cancel('Cancelled.');
        process.exit(0);
      }
      resolved.set(input.envVar, val as string);
    }

    // Step 4b: prompt per feature group
    for (const [featureKey, unresolved] of unresolvedByFeature) {
      const feature = features[featureKey];
      const foundKeys = inputs
        .filter((i) => i.feature === featureKey && resolved.has(i.envVar))
        .map((i) => i.envVar);
      const missingKeys = unresolved.map((i) => i.envVar).join(', ');

      if (!process.stdout.isTTY) {
        p.log.warn(
          `${feature.label} disabled — missing: ${missingKeys}` +
            (foundKeys.length ? ` (found: ${foundKeys.join(', ')})` : '')
        );
        featureEnabled[featureKey] = false;
        continue;
      }

      const enable = await p.confirm({
        message:
          `Configure ${feature.label}? Missing: ${missingKeys}` +
          (foundKeys.length ? ` (found: ${foundKeys.join(', ')})` : ''),
        initialValue: foundKeys.length > 0,
      });
      if (p.isCancel(enable)) {
        p.cancel('Cancelled.');
        process.exit(0);
      }

      if (!enable) {
        featureEnabled[featureKey] = false;
        continue;
      }

      for (const input of unresolved) {
        const val = await (input.secret
          ? p.password({ message: input.description })
          : p.text({ message: input.description }));
        if (p.isCancel(val)) {
          p.cancel('Cancelled.');
          process.exit(0);
        }
        if (val) {
          resolved.set(input.envVar, val as string);
        } else {
          featureEnabled[featureKey] = false;
          break;
        }
      }
    }

    // ── Build Helm values ─────────────────────────────────────────────────────
    // All values (secrets and non-secrets) go into a temp file to keep them out
    // of the process list. Only boolean feature flags go as --set.
    const valuesObj: Record<string, unknown> = {};
    for (const input of inputs) {
      if (input.feature && !featureEnabled[input.feature]) continue;
      setPath(valuesObj, input.helmPath, resolved.get(input.envVar) ?? '');
    }

    const secretsPath = join(tmpdir(), `t99-deploy-${Date.now()}.yaml`);
    await Bun.write(secretsPath, toYaml(valuesObj) + '\n');
    const removeSecrets = () => unlink(secretsPath).catch(() => {});

    const envValuesFile = VALUES_FILE_BY_ENV[env];
    const valuesFlags = [
      '-f',
      'k8s/helm/t99-app/values.yaml',
      ...(envValuesFile ? ['-f', envValuesFile] : []),
      '-f',
      secretsPath,
    ];

    const imageFlags = SERVICES.flatMap((svc) => ['--set', `${svc}.image.tag=${version}`]);

    const featureFlags = Object.entries(features).flatMap(([key, f]) => [
      '--set',
      `${f.enabledFlag}=${featureEnabled[key]}`,
    ]);

    // ── Helm invocation ───────────────────────────────────────────────────────
    const s = p.spinner();
    s.start(dryRun ? 'Running helm dry-run' : 'Deploying');

    try {
      await $`helm upgrade --install t99 k8s/helm/t99-app/ \
        -n ${namespace} \
        ${valuesFlags} \
        ${imageFlags} \
        ${featureFlags} \
        --wait --timeout 10m --rollback-on-failure \
        ${dryRun ? ['--dry-run=client'] : []}`.quiet();
    } catch (err) {
      s.stop('Deploy failed.');
      const stderr =
        err instanceof Error && 'stderr' in err && err.stderr instanceof Uint8Array
          ? new TextDecoder().decode(err.stderr).trim()
          : String(err);
      p.log.error(stderr);
      await removeSecrets();
      process.exit(1);
    }

    await removeSecrets();
    s.stop(dryRun ? 'Dry-run complete — no changes applied.' : `Deployed v${version}.`);

    // ── Summary ───────────────────────────────────────────────────────────────
    if (!dryRun) {
      const domain =
        namespace === 't99-prod'
          ? 't99.stud.k8s.aet.cit.tum.de'
          : namespace === 't99-stage'
            ? 'stage.t99.stud.k8s.aet.cit.tum.de'
            : `${namespace}.t99.stud.k8s.aet.cit.tum.de`;

      const lines = [`App:    https://${domain}`];
      if (featureEnabled.drizzleStudio) {
        lines.push(`Studio: https://studio.${domain}`);
      } else {
        lines.push('Studio: disabled');
      }

      p.note(lines.join('\n'), `Deployed v${version} → ${namespace}`);
    }

    p.outro('Done.');
  },
});

runMain(main);
