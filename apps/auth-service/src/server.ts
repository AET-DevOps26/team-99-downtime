import { auth } from './auth';

const port = Number(process.env.PORT ?? 3000);

const server = Bun.serve({
  port,
  fetch: (req) => auth.handler(req),
});

console.log(`auth-service listening on ${server.url}`);
