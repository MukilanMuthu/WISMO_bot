# Customer Support Conversation Flows

Source: `Drawing 2026-06-22 12.33.25.excalidraw.png`

## Request to change delivery address

<!-- Recreate the payment, shipment, verification, and support-ticket branches from the drawing. -->

```mermaid
flowchart TD
    A([Request to change delivery address]) --> B[Check payment status]

    B --> C[Unpaid / partially paid]
    C --> C1[Tell customer to complete payment]
    C1 --> Z1[Anything else?]

    B --> D[Refunded / partially refunded]
    D --> D1[Tell customer refunded order details cannot be changed]
    D1 --> E1[End call]

    B --> E[Paid]
    E --> F{Check shipped_at}

    F -- "shipped_at === NULL" --> G[Ask for customer details to verify:<br/>email ID and phone number]
    F -- "shipped_at !== NULL" --> H[Ask for customer details to verify:<br/>email ID and phone number]

    G --> G1[Verified]
    G --> G2[Not verified:<br/>retry, allow 2 retries]
    G2 --> G
    G2 --> G3[Tell the customer that they are unauthorized<br/>to do this action]
    G3 --> E2[End call]

    G1 --> G4[Ask address from the customer and create a<br/>support ticket - low priority. Tell the customer<br/>that a ticket has been created, tell the ticket ID.<br/>The address will be updated shortly]
    G4 --> Z2[Anything else?]

    H --> H1[Verified]
    H --> H2[Not verified:<br/>retry, allow 2 retries]
    H2 --> H
    H2 --> H3[Tell the customer that they are unauthorized<br/>to do this action]
    H3 --> E3[End call]

    H1 --> H4[Ask address from the customer and create a<br/>support ticket - medium priority for changing<br/>shipping address midway. Tell the customer that a<br/>ticket has been created, tell the ticket ID.<br/>Tell them that updating the address midway through<br/>shipping may end up with higher costs]
    H4 --> Z3[Anything else?]
```

## Customer asks for tracking status

<!-- Recreate the tracking flow and its state-variable updates from the drawing. -->

```mermaid
flowchart TD
    N1((Upon call create variables:<br/>tracking_requested = false<br/>paid<br/>shipped<br/>shipped_late<br/>delivered<br/>delivered_late<br/>apology))
    N2((A call only gets 2<br/>Anything else? After<br/>that the call should end))
    N3((When apology is true, end<br/>call should also apologize<br/>for the inconvenience))

    A([Customer asks for tracking status]) --> B((tracking_requested = true))
    B --> C{Check fulfillmentStatus}

    C -- Blank --> D[Check payment]
    C -- Success --> K[Ask TrackingMore API]

    D --> E[Unpaid / partially paid]
    E --> E1[Tell customers unpaid / partially paid orders<br/>will not be shipped. Ask them to complete<br/>the payment]
    E1 --> E2((paid = false))
    E2 --> Z1[Anything else?]

    D --> F[Refunded / partially refunded]
    F --> F1[Tell customer refunded orders cannot be shipped]
    F1 --> X1[End call]

    D --> G[Paid]
    G --> H[Order not shipped<br/>shipped_at === NULL]
    G --> J[Order shipped<br/>shipped_at !== NULL]
    J --> K

    H --> H1{Compare today with estimated_delivery}
    H1 -- "today < estimated_delivery" --> H2[Tell customer that the order is expected to be<br/>shipped soon and it is within estimated delivery time]
    H2 --> H3((paid = true<br/>shipped = false<br/>shipped_late = false<br/>delivered = false<br/>delivered_late = false<br/>tracking = false))
    H3 --> Z2[Anything else?]

    H1 -- "today >= estimated_delivery" --> H4[Create a support ticket - high priority, stating<br/>order has not been shipped. Apologize for the delay.<br/>Tell the customer there has been some issue with<br/>shipping, a support ticket has been created and an<br/>agent will call shortly. Provide the ticket ID]
    H4 --> H5{Apology = true}
    H5 --> H6((paid = true<br/>shipped = false<br/>shipped_late = true<br/>delivered = false<br/>delivered_late = false<br/>tracking = false))
    H6 --> Z3[Anything else?]

    K --> L{Compare today with estimated_delivery}

    L -- "today <= estimated_delivery" --> M[No tracking status available<br/>latest_event === null]
    L -- "today <= estimated_delivery" --> N[Tracking status available<br/>latest_event !== null]
    M --> M1[Tell customer that the order is expected to be<br/>shipped soon and it is within estimated delivery time]
    M1 --> M2((paid = true<br/>shipped = true<br/>delivered = false<br/>delivered_late = false<br/>tracking = false))
    M2 --> Z4[Anything else?]
    N --> N4[Provide the latest_event information]
    N4 --> N5((paid = true<br/>shipped = true<br/>delivered = false<br/>delivered_late = false<br/>tracking = true))
    N5 --> Z5[Anything else?]

    L -- "today > estimated_delivery" --> P[No tracking status available<br/>latest_event === null]
    L -- "today > estimated_delivery" --> Q[Tracking status available<br/>latest_event !== null]

    P --> P1[Create a support ticket stating delivery delayed<br/>and tracking status is not available. Apologize for<br/>the delay. Tell the customer there has been some<br/>issue with the courier, since it has not created<br/>online updates as well. Provide the ticket ID]
    P1 --> P2{Apology = true}
    P2 --> P3((paid = true<br/>shipped = true<br/>delivered = false<br/>delivered_late = false<br/>tracking = false))
    P3 --> Z6[Anything else?]

    Q --> Q1{delivery_status}
    Q1 -- "delivery_status !== delivered" --> Q2[Provide the latest_event information]
    Q2 --> Q3((paid = true<br/>shipped = true<br/>delivered = false<br/>delivered_late = false<br/>tracking = true))
    Q3 --> Z7[Anything else?]

    Q1 -- "delivery_status === delivered" --> Q4[Apologize for the delay.<br/>Provide the latest_event information]
    Q4 --> Q5{Apology = true}
    Q5 --> Q6((paid = true<br/>shipped = true<br/>delivered = true<br/>delivered_late = true<br/>tracking = true))
    Q6 --> Z8[Anything else?]

    N1 ~~~ N2
    N2 ~~~ N3
    N1 ~~~ A
```

