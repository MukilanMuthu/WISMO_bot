import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

// Authenticate custom-function calls with a separate secret from the Retell management API key.
export function requireRetellFunctionAuth(req: Request, _res: Response, next: NextFunction) {
  const expected = process.env.RETELL_FUNCTION_SECRET;
  const provided = req.headers["x-retell-function-secret"];

  if (!expected || !provided || provided !== expected) {
    next(new Error("UNAUTHORIZED"));
    return;
  }
  next();
}

// Webhook deliveries (call_started/call_ended/call_analyzed) carry no custom header; Retell
// signs them with HMAC-SHA256 over rawBody+timestamp using the account API key instead.
// See https://docs.retellai.com/features/secure-webhook
export function requireRetellWebhookAuth(req: Request, _res: Response, next: NextFunction) {
  const apiKey = process.env.RETELL_API_KEY;
  const rawBody = (req as Request & { rawBody?: string }).rawBody;
  const signatureHeader = req.headers["x-retell-signature"];
  const match = typeof signatureHeader === "string" ? signatureHeader.match(/^v=(\d+),d=(.+)$/) : null;

  if (!apiKey || !rawBody || !match) {
    next(new Error("UNAUTHORIZED"));
    return;
  }

  const [, timestamp, digest] = match;
  const withinFiveMinutes = Math.abs(Date.now() - Number(timestamp)) <= 5 * 60 * 1000;
  const expected = createHmac("sha256", apiKey).update(rawBody + timestamp).digest();
  const provided = Buffer.from(digest, "hex");

  if (!withinFiveMinutes || expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    next(new Error("UNAUTHORIZED"));
    return;
  }
  next();
}

// Normalize Retell call IDs while accepting direct API-test payloads.
export function getRetellCallId(body: Record<string, unknown>) {
  const direct = body.callId;
  const call = typeof body.call === "object" && body.call ? (body.call as Record<string, unknown>) : null;
  const nested = call?.call_id;

  if (typeof direct === "string") return direct;
  if (typeof nested === "string") return nested;
  throw new Error("VALIDATION_ERROR");
}

// Accept Retell's full custom-function envelope while preserving direct endpoint test payloads.
export function getRetellArgs(body: Record<string, unknown>) {
  return typeof body.args === "object" && body.args ? (body.args as Record<string, unknown>) : body;
}
