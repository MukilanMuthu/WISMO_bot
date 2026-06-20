import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fixed test callIds, one per seeded customer, so /retell/functions/* can be exercised
// directly in Hoppscotch without spending money on a real Retell call.
const TEST_CALLS = [
  { retellCallId: "test-call-dylan-delannoy", customerId: "customer-dylan-delannoy" },
  { retellCallId: "test-call-nick-greaves", customerId: "customer-nick-greaves" },
  { retellCallId: "test-call-joel-hastings", customerId: "customer-joel-hastings" },
  { retellCallId: "test-call-adrian-harris", customerId: "customer-adrian-harris" },
] as const;

async function main() {
  for (const { retellCallId, customerId } of TEST_CALLS) {
    await prisma.voiceCall.upsert({
      where: { retellCallId },
      create: { retellCallId, customerId, status: "ACTIVE" },
      update: { customerId, status: "ACTIVE" },
    });
    console.log(`${retellCallId} -> ${customerId}`);
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
