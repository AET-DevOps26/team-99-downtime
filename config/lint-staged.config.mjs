export default {
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{js,json,md,yaml,yml}': ['prettier --write'],

  '*.py': (files) => {
    const paths = files.join(' ');
    return [
      `uv run --directory apps/genai-service ruff format ${paths}`,
      `uv run --directory apps/genai-service ruff check --fix ${paths}`,
    ];
  },

  // Spotless and Checkstyle operate on the full source tree — ignore the file list
  '*.java': () => [
    './gradlew :apps:budget-service:spotlessApply :apps:transaction-service:spotlessApply :apps:notification-service:spotlessApply --continue',
    './gradlew :apps:budget-service:checkstyleMain :apps:transaction-service:checkstyleMain :apps:notification-service:checkstyleMain --continue',
  ],
};
