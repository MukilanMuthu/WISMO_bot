import { Router } from "express";
import { db } from "@/lib/db";
import { requireUser, type AuthedRequest } from "@/middleware/auth";
import { asyncHandler } from "@/middleware/error";

const router = Router();

// List only orders owned by the authenticated customer.
router.get(
  "/orders",
  requireUser("CUSTOMER"),
  asyncHandler(async (req, res) => {
    const customer = (req as AuthedRequest).user;
    const orders = await db.order.findMany({
      where: { customerId: customer.id },
      include: { lineItems: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: orders });
  }),
);

// Read one order through a compound ownership check to prevent cross-customer access.
router.get(
  "/orders/:orderId",
  requireUser("CUSTOMER"),
  asyncHandler(async (req, res) => {
    const customer = (req as AuthedRequest).user;
    const order = await db.order.findFirst({
      where: { id: req.params.orderId, customerId: customer.id },
      include: { lineItems: true },
    });
    if (!order) throw new Error("NOT_FOUND");
    res.json({ data: order });
  }),
);

export default router;
