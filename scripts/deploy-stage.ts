#!/usr/bin/env bun
import * as p from '@clack/prompts';
import { $ } from 'bun';
import { defineCommand, runMain } from 'citty';

const main = defineCommand({
  meta: {
    name: 'deploy-stage',
    description: 'Deploy the latest Helm release to a k8s environment',
  },
  args: {
    namespace: {
      type: 'string',
      alias: 'n',
      description: 'Target namespace',
      default: 't99-stage',
    },
    'no-studio': {
      type: 'boolean',
      description: 'Skip Drizzle Studio entirely',
      default: false,
    },
    'no-oauth': {
      type: 'boolean',
      description: 'Deploy Studio without OAuth2 proxy (publicly accessible)',
      default: false,
    },
    'client-id': {
      type: 'string',
      description: 'GitHub OAuth client ID',
      default: '',
    },
    'client-secret': {
      type: 'string',
      description: 'GitHub OAuth client secret',
      default: '',
    },
    'dry-run': {
      type: 'boolean',
      description: 'Pass --dry-run=client to helm — validate without deploying',
      default: false,
    },
    prod: {
      type: 'boolean',
      description: 'Use values.prod.yaml and default to t99-prod namespace',
      default: false,
    },
  },
  async run({ args }) {
    // --prod defaults namespace to t99-prod unless -n was explicitly supplied
    const namespace = args.prod && args.namespace === 't99-stage' ? 't99-prod' : args.namespace;
    const valuesFile = args.prod
      ? 'k8s/helm/t99-app/values.prod.yaml'
      : 'k8s/helm/t99-app/values.stage.yaml';
    const dryRun = args['dry-run'];

    p.intro(
      `ExpenseFlow deploy → ${namespace}${args.prod ? '  [prod]' : ''}${dryRun ? '  [dry-run]' : ''}`
    );

    // -------------------------------------------------------------------------
    // Version — latest git tag
    // -------------------------------------------------------------------------

    let version: string;
    try {
      version = (await $`git describe --tags --abbrev=0`.quiet().text()).trim().replace(/^v/, '');
    } catch {
      p.cancel('No git tags found. Tag a release first (e.g. git tag v0.1.0).');
      process.exit(1);
    }

    p.log.info(`Version: v${version}`);

    // -------------------------------------------------------------------------
    // Drizzle Studio — resolve credentials / intent
    // -------------------------------------------------------------------------

    let studioEnabled = !args['no-studio'];
    let oauthEnabled = !args['no-oauth'];
    let clientId = args['client-id'];
    let clientSecret = args['client-secret'];

    if (studioEnabled) {
      // Try loading credentials from cluster secret first
      const s = p.spinner();
      s.start('Checking cluster for existing OAuth credentials…');
      try {
        const raw = await $`kubectl get secret t99-studio-oauth2 -n ${namespace} -o json`
          .quiet()
          .text();
        const { data = {} } = JSON.parse(raw);
        const id = data.clientId ? atob(data.clientId) : '';
        const secret = data.clientSecret ? atob(data.clientSecret) : '';
        if (id && secret) {
          clientId = id;
          clientSecret = secret;
          s.stop('OAuth credentials loaded from cluster.');
        } else {
          s.stop('Secret exists but credentials are empty — will prompt.');
        }
      } catch {
        s.stop('No existing OAuth secret found.');
      }

      const credentialsResolved = !!(clientId && clientSecret);

      if (!credentialsResolved && !args['no-oauth']) {
        // Interactive flow
        const deployStudio = await p.confirm({ message: 'Deploy Drizzle Studio?' });
        if (p.isCancel(deployStudio)) {
          p.cancel('Cancelled.');
          process.exit(0);
        }

        if (!deployStudio) {
          studioEnabled = false;
        } else {
          const useOauth = await p.confirm({
            message: 'Protect with GitHub OAuth? (recommended)',
            initialValue: true,
          });
          if (p.isCancel(useOauth)) {
            p.cancel('Cancelled.');
            process.exit(0);
          }

          if (useOauth) {
            oauthEnabled = true;
            const creds = await p.group(
              {
                clientId: () =>
                  p.text({
                    message: 'GitHub OAuth Client ID',
                    validate: (v) => (!v ? 'Required' : undefined),
                  }),
                clientSecret: () =>
                  p.password({
                    message: 'GitHub OAuth Client Secret',
                    validate: (v) => (!v ? 'Required' : undefined),
                  }),
              },
              {
                onCancel: () => {
                  p.cancel('Cancelled.');
                  process.exit(0);
                },
              }
            );
            clientId = creds.clientId;
            clientSecret = creds.clientSecret;
          } else {
            oauthEnabled = false;
            p.log.warn('Studio will be publicly accessible — no authentication.');
            const confirmed = await p.confirm({
              message: 'Continue without OAuth protection?',
              initialValue: false,
            });
            if (p.isCancel(confirmed) || !confirmed) {
              p.cancel('Cancelled.');
              process.exit(0);
            }
          }
        }
      } else if (args['client-id'] && args['client-secret']) {
        p.log.info('Using credentials from CLI flags.');
      }
    }

    // -------------------------------------------------------------------------
    // Helm deploy
    // -------------------------------------------------------------------------

    const s = p.spinner();
    s.start(dryRun ? 'Running helm dry-run…' : 'Deploying…');

    try {
      await $`helm upgrade --install t99 k8s/helm/t99-app/ \
        -n ${namespace} \
        -f k8s/helm/t99-app/values.yaml \
        -f ${valuesFile} \
        --set ${`authService.image.tag=${version}`} \
        --set ${`client.image.tag=${version}`} \
        --set ${`transactionService.image.tag=${version}`} \
        --set ${`notificationService.image.tag=${version}`} \
        --set ${`budgetService.image.tag=${version}`} \
        --set ${`genaiService.image.tag=${version}`} \
        --set ${`genaiService.llmApiKey=${process.env.LLM_API_KEY ?? ''}`} \
        --set ${`drizzleStudio.enabled=${studioEnabled}`} \
        --set ${`drizzleStudio.oauth.enabled=${oauthEnabled}`} \
        --set ${`drizzleStudio.github.clientId=${clientId ?? ''}`} \
        --set ${`drizzleStudio.github.clientSecret=${clientSecret ?? ''}`} \
        --wait --timeout 5m --rollback-on-failure \
        ${dryRun ? '--dry-run=client' : ''}`.quiet();
    } catch (err) {
      s.stop('Deploy failed.');
      // quiet() suppresses stdout; surface stderr so the failure reason is visible
      const stderr =
        err instanceof Error && 'stderr' in err && err.stderr instanceof Uint8Array
          ? new TextDecoder().decode(err.stderr).trim()
          : String(err);
      p.log.error(stderr);
      process.exit(1);
    }

    s.stop(dryRun ? 'Dry-run complete — no changes applied.' : `Deployed v${version}.`);

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------

    if (!dryRun) {
      const domain =
        namespace === 't99-prod'
          ? 't99.stud.k8s.aet.cit.tum.de'
          : 'stage.t99.stud.k8s.aet.cit.tum.de';

      p.outro(
        [
          `App:    https://${domain}`,
          studioEnabled ? `Studio: https://studio.${domain}` : 'Studio: disabled',
        ].join('\n')
      );
    } else {
      p.outro('Dry-run finished. Re-run without --dry-run to deploy.');
    }
  },
});

runMain(main);
