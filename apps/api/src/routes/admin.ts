import { Router } from "express";
import { getDashboardData } from "@/lib/dashboard";
import { requireUser } from "@/middleware/auth";
import { asyncHandler } from "@/middleware/error";

const router = Router();

// Aggregate operational data for the seeded admin dashboard.
router.get(
  "/dashboard",
  requireUser("ADMIN"),
  asyncHandler(async (_req, res) => {
    res.json({ data: await getDashboardData() });
  }),
);

export default router;
