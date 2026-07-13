"""Prometheus metrics, in Micrometer's shape.

The Spring services expose `http_server_requests_seconds_*` tagged with
`application`. Emitting the same names and labels here means genai-service lands
on the existing dashboard panels and alert rules instead of needing its own.
"""

import os
import time
from typing import Optional

from fastapi import FastAPI, Request, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Gauge,
    Histogram,
    generate_latest,
)

APPLICATION = "genai-service"
VERSION = os.getenv("APP_VERSION", "dev")

# Own registry: the default one already carries an unlabelled
# process_start_time_seconds, which collides with the labelled one below.
REGISTRY = CollectorRegistry()

_REQUESTS = Histogram(
    "http_server_requests_seconds",
    "HTTP request latency",
    ["application", "method", "uri", "status", "outcome"],
    registry=REGISTRY,
)
_START_TIME = Gauge(
    "process_start_time_seconds",
    "Start time of the process since unix epoch",
    ["application", "version"],
    registry=REGISTRY,
)
_UPTIME = Gauge(
    "process_uptime_seconds",
    "Process uptime",
    ["application", "version"],
    registry=REGISTRY,
)
_CPU = Gauge(
    "process_cpu_usage",
    "CPU used by this process, as a fraction of all available cores",
    ["application", "version"],
    registry=REGISTRY,
)

_STARTED_AT = time.time()
_START_TIME.labels(APPLICATION, VERSION).set(_STARTED_AT)

_CORES = os.cpu_count() or 1
# CPU usage is a rate, so it needs two samples. Keep the previous scrape's.
_last_sample: Optional[tuple[float, float]] = None


def _cpu_usage() -> float:
    """Fraction of total CPU used since the last scrape, matching Micrometer's
    process_cpu_usage (0-1 across all cores, not per-core)."""
    global _last_sample
    wall, cpu = time.monotonic(), time.process_time()
    previous, _last_sample = _last_sample, (wall, cpu)
    if previous is None:
        return 0.0
    elapsed = wall - previous[0]
    if elapsed <= 0:
        return 0.0
    return min((cpu - previous[1]) / (elapsed * _CORES), 1.0)


_OUTCOMES = {2: "SUCCESS", 3: "REDIRECTION", 4: "CLIENT_ERROR", 5: "SERVER_ERROR"}


def install(app: FastAPI) -> None:
    @app.middleware("http")
    async def _record(request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        # The route template ("/api/genai/summarize"), never the concrete path —
        # a path with ids in it would blow up label cardinality.
        route = request.scope.get("route")
        uri = getattr(route, "path", "UNKNOWN")
        status = response.status_code
        _REQUESTS.labels(
            APPLICATION,
            request.method,
            uri,
            str(status),
            _OUTCOMES.get(status // 100, "UNKNOWN"),
        ).observe(time.perf_counter() - started)
        return response

    @app.get("/metrics", include_in_schema=False)
    def metrics() -> Response:
        _UPTIME.labels(APPLICATION, VERSION).set(time.time() - _STARTED_AT)
        _CPU.labels(APPLICATION, VERSION).set(_cpu_usage())
        return Response(generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)
