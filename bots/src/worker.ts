// A worker thread of the BotPool: answers decision requests, one at a time.
import { parentPort } from "node:worker_threads";
import { decide } from "./decide";
import type { BotRequest } from "./view";

parentPort?.on("message", ({ id, request }: { id: number; request: BotRequest }) => {
  try {
    parentPort?.postMessage({ id, decision: decide(request) });
  } catch (error) {
    parentPort?.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});
