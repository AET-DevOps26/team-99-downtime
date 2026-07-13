#!/usr/bin/env bun
import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import { $ } from 'bun';
import { defineCommand, runMain } from 'citty';
import {
  HELM_CHART_DIR,
  HELM_RELEASE_NAME,
  HELM_TIMEOUT,
  NAMESPACE_BY_ENV,
  SERVICES,
  VALUES_FILE_BY_ENV,
} from './consts';
import { loadDotEnv } from './helpers/env';
import { domainForNamespace, setPath, writeTempValues } from './helpers/helm';
import { envVarToFlag, resolveInputs } from './helpers/resolve';
import { features, inputs } from './inputs';

const repoRoot = resolve(import.meta.dir, '../..');

// Build citty args dynamically so every input in inputs.ts gets a CLI override flag.
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

    loadDotEnv(repoRoot, env);

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

    // ── Resolve inputs ────────────────────────────────────────────────────────
    const { resolved, featureEnabled } = await resolveInputs(
      inputs,
      features,
      args as Record<string, string>,
      namespace
    );

    // ── Build Helm values ─────────────────────────────────────────────────────
    const valuesObj: Record<string, unknown> = {};
    for (const input of inputs) {
      if (input.feature && !featureEnabled[input.feature]) continue;
      setPath(valuesObj, input.helmPath, resolved.get(input.envVar) ?? '');
    }

    const envValuesFile = VALUES_FILE_BY_ENV[env];
    const valuesFlags = [
      '-f',
      `${HELM_CHART_DIR}/values.yaml`,
      ...(envValuesFile ? ['-f', envValuesFile] : []),
    ];
    const imageFlags = SERVICES.flatMap((svc) => ['--set', `${svc}.image.tag=${version}`]);
    const featureFlags = Object.entries(features).flatMap(([key, f]) => [
      '--set',
      `${f.enabledFlag}=${featureEnabled[key]}`,
    ]);

    const { path: secretsPath, cleanup } = await writeTempValues(valuesObj);

    // ── Helm ──────────────────────────────────────────────────────────────────
    const s = p.spinner();
    s.start(dryRun ? 'Running helm dry-run' : 'Deploying');

    try {
      await $`helm upgrade --install ${HELM_RELEASE_NAME} ${HELM_CHART_DIR} \
        -n ${namespace} \
        ${valuesFlags} \
        -f ${secretsPath} \
        ${imageFlags} \
        ${featureFlags} \
        --wait --timeout ${HELM_TIMEOUT} --rollback-on-failure \
        ${dryRun ? ['--dry-run=client'] : []}`.quiet();
    } catch (err) {
      s.stop('Deploy failed.');
      const stderr =
        err instanceof Error && 'stderr' in err && err.stderr instanceof Uint8Array
          ? new TextDecoder().decode(err.stderr).trim()
          : String(err);
      p.log.error(stderr);
      await cleanup();
      process.exit(1);
    }

    await cleanup();
    s.stop(dryRun ? 'Dry-run complete — no changes applied.' : `Deployed v${version}.`);

    // ── Summary ───────────────────────────────────────────────────────────────
    if (!dryRun) {
      const domain = domainForNamespace(namespace);
      const lines = [`App: https://${domain}`];
      for (const [key, feature] of Object.entries(features)) {
        if (feature.subdomain) {
          lines.push(
            featureEnabled[key]
              ? `${feature.label}: https://${feature.subdomain}.${domain}`
              : `${feature.label}: disabled`
          );
        }
      }
      p.note(lines.join('\n'), `Deployed v${version} → ${namespace}`);
    }

    p.outro('Done.');
  },
});

runMain(main);
