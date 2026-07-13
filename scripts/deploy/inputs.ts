export interface DeployInput {
  description: string;
  /** process.env key and the source for the auto-generated CLI flag */
  envVar: string;
  /** Written to a temp secrets file rather than --set on the CLI (hides from ps) */
  secret: boolean;
  /** Dot-notation path in Helm values, e.g. "drizzleStudio.github.clientId" */
  helmPath: string;
  /** Hard-fail if unresolved after all resolution steps */
  required?: boolean;
  /** Key into `features` — if any input in a feature group is unresolved, the
   *  feature is disabled and its inputs are omitted from the Helm values. */
  feature?: string;
  /** Try to read from an existing cluster secret before prompting the user */
  clusterSecret?: { name: string; key: string };
}

export interface Feature {
  label: string;
  /** Helm dot-notation path set to true/false, e.g. "drizzleStudio.enabled" */
  enabledFlag: string;
}

export const features: Record<string, Feature> = {
  drizzleStudio: {
    label: 'Drizzle Studio',
    enabledFlag: 'drizzleStudio.enabled',
  },
};

export const inputs: DeployInput[] = [
  {
    description: 'LLM API key for genai-service',
    envVar: 'LLM_API_KEY',
    secret: true,
    helmPath: 'genaiService.llmApiKey',
    required: true,
  },
  {
    description: 'Demo user password (optional — account locked with random password if unset)',
    envVar: 'DEMO_USER_PASSWORD',
    secret: true,
    helmPath: 'demoUserPassword',
  },
  {
    description: 'GitHub OAuth Client ID for Drizzle Studio',
    envVar: 'STUDIO_GITHUB_CLIENT_ID',
    secret: false,
    helmPath: 'drizzleStudio.github.clientId',
    feature: 'drizzleStudio',
    clusterSecret: { name: 't99-studio-oauth2', key: 'clientId' },
  },
  {
    description: 'GitHub OAuth Client Secret for Drizzle Studio',
    envVar: 'STUDIO_GITHUB_CLIENT_SECRET',
    secret: true,
    helmPath: 'drizzleStudio.github.clientSecret',
    feature: 'drizzleStudio',
    clusterSecret: { name: 't99-studio-oauth2', key: 'clientSecret' },
  },
];
