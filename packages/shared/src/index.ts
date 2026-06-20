// Shared HTTP contract between the Express API (@wismo/api) and the Next.js SPA (@wismo/web).
// Shapes describe JSON over the wire: Prisma Decimal serializes to string, DateTime to ISO string.

export type Role = "CUSTOMER" | "ADMIN";

export type FinancialStatus = "PAID" | "REFUNDED" | "PARTIALLY_REFUNDED";
export type FulfillmentStatus = "UNFULFILLED" | "PARTIALLY_FULFILLED" | "FULFILLED";
export type CallStatus = "CREATED" | "ACTIVE" | "COMPLETED" | "FAILED" | "ESCALATED";
export type TicketStatus = "OPEN" | "RESOLVED";

// Generic success/error envelopes the API always returns.
export interface ApiSuccess<T> {
  data: T;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

// POST /login
export interface LoginResponse {
  token: string;
  role: Role;
}

export interface ShippingAddress {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface LineItemDTO {
  id: string;
  orderId: string;
  name: string;
  sku: string;
  quantity: number;
  carrierName: string;
  trackingId: string;
  trackingUrl: string;
}

// GET /customer/orders and /customer/orders/:orderId
export interface OrderDTO {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  email: string;
  phone: string;
  createdAt: string;
  numItems: number;
  orderTotal: string;
  currency: string;
  financialStatus: FinancialStatus;
  fulfillmentStatus: FulfillmentStatus;
  shippingAddress: ShippingAddress;
  shippingCarrier: string;
  trackingNumber: string;
  trackingUrl: string;
  shippedAt: string | null;
  estimatedDelivery: string | null;
  notes: string | null;
  lineItems: LineItemDTO[];
}

// GET /admin/dashboard
export interface DashboardDTO {
  orderCount: number;
  calls: Array<{
    id: string;
    status: CallStatus;
    startedAt: string;
    customer: { name: string };
    order: { orderNumber: string } | null;
  }>;
  tickets: Array<{
    id: string;
    reason: string;
    status: TicketStatus;
    customer: { name: string };
  }>;
  trackingErrors: Array<{
    id: string;
    errorMessage: string | null;
    createdAt: string;
    order: { orderNumber: string };
  }>;
}

// POST /retell/web-call
export interface WebCallResponse {
  accessToken: string;
  callId: string;
}
