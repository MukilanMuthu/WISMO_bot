# WISMO

WISMO helps an authenticated store customer obtain current shipment information for orders they own.

## Language

**Customer**:
A store user who owns orders and may request shipment information for those orders.
_Avoid_: Buyer, client

**Order**:
A customer's purchase record. It retains required order-level shipment details even when its line items provide more specific split-shipment tracking.
_Avoid_: Main table, purchase

**Line Item**:
An ordered product and quantity belonging to one Order. Its quantity is fulfilled in at most one parcel in this POC.
_Avoid_: Item record, product row

**Split Shipment**:
An Order whose Line Items contain more than one distinct tracking ID. Line Item tracking is authoritative for this Order, and the Order notes explicitly identify the split shipment.
_Avoid_: Partial shipment

**Tracking ID**:
The carrier identifier submitted to TrackingMore to retrieve live shipment status.
_Avoid_: Tracking code

**Order Note**:
Customer-safe additional information attached to an Order that may be conveyed through the voice agent.
_Avoid_: Internal note, staff note
