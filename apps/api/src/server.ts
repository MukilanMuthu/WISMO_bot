import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "@/routes/auth";
import customerRoutes from "@/routes/customer";
import adminRoutes from "@/routes/admin";
import retellRoutes from "@/routes/retell";
import { errorHandler } from "@/middleware/error";

const app = express();

// Allow the separated Next.js frontend to call the API; Bearer auth means no cross-site cookies.
app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json({ verify: (req, _res, buf) => { (req as typeof req & { rawBody?: string }).rawBody = buf.toString("utf-8"); } }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/", authRoutes); // POST /login, POST /logout
app.use("/customer", customerRoutes);
app.use("/admin", adminRoutes);
app.use("/retell", retellRoutes);

// Central error envelope must be registered after all routes.
app.use(errorHandler);

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`WISMO API listening on http://localhost:${port}`);
});
