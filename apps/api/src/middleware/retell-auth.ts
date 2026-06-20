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