## Customer states order has not been delivered

<!-- Recreate the tracking-requested and shipment-search branches from the drawing. -->

```mermaid
flowchart TD
    A([Customer states order has not been delivered])

    A --> B[If tracking_requested is false]
    B --> B1[Initiate customer asks for tracking status]

    A --> C[If tracking_requested is true]
    C --> D((If delivered = true))
    D --> E[Check notes regarding delivery info]

    E --> F[If info present, ask question regarding info<br/>to check with that info for delivery]
    E --> G[If info absent, ask to check neighbours,<br/>flatmates, any security cam nearby]

    F --> H[If shipment found]
    H --> Z1[Anything else?]
    G --> I[If shipment found]
    I --> Z2[Anything else?]

    F --> J[If shipment still not found]
    G --> J
    J --> K[Create a support ticket for package not delivered<br/>even though tracking stated delivered - high priority.<br/>Apologize to the customer. Tell the customer that a<br/>support ticket has been created and an agent will<br/>assist them in a call back. Tell them their support ID]
    K --> L{Apology = true}
    L --> Z3[Anything else?]
```

## Customer states tracking address or tracking info is wrong

<!-- Recreate the confirmation and priority branches from the drawing. -->

```mermaid
flowchart TD
    A([Customer states that the tracking address is<br/>wrong / tracking info is wrong])
    A --> B[State the tracking info of last_event and<br/>last checkpoint time again to confirm]

    B --> C[If customer confirms wrong]
    B --> D[If customer does not confirm it]
    D --> Z1[Anything else?]

    C --> E{Check delivery_status}
    E -- "delivery_status === delivered" --> F[Create a support ticket - high priority.<br/>Apologize to the customer, tell that a support ticket<br/>has been created, tell the support ID to them.<br/>Also state that an agent will contact shortly<br/>and this issue will be handled urgently]
    F --> F1{Apology = true}
    F1 --> Z2[Anything else?]

    E -- "delivery_status !== delivered" --> G[Create a support ticket - moderate priority.<br/>Apologize to the customer, tell that a support ticket<br/>has been created, tell the support ID to them.<br/>Also state that an agent will contact shortly]
    G --> G1{Apology = true}
    G1 --> Z3[Anything else?]
```
