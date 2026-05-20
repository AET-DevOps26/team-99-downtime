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

  '*.java': (files) => {
    const services = ['budget-service', 'transaction-service', 'notification-service'];
    const affected = services.filter((s) => files.some((f) => f.includes(`/apps/${s}/`)));
    if (affected.length === 0) return [];
    const spotless = affected.map((s) => `:apps:${s}:spotlessApply`).join(' ');
    const checkstyle = affected.map((s) => `:apps:${s}:checkstyleMain`).join(' ');
    return [`./gradlew ${spotless} --continue`, `./gradlew ${checkstyle} --continue`];
  },
};
