// Shared HTTP contract between the Express API (@wismo/api) and the Next.js SPA (@wismo/web).
// Shapes describe JSON over the wire: Prisma Decimal serializes to string, DateTime to ISO string.

export type Role = "CUSTOMER" | "ADMIN";

export type FinancialStatus = "PAID" | "REFUNDED" | "PARTIALLY_REFUNDED";
export type FulfillmentStatus = "UNFULFILLED" | "PARTIALLY_FULFILLED" | "FULFILLED";
export type CallStatus = "CREATED" | "ACTIVE" | "COMPLETED" | "FAILED" | "ESCALATED";
export type TicketStatus = "OPEN" | "RESOLVED";
export type TicketCategory =
  | "TRACKING_PROVIDER_UNAVAILABLE"
  | "LISTING_LIMIT_REACHED"
  | "ORDER_NOT_SHIPPED"
  | "DELIVERY_DELAYED"
  | "ADDRESS_CHANGE"
  | "ADDRESS_CHANGE_MIDSHIP"
  | "DELIVERED_NOT_RECEIVED"
  | "TRACKING_WRONG_DELIVERED"
  | "TRACKING_WRONG_TRANSIT"
  | "ESCALATION_REQUESTED";

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
    ticketNumber: number;
    category: TicketCategory;
    reason: string;
    status: TicketStatus;
    callId: string | null;
    customer: { name: string };
  }>;
  trackingErrors: Array<{
    id: string;
    errorMessage: string | null;
    createdAt: string;
    order: { orderNumber: string };
  }>;
  // Agent-performance story: how often the agent resolves a call on its own, how often it
  // escalates and why, how often the same order comes back, and how long calls run.
  containmentRate: number;
  escalationRate: number;
  ticketsByCategory: Record<string, number>;
  repeatContactRate: number;
  avgCallDurationSeconds: number;
}

// GET /admin/calls/:callId
export interface CallDetailDTO {
  id: string;
  status: CallStatus;
  startedAt: string;
  endedAt: string | null;
  customer: { name: string; email: string };
  order: { orderNumber: string } | null;
  tickets: Array<{
    id: string;
    ticketNumber: number;
    category: TicketCategory;
    reason: string;
    status: TicketStatus;
    createdAt: string;
  }>;
  events: Array<{ id: string; type: string; createdAt: string }>;
  transcript: Array<{ role: "agent" | "user"; content: string }>;
}

// POST /retell/web-call
export interface WebCallResponse {
  accessToken: string;
  callId: string;
}
