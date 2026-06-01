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
    // Services are included in settings.gradle.kts as `:<service>` (the project
    // dir is remapped to apps/<service>), so the Gradle path has no `apps:` segment.
    const spotless = affected.map((s) => `:${s}:spotlessApply`).join(' ');
    const checkstyle = affected.map((s) => `:${s}:checkstyleMain`).join(' ');
    return [`./gradlew ${spotless} --continue`, `./gradlew ${checkstyle} --continue`];
  },
};
