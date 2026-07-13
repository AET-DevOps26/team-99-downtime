export const NAMESPACE_BY_ENV: Record<string, string> = {
  stage: 't99-stage',
  prod: 't99-prod',
};

export const VALUES_FILE_BY_ENV: Record<string, string> = {
  stage: 'k8s/helm/t99-app/values.stage.yaml',
  prod: 'k8s/helm/t99-app/values.prod.yaml',
};

export const HELM_CHART_DIR = 'k8s/helm/t99-app';
export const HELM_RELEASE_NAME = 't99';
export const HELM_TIMEOUT = '10m';

/** Services that receive the versioned image tag on every deploy. */
export const SERVICES = [
  'authService',
  'client',
  'transactionService',
  'notificationService',
  'budgetService',
  'genaiService',
] as const;
