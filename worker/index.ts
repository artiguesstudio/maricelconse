/** Cloudflare Worker entry point for the Vinext application. */
import handler from "vinext/server/app-router-entry";
import { reconcileMercadoPagoState } from "../lib/mercadopago/reconcile";

interface Env {
  ASSETS: Fetcher;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ScheduledController {
  cron: string;
  scheduledTime: number;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handler.fetch(request, env, ctx);
  },
  async scheduled(_controller: ScheduledController, _env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      reconcileMercadoPagoState()
        .then((summary) => console.log("Reconciliación de Mercado Pago completada", summary))
        .catch((error) => console.error("Falló la reconciliación de Mercado Pago", error)),
    );
  },
};

export default worker;
