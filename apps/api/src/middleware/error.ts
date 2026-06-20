import type { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodError } from "zod";

// Forward rejected promises from async handlers into Express's error pipeline.
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Return one stable error envelope across UI and Retell endpoints (ported from the former lib/http.ts).
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request", details: error.flatten() } });
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : message === "NOT_FOUND" ? 404 : 500;
  res.status(status).json({ error: { code: message, message } });
}
