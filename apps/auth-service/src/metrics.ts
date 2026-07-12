/**
 * Prometheus metrics, in Micrometer's shape.
 *
 * The Spring services expose `http_server_requests_seconds_*` tagged with
 * `application`. Emitting the same names and labels here means auth-service lands
 * on the existing dashboard panels and alert rules instead of needing its own.
 */
import { Gauge, Histogram, Registry } from 'prom-client';

const application = 'auth-service';
const version = process.env.APP_VERSION ?? 'dev';

// Own registry, no default collectors: prom-client's defaults ship an unlabelled
// process_start_time_seconds, which collides with the labelled one below.
const registry = new Registry();

const requests = new Histogram({
  name: 'http_server_requests_seconds',
  help: 'HTTP request latency',
  labelNames: ['application', 'method', 'uri', 'status', 'outcome'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

const startTimeSeconds = new Gauge({
  name: 'process_start_time_seconds',
  help: 'Start time of the process since unix epoch',
  labelNames: ['application', 'version'],
  registers: [registry],
});

const uptimeSeconds = new Gauge({
  name: 'process_uptime_seconds',
  help: 'Process uptime',
  labelNames: ['application', 'version'],
  registers: [registry],
});

const cpuUsage = new Gauge({
  name: 'process_cpu_usage',
  help: 'CPU used by this process, as a fraction of all available cores',
  labelNames: ['application', 'version'],
  registers: [registry],
});

const startedAt = Date.now();
startTimeSeconds.labels(application, version).set(startedAt / 1000);

const cores = navigator.hardwareConcurrency || 1;
// CPU usage is a rate, so it needs two samples. Keep the previous scrape's.
let lastSample: { wall: number; cpu: number } | null = null;

/** Fraction of total CPU used since the last scrape, matching Micrometer's
 *  process_cpu_usage (0-1 across all cores, not per-core). */
function currentCpuUsage(): number {
  const usage = process.cpuUsage();
  const sample = { wall: performance.now() * 1000, cpu: usage.user + usage.system };
  const previous = lastSample;
  lastSample = sample;
  if (!previous) return 0;
  const elapsed = sample.wall - previous.wall;
  if (elapsed <= 0) return 0;
  return Math.min((sample.cpu - previous.cpu) / (elapsed * cores), 1);
}

const outcomes: Record<number, string> = {
  2: 'SUCCESS',
  3: 'REDIRECTION',
  4: 'CLIENT_ERROR',
  5: 'SERVER_ERROR',
};

/** Wraps a fetch handler: serves /metrics, times everything else. */
export function withMetrics(handler: (req: Request) => Response | Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const { pathname } = new URL(req.url);

    if (pathname === '/metrics') {
      uptimeSeconds.labels(application, version).set((Date.now() - startedAt) / 1000);
      cpuUsage.labels(application, version).set(currentCpuUsage());
      return new Response(await registry.metrics(), {
        headers: { 'Content-Type': registry.contentType },
      });
    }

    const started = performance.now();
    const response = await handler(req);
    const status = response.status;
    requests
      .labels(
        application,
        req.method,
        pathname,
        String(status),
        outcomes[Math.floor(status / 100)] ?? 'UNKNOWN'
      )
      .observe((performance.now() - started) / 1000);
    return response;
  };
}
