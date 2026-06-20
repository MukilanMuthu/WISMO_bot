-- Add password hashes for storefront credential verification; seed replaces existing POC users.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP DEFAULT;

-- Replace JSON items with relational parcel-aware line items; seed recreates existing POC orders.
ALTER TABLE "Order" DROP COLUMN "lineItems";

CREATE TABLE "LineItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "carrierName" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "trackingUrl" TEXT NOT NULL,

    CONSTRAINT "LineItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LineItem_orderId_idx" ON "LineItem"("orderId");

ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
