-- AlterTable
ALTER TABLE "LineItem" ADD COLUMN     "trackingMoreCreated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "trackingMoreCreated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Courier" (
    "id" TEXT NOT NULL,
    "carrierName" TEXT NOT NULL,
    "courierCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Courier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Courier_carrierName_key" ON "Courier"("carrierName");
