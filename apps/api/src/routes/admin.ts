import { Router } from "express";
import { getCallDetail, getDashboardData } from "@/lib/dashboard";
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

// Full drill-in for a single call: header, tickets, events, reconstructed transcript.
router.get(
  "/calls/:callId",
  requireUser("ADMIN"),
  asyncHandler(async (req, res) => {
    const call = await getCallDetail(req.params.callId);
    if (!call) throw new Error("NOT_FOUND");
    res.json({ data: call });
  }),
);

export default router;
