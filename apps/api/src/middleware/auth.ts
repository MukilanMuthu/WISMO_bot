import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { User } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";

export type Role = "CUSTOMER" | "ADMIN";

// Express request carrying the verified user once requireUser has run.
export interface AuthedRequest extends Request {
  user: User;
}

// Require a dedicated signing secret so authentication never reuses provider credentials.
function sessionSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET_INVALID");
  return new TextEncoder().encode(secret);
}

// Issue a short-lived identity token after credentials have already been verified.
export async function createSessionToken(user: { id: string; role: Role }) {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(sessionSecret());
}

// Verify the Bearer JWT, reload the user, enforce role, and attach it to the request.
export function requireUser(expectedRole?: Role): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
      if (!token) throw new Error("UNAUTHORIZED");

      const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
      if (!payload.sub || (payload.role !== "CUSTOMER" && payload.role !== "ADMIN")) throw new Error("UNAUTHORIZED");

      const user = await db.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.role !== payload.role) throw new Error("UNAUTHORIZED");
      if (expectedRole && user.role !== expectedRole) throw new Error("FORBIDDEN");

      (req as AuthedRequest).user = user;
      next();
    } catch (error) {
      next(error instanceof Error && error.message === "FORBIDDEN" ? error : new Error("UNAUTHORIZED"));
    }
  };
}
