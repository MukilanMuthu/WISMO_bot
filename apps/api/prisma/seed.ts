import { FinancialStatus, FulfillmentStatus, PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

// Seed demo customers, admin, and orders.
async function main() {
  await prisma.trackingLookupLog.deleteMany();
  await prisma.voiceCallEvent.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.voiceCall.deleteMany();
  await prisma.lineItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.user.deleteMany();
  await prisma.courier.deleteMany();

  // One password for all demo accounts.
  const passwordHash = await hash("WismoDemo!2026", 12);

  // Given details.
  const fixtures = [
    {
      customer: { id: "customer-dylan-delannoy", name: "Dylan Delannoy", email: "dylan.delannoy@example.com", phone: "+61477118384" },
      order: { id: "order-21505", number: "#21505", trackingId: "G20216581231", carrierName: "YTO Global", createdAt: "2026-06-05T09:30:00.000Z", city: "Hoppers Crossing", region: "VIC", postalCode: "3029", total: 129.95 },
      items: [
        { name: "Everyday Backpack", sku: "BAG-21505", quantity: 1 },
        { name: "Travel Bottle", sku: "BOT-21505", quantity: 1 },
      ],
      notes: null,
    },
    {
      customer: { id: "customer-nick-greaves", name: "Nicholas (Nick) Greaves", email: "nick.greaves@example.com", phone: "+61457485866" },
      order: { id: "order-21509", number: "#21509", trackingId: "34YEK857516701000910909", carrierName: "Australia Post", createdAt: "2026-06-06T10:15:00.000Z", city: "Diamond Creek", region: "VIC", postalCode: "3089", total: 84.5 },
      items: [
        { name: "Canvas Weekender", sku: "BAG-21509", quantity: 1 },
        { name: "Cable Organizer", sku: "ORG-21509", quantity: 2 },
      ],
      notes: "The parcel may be left in a safe place if nobody is home.",
    },
    {
      customer: { id: "customer-joel-hastings", name: "Joel Hastings", email: "joel.hastings@example.com", phone: "+61422214779" },
      order: { id: "order-21511", number: "#21511", trackingId: "6060626349451", carrierName: "iMile", createdAt: "2026-06-07T08:45:00.000Z", city: "Bunyip", region: "VIC", postalCode: "3815", total: 159 },
      items: [
        { name: "Studio Headphones", sku: "AUD-21511", quantity: 1 },
        { name: "Headphone Stand", sku: "STD-21511", quantity: 1 },
      ],
      notes: null,
    },
    {
      customer: { id: "customer-adrian-harris", name: "Adrian Harris", email: "adrian.harris@example.com", phone: "+61447379418" },
      order: { id: "order-21515", number: "#21515", trackingId: "34YEK858511601000910904", carrierName: "Australia Post", createdAt: "2026-06-08T11:00:00.000Z", city: "Portland", region: "VIC", postalCode: "3305", total: 112.75 },
      items: [
        { name: "Merino Throw", sku: "HOM-21515", quantity: 1 },
        { name: "Scented Candle", sku: "CAN-21515", quantity: 2 },
      ],
      notes: "Collection may be required from the local post office.",
    },
  ] as const;

  // Create one login and one owned order per customer.
  for (const fixture of fixtures) {
    const customer = await prisma.user.create({ data: { ...fixture.customer, passwordHash, role: UserRole.CUSTOMER } });
    const trackingUrl = `https://www.trackingmore.com/track/en/${fixture.order.trackingId}`;
    const createdAt = new Date(fixture.order.createdAt);
    const numItems = fixture.items.reduce((total, item) => total + item.quantity, 0);

    await prisma.order.create({
      data: {
        id: fixture.order.id,
        orderNumber: fixture.order.number,
        customerId: customer.id,
        customerName: customer.name,
        email: customer.email,
        phone: customer.phone,
        createdAt,
        numItems,
        orderTotal: fixture.order.total,
        currency: "AUD",
        financialStatus: FinancialStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.FULFILLED,
        shippingAddress: { line1: "18 Example Street", city: fixture.order.city, region: fixture.order.region, postalCode: fixture.order.postalCode, country: "AU" },
        shippingCarrier: fixture.order.carrierName,
        trackingNumber: fixture.order.trackingId,
        trackingUrl,
        trackingMoreCreated: true,
        shippedAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
        estimatedDelivery: new Date(createdAt.getTime() + 10 * 24 * 60 * 60 * 1000),
        notes: fixture.notes,
        lineItems: {
          create: fixture.items.map((item) => ({ ...item, carrierName: fixture.order.carrierName, trackingId: fixture.order.trackingId, trackingUrl })),
        },
      },
    });
  }

  // Use the same credential flow for administrator and customer roles.
  await prisma.user.create({
    data: {
      id: "admin-demo",
      name: "Operations Admin",
      email: "admin@example.com",
      phone: "+61400000999",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });
}

// Always close Prisma connections after seeding, including failure paths.
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
