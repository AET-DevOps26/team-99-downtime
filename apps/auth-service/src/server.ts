import { auth } from './auth';
import { withMetrics } from './metrics';

const port = Number(process.env.PORT ?? 3000);

const server = Bun.serve({
  port,
  fetch: withMetrics((req) => auth.handler(req)),
});

console.log(`auth-service listening on ${server.url}`);
