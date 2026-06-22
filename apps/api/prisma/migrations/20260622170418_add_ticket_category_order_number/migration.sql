/*
  Warnings:

  - Added the required column `category` to the `SupportTicket` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('TRACKING_PROVIDER_UNAVAILABLE', 'LISTING_LIMIT_REACHED', 'ORDER_NOT_SHIPPED', 'DELIVERY_DELAYED', 'ADDRESS_CHANGE', 'ADDRESS_CHANGE_MIDSHIP', 'DELIVERED_NOT_RECEIVED', 'TRACKING_WRONG_DELIVERED', 'TRACKING_WRONG_TRANSIT', 'ESCALATION_REQUESTED');

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "category" "TicketCategory",
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "ticketNumber" SERIAL NOT NULL;

-- Backfill pre-existing tickets (created before category existed)
UPDATE "SupportTicket" SET "category" = 'ESCALATION_REQUESTED' WHERE "category" IS NULL;

ALTER TABLE "SupportTicket" ALTER COLUMN "category" SET NOT NULL;

-- CreateIndex
CREATE INDEX "SupportTicket_category_customerId_orderId_status_idx" ON "SupportTicket"("category", "customerId", "orderId", "status");

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
