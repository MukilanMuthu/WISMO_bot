import { Router } from "express";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSessionToken } from "@/middleware/auth";
import { asyncHandler } from "@/middleware/error";

const router = Router();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

// Verify storefront credentials and return one role-aware JWT for the separated frontend to store.
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.safeParse(req.body);
    // Treat bad input and bad credentials identically so the endpoint never reveals which failed.
    if (!input.success) throw new Error("UNAUTHORIZED");

    const user = await db.user.findUnique({ where: { email: input.data.email } });
    const passwordMatches = user ? await compare(input.data.password, user.passwordHash) : false;
    if (!user || !passwordMatches) throw new Error("UNAUTHORIZED");

    const token = await createSessionToken(user);
    res.json({ data: { token, role: user.role } });
  }),
);

// Stateless logout: the client simply drops its bearer token.
router.post("/logout", (_req, res) => {
  res.status(204).end();
});

export default router;
