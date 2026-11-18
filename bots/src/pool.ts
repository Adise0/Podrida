// Runs bot decisions in worker threads, so a search (up to about a second for an Expert) never
// blocks the server's event loop. Requests queue up when every worker is busy. A worker that
// crashes or takes far too long is replaced, and its request fails: the caller falls back to
// something simple (the backend has the seat play its automatic move).
//
// size 0 runs decisions on the calling thread instead (tests, scripts).
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { decide } from "./decide";
import type { BotDecision, BotRequest } from "./view";

export interface BotPoolOptions {
  size: number;
  timeoutMs?: number; // Per request, from when a worker takes it. Default 5 s.
  workerPath?: string; // Default: worker.js next to this file (dist/).
}

interface Job {
  id: number;
  request: BotRequest;
  resolve: (decision: BotDecision) => void;
  reject: (error: Error) => void;
}

interface Slot {
  worker: Worker;
  job: Job | null;
  timer?: NodeJS.Timeout;
}

export class BotPool {
  private readonly slots: Slot[] = [];
  private readonly queue: Job[] = [];
  private nextId = 1;
  private closed = false;
  private readonly timeoutMs: number;
  private readonly workerPath: string;

  constructor(private readonly options: BotPoolOptions) {
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.workerPath = options.workerPath ?? join(__dirname, "worker.js");
    for (let index = 0; index < options.size; index++) this.slots.push(this.spawn());
  }

  get size() {
    return this.slots.length;
  }

  get pending() {
    return this.queue.length + this.slots.filter((slot) => slot.job).length;
  }

  decide(request: BotRequest): Promise<BotDecision> {
    if (this.closed) return Promise.reject(new Error("The bot pool is closed"));

    if (this.slots.length === 0) {
      // On this thread, but still asynchronous like the workers.
      return new Promise((resolve, reject) => {
        setImmediate(() => {
          try {
            resolve(decide(request));
          } catch (error) {
            reject(error as Error);
          }
        });
      });
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, request, resolve, reject });
      this.dispatch();
    });
  }

  async close() {
    this.closed = true;
    this.queue.splice(0).forEach((job) => job.reject(new Error("The bot pool is closed")));
    await Promise.all(
      this.slots.splice(0).map((slot) => {
        clearTimeout(slot.timer);
        slot.job?.reject(new Error("The bot pool is closed"));
        return slot.worker.terminate();
      }),
    );
  }

  private spawn(): Slot {
    const worker = new Worker(this.workerPath);
    worker.unref(); // Never what keeps the process alive.
    const slot: Slot = { worker, job: null };

    worker.on("message", (message: { id: number; decision?: BotDecision; error?: string }) => {
      const { job } = slot;
      if (!job || job.id !== message.id) return;
      clearTimeout(slot.timer);
      slot.job = null;
      if (message.decision) job.resolve(message.decision);
      else job.reject(new Error(message.error ?? "The bot failed"));
      this.dispatch();
    });

    const replace = (reason: string) => {
      clearTimeout(slot.timer);
      slot.job?.reject(new Error(reason));
      slot.job = null;
      const index = this.slots.indexOf(slot);
      if (index !== -1 && !this.closed) {
        this.slots[index] = this.spawn();
        this.dispatch();
      }
    };

    worker.on("error", (error: Error) => replace(`A bot worker crashed: ${error.message}`));
    worker.on("exit", (code) => {
      if (!this.closed && this.slots.includes(slot)) replace(`A bot worker exited (${code})`);
    });

    return slot;
  }

  private dispatch() {
    this.slots.forEach((slot) => {
      if (slot.job || this.queue.length === 0) return;
      const job = this.queue.shift() as Job;
      slot.job = job;
      slot.timer = setTimeout(() => {
        // Stuck: drop the worker, start a fresh one.
        const stuck = slot.job;
        slot.job = null;
        stuck?.reject(new Error("A bot took too long to decide"));
        const index = this.slots.indexOf(slot);
        slot.worker.terminate();
        if (index !== -1 && !this.closed) {
          this.slots[index] = this.spawn();
          this.dispatch();
        }
      }, this.timeoutMs);
      slot.timer.unref();
      slot.worker.postMessage({ id: job.id, request: job.request });
    });
  }
}
