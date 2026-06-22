import { PrismaClient, TicketCategory, TicketStatus } from "@prisma/client";

const prisma = new PrismaClient();

// Reuses the demo customers/orders from seed.ts. Run seed.ts first.
const TICKETS = [
  { id: "ticket-seed-1", customerId: "customer-dylan-delannoy", orderId: "order-21505", callId: "test-call-dylan-delannoy", category: TicketCategory.DELIVERED_NOT_RECEIVED, reason: "Customer says the parcel shows delivered but never arrived.", status: TicketStatus.OPEN },
  { id: "ticket-seed-2", customerId: "customer-nick-greaves", orderId: "order-21509", callId: "test-call-nick-greaves", category: TicketCategory.DELIVERY_DELAYED, reason: "Tracking hasn't moved in 6 days, customer wants an update.", status: TicketStatus.OPEN },
  { id: "ticket-seed-3", customerId: "customer-joel-hastings", orderId: "order-21511", callId: null, category: TicketCategory.ADDRESS_CHANGE, reason: "Customer requested delivery address change before dispatch.", status: TicketStatus.RESOLVED },
  { id: "ticket-seed-4", customerId: "customer-adrian-harris", orderId: "order-21515", callId: "test-call-adrian-harris", category: TicketCategory.TRACKING_PROVIDER_UNAVAILABLE, reason: "Carrier tracking page returning an error for this shipment.", status: TicketStatus.OPEN },
  { id: "ticket-seed-5", customerId: "customer-dylan-delannoy", orderId: null, callId: null, category: TicketCategory.ESCALATION_REQUESTED, reason: "Customer asked to speak to a human agent.", status: TicketStatus.RESOLVED },
] as const;

async function main() {
  for (const t of TICKETS) {
    const call = t.callId ? await prisma.voiceCall.findUnique({ where: { retellCallId: t.callId } }) : null;
    if (t.callId && !call) throw new Error(`${t.callId} not found — run seed-test-calls.ts first`);
    const data = { ...t, callId: call?.id ?? null };
    await prisma.supportTicket.upsert({ where: { id: t.id }, create: data, update: data });
    console.log(`${t.id} -> ${t.category} (${t.status})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
