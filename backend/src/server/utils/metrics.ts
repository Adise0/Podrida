import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from "prom-client";

// Everything GET /metrics exposes, in Prometheus format. A registry of our own (instead of the
// library's global one) so nothing else in the process can add to it by accident.
export const metricsRegistry = new Registry();

// Process stats: CPU, memory, event loop lag, garbage collection, open handles...
collectDefaultMetrics({ register: metricsRegistry });

// Request rate, error rate and latency per route. The route is the pattern (eg.
// /admin/users/:userId), never the real URL, so ids and tokens don't turn into labels.
export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

// Emails are sent after the response for most endpoints, so their failures never show up as a
// status code. This is the only place they're counted.
export const emailsSent = new Counter({
  name: "emails_sent_total",
  help: "Emails handed to the SMTP server, by result",
  labelNames: ["result"] as const,
  registers: [metricsRegistry],
});

// Realtime requests, by type (the request type, never anything from the payload) and result (ok,
// or the error code).
export const realtimeRequestDuration = new Histogram({
  name: "realtime_request_duration_seconds",
  help: "Realtime (WebSocket) request duration in seconds",
  labelNames: ["type", "result"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

// Read when /metrics is scraped. Whoever owns the numbers sets the readers (see realtime/).
export const liveCounts = {
  connections: () => 0,
  rooms: () => 0,
  games: () => 0,
};

// eslint-disable-next-line no-new
new Gauge({
  name: "realtime_live",
  help: "Open realtime connections, lobby rooms and live games",
  labelNames: ["kind"] as const,
  registers: [metricsRegistry],
  collect() {
    Object.entries(liveCounts).forEach(([kind, read]) => this.set({ kind }, read()));
  },
});
