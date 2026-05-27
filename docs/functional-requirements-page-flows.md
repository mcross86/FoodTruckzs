# foodtruckzs Functional Requirements and Page Flows

Document ID: FRD-001

Status: Proposed

Sources:

- `docs/product-requirements-document.md`
- `docs/architecture-design-document.md`
- `docs/technical-design-document.md`

## 1. Product Framing

foodtruckzs is first and foremost an operator platform for food truck caterers. The marketplace gives customers a better way to discover amazing chefs, but the core product value is the workflow infrastructure that helps food truck operators turn catering interest into clean quotes, signed agreements, scheduled events, and paid bookings.

The customer experience should feel simple and guided. The vendor experience should feel operationally useful, not like another inbox. Every customer-facing question in the RFQ should exist because it helps the operator make a real catering decision: Can we do this event? What will it cost? What staffing or prep is required? Are there truck access issues? Is there enough service time? What equipment is needed? Is the date profitable enough to hold?

The functional requirements in this document are organized page by page. Each page defines the user goal, required capabilities, input requirements, validations, state behavior, and operator-first considerations.

## 2. Product Principles

### Operator-First, Customer-Friendly

The platform should protect the food truck operator's time while giving customers a better planning experience. Customers should not be forced to know catering terminology, but the system must still collect the information operators need to quote accurately.

### RFQs Should Prevent Bad Leads

A weak RFQ creates work for the operator. A strong RFQ gives enough event, food, site, budget, and timing detail for the vendor to decide whether to accept, decline, clarify, or quote.

### Quotes Are Operational Documents

Quotes are not just prices. They are working plans that define menu, service model, guest count assumptions, staffing, travel, equipment, taxes, fees, deposit, payment timing, and policies.

### Confirmed Events Must Become Calendar Operations

Once agreement and deposit are complete, the booking should become an operational event with reminders, prep notes, staffing notes, equipment checklists, and conflict warnings.

### Monetization Should Not Interfere With Caterer Cash Flow

foodtruckzs monetization should be tracked as a separate platform billing workflow. The customer pays required down payments or future event invoices to the caterer through in-app payment support. foodtruckzs charges the catering company a configurable percentage of signed agreement value and invoices the catering company separately.

### Customers Access Chefs, Operators Control Their Business

Customers should discover and request great food truck catering. Vendors should control availability, pricing, minimums, menus, travel radius, deposits, policies, and final booking acceptance.

## 3. Primary User Journeys

### Customer Journey

1. Customer lands on marketplace.
2. Customer searches by location, cuisine, event size, and service style.
3. Customer views vendor profile and sample menus.
4. Customer starts RFQ for one vendor or a general marketplace request.
5. Customer completes guided RFQ steps.
6. Customer submits request.
7. Vendor accepts, declines, or asks clarifying questions.
8. Vendor sends quote.
9. Customer reviews quote and negotiates if needed.
10. Customer accepts quote.
11. Customer reviews and signs agreement.
12. Customer pays deposit.
13. Booking is confirmed.
14. Customer receives event reminders and final balance notices.

### Vendor Journey

1. Vendor signs up and completes operator profile.
2. Vendor defines service areas, menus, minimums, availability, deposit settings, and policies.
3. Vendor receives structured RFQs.
4. Vendor reviews event fit, logistics, timing, budget, and site requirements.
5. Vendor accepts, declines, or requests clarification.
6. Vendor builds quote using menu packages and line items.
7. Vendor sends quote and negotiates revisions.
8. Vendor receives accepted quote notification.
9. Vendor reviews generated agreement.
10. Customer signs and pays deposit.
11. Confirmed event appears on vendor calendar.
12. foodtruckzs creates the platform agreement fee record for later caterer invoicing.
13. Vendor manages prep, staffing, equipment, arrival, service, and payment status.

### Admin Journey

1. Admin reviews vendor applications.
2. Admin approves marketplace visibility.
3. Admin monitors disputes, payments, refunds, and payouts.
4. Admin moderates marketplace content.
5. Admin reviews platform analytics.

## 4. Customer-Facing Pages

### Page 1: Public Landing Page

Purpose: Introduce foodtruckzs as a food truck catering marketplace and drive customers into vendor discovery or RFQ creation.

Primary users:

- Consumer customers.
- Corporate customers.
- Event planners.

Functional requirements:

- Show clear positioning: food truck catering for private, corporate, and community events.
- Provide primary search entry by location, cuisine, event date, and guest count.
- Provide secondary CTA to "Request catering quotes".
- Explain that requests go to real food truck operators for quote review.
- Feature cuisines, service styles, and example event types.
- Feature operator credibility: verified food trucks, catering-ready vendors, digital agreements, deposit payments.
- Link vendors to "List your food truck" onboarding.

Required inputs:

- Event location or metro area.
- Optional cuisine.
- Optional event date.
- Optional guest count.

Validation:

- Location search must resolve to a supported metro or allow waitlist capture.
- Guest count must be positive if entered.

Operator-first considerations:

- Do not promise instant booking unless vendor explicitly supports it in the future.
- Do not imply every vendor is available before RFQ or availability check.
- Set customer expectation that quotes depend on event details, service model, and site logistics.

### Page 2: Marketplace Search and Discovery

Purpose: Let customers discover food truck caterers while filtering by criteria that matter to both customers and operators.

Primary users:

- Customers researching vendor options.
- Customers ready to request quotes.

Functional requirements:

- Display vendor cards with name, cuisine, service area, profile image, sample pricing range, catering minimum, service styles, and availability indicator when available.
- Support filters for cuisine, location, service style, event size, budget range, dietary accommodations, dessert availability, onsite cooking, buffet service, alcohol service, and equipment rentals.
- Support sorting by relevance, rating, response time, newest, and distance when location data exists.
- Show "Request Quote" CTA on each vendor card.
- Allow selecting multiple vendors for RFQ targeting.
- Show educational helper text explaining that final quote depends on menu, headcount, travel, staffing, and venue setup.

Required filter inputs:

- Location or service metro.
- Event date if checking availability.
- Estimated headcount if filtering by capacity or minimums.

Validation:

- Budget range minimum cannot exceed maximum.
- Event date cannot be in the past.
- Guest count must be positive.

Operator-first considerations:

- Vendor cards should show catering minimums early to reduce poor-fit requests.
- Vendors should not appear for service areas they do not cover.
- "Available" should mean "no known block", not guaranteed until vendor accepts.
- Search should favor vendors who are approved, published, responsive, and fit the customer's event.

### Page 3: Vendor Profile Page

Purpose: Present a food truck caterer's public catering profile and convert qualified customers into RFQs.

Primary users:

- Customers evaluating a vendor.
- Corporate event planners.

Functional requirements:

- Show vendor brand, description, cuisine categories, food photography, service regions, catering minimum, service styles, menu previews, dietary accommodations, operating hours, and policies summary.
- Show sample packages or menu examples without forcing vendors to publish exact custom pricing.
- Show event types served, such as weddings, office lunches, festivals, private parties, and neighborhood events.
- Show service model options supported by the vendor: truck onsite, buffet, prepaid meals, pay-per-guest, boxed meals, dessert service, beverage service.
- Show vendor requirements such as parking, generator use, power, space, travel limits, minimum lead time, and deposit expectations.
- Provide CTA to request a quote from this vendor.
- Provide option to ask a pre-RFQ question only if the platform supports inquiry workflow; otherwise direct customers to RFQ.

Input requirements:

- RFQ CTA should prefill selected vendor.
- If customer enters event date/headcount on profile, carry those values into RFQ.

Validation:

- Hide unpublished menus.
- Hide vendors not approved or suspended.

Operator-first considerations:

- Vendor profile should communicate operational requirements before customers submit.
- Profile should help customers self-qualify based on minimums, travel area, and service type.
- Vendor should control which menus and photos are public.

### Page 4: RFQ Start Page

Purpose: Begin a structured catering request and set expectations for the customer.

Primary users:

- Customers requesting catering.

Functional requirements:

- Let customer choose request type:
  - Request quote from a selected vendor.
  - Request quote from multiple selected vendors.
  - Submit general RFQ to matching vendors.
- Explain what information will be needed: event basics, venue logistics, food preferences, service style, guest count, equipment needs, budget, and timeline.
- Show progress indicator for RFQ steps.
- Allow save-and-continue for logged-in users.
- Encourage account creation before submission, not necessarily before starting.

Required inputs:

- Request type.
- Selected vendor IDs if requesting specific vendors.

Validation:

- Specific vendor RFQ must include at least one active vendor.
- General RFQ must include location and event type before matching.

Operator-first considerations:

- Start page should explain that incomplete logistics may delay quote response.
- Customers should understand they are requesting a catering quote, not placing a food delivery order.

## 5. RFQ Process Pages and Input Standards

The RFQ is the most important customer-facing workflow because it determines lead quality for operators. It should use progressive disclosure: customers answer simple questions first, then deeper logistics questions only when relevant.

### Page 5: RFQ Event Basics

Purpose: Capture the minimum event context needed to determine whether the event is viable.

Required fields:

- Event name.
- Event type.
- Event date.
- Start time.
- End time.
- Customer timezone or event timezone.
- Estimated headcount.
- Customer type: individual, company, planner, nonprofit, school, venue, municipality.
- Primary contact name.
- Primary contact email.
- Primary contact phone.

Event type options:

- Wedding.
- Birthday.
- Graduation.
- Corporate lunch.
- Employee appreciation.
- Office catering.
- Conference.
- Festival.
- Community event.
- School event.
- Private party.
- Neighborhood event.
- Late-night event.
- Other.

Optional fields:

- Event website or invitation link.
- Expected age mix: adults, children, mixed.
- Is this event open to public?
- Is this a recurring event?

Validation:

- Event date must satisfy platform minimum lead time, initially 7 days.
- Start time must be before end time.
- Service duration should warn if less than 60 minutes for large guest counts.
- Estimated headcount must be positive.
- Phone and email must be valid.

Catering industry guidance:

- Capture service window separately from event window later because vendors need to know when food is served, not only when the party starts.
- Headcount should allow ranges early, but require a planning estimate before submission.
- Corporate events may need company name, department, onsite contact, and invoice contact.

Operator-first considerations:

- Operators need date, time, and guest count immediately to decide whether the lead is worth reviewing.
- The page should flag short lead times, unrealistic service windows, and headcounts below vendor minimums before submission.

### Page 6: RFQ Venue and Site Logistics

Purpose: Capture site conditions that determine whether a food truck can physically and legally serve the event.

Required fields:

- Venue name.
- Venue street address.
- City.
- State.
- ZIP code.
- Indoor or outdoor event.
- Onsite contact name.
- Onsite contact phone.
- Customer confirmation that the venue allows food trucks or outside catering.

Conditional required fields:

- If outdoor: weather backup plan.
- If private residence: driveway/street parking notes.
- If corporate campus: loading dock or security access instructions.
- If public event: permit responsibility.
- If venue has restrictions: restriction description.

Site logistics fields:

- Truck parking location.
- Estimated distance from truck to guests.
- Surface type: street, parking lot, grass, gravel, loading dock, courtyard, other.
- Is the surface level?
- Space available for truck length and service line.
- Can the truck remain onsite for entire service?
- Setup access time.
- Required departure time.
- Load-in instructions.
- Gate codes or security procedures.
- Elevator or stairs if buffet/drop-off equipment is required.
- Restroom access for staff.

Utility fields:

- Power available.
- Power type: standard outlet, 20 amp, 30 amp, 50 amp, unknown.
- Generator allowed.
- Water access available.
- Waste disposal available.
- Grease disposal expectations.

Compliance fields:

- Certificate of insurance required.
- Additional insured required.
- Business license or health permit required.
- Fire inspection required.
- Open flame restrictions.
- Noise restrictions.

Validation:

- Address must geocode or be manually confirmed.
- Setup access time must be before service start.
- Departure time must be after service end.
- Public events should require permit responsibility selection.
- If generator not allowed and power is unavailable, warn customer and vendor.

Catering industry guidance:

- Food trucks often need flat parking, adequate clearance, generator permission, and enough queue space.
- Venues may require COI, additional insured language, health permits, fire suppression documentation, and arrival windows.
- A truck cannot quote accurately without knowing access, parking, power, and restrictions.

Operator-first considerations:

- This page should reduce back-and-forth about whether the truck can physically serve.
- Vendors should see logistics risks summarized at the top of the RFQ.
- If site logistics are unknown, the RFQ can still submit but should be marked "logistics incomplete".

### Page 7: RFQ Service Style and Guest Flow

Purpose: Define how food will be served and how guest throughput should work.

Required fields:

- Desired service style.
- Meal period.
- Service start time.
- Service end time.
- Guest payment model.

Service style options:

- Food truck onsite service.
- Buffet catering.
- Full-service catering.
- Drop-off catering.
- Prepaid guest meals.
- Pay-per-guest onsite.
- Hosted tab with cap.
- Meal tickets.
- Plated service.
- Dessert truck.
- Beverage service.
- Late-night snack service.

Meal period options:

- Breakfast.
- Brunch.
- Lunch.
- Dinner.
- Late-night.
- Snack.
- Dessert.
- All-day service.

Guest payment model options:

- Customer pays full quote.
- Guests pay individually.
- Customer covers first fixed amount.
- Meal vouchers or tickets.
- Hybrid payment.

Operational fields:

- Expected guest arrival pattern: all at once, staggered, shifts, open house.
- Desired meals served per hour.
- Number of service points requested.
- Need staff to bus tables or clean guest area?
- Need vendor to provide serving staff?
- Need vendor to provide cashier?
- Need menu signage?
- Need order-ahead or ticketing?

Validation:

- Service window must fall within event window unless explicitly explained.
- Large headcount with short service window should show throughput warning.
- Guest-pay events should require expected attendance and public/private event classification.

Catering industry guidance:

- Food truck throughput is a real constraint. A truck serving made-to-order entrees may not serve 300 guests in one hour without a limited menu or multiple service points.
- Buffet service, prepaid meals, and limited menus can improve speed.
- Corporate lunches often require tight service windows and predictable per-person pricing.

Operator-first considerations:

- Vendors need to know whether they are selling to the organizer or individual guests.
- The system should help vendors flag service models that are operationally risky.
- The RFQ should capture throughput assumptions so operators can quote staffing and menu limitations correctly.

### Page 8: RFQ Cuisine, Menu, and Food Requirements

Purpose: Capture what the customer wants to eat while allowing operators to propose practical menu packages.

Required fields:

- Cuisine preference.
- Menu preference.
- Meal components requested.
- Dietary accommodations.
- Allergy considerations.

Cuisine options:

- BBQ.
- Mexican.
- Tacos.
- Burgers.
- Pizza.
- Asian fusion.
- Seafood.
- Southern.
- Caribbean.
- Mediterranean.
- Vegetarian.
- Vegan.
- Desserts.
- Coffee.
- Beverage.
- Other.

Menu preference options:

- Use vendor recommendation.
- Choose from sample menu.
- Custom menu request.
- Limited event menu.
- Package pricing.
- Per-person pricing.
- A la carte pricing.

Meal components:

- Appetizers.
- Entrees.
- Sides.
- Desserts.
- Beverages.
- Alcohol.
- Late-night menu.
- Kids menu.
- Staff meals.

Dietary and allergy fields:

- Vegetarian count.
- Vegan count.
- Gluten-free count.
- Dairy-free count.
- Nut-free requirement.
- Shellfish allergy.
- Other allergy notes.
- Cross-contamination sensitivity.

Optional food preferences:

- Spice level.
- Must-have dishes.
- Dishes to avoid.
- Locally sourced preference.
- Individually packaged meals.
- Buffet labels required.
- Nutritional or ingredient info required.

Validation:

- Allergy notes should trigger vendor review warning.
- Alcohol requests should trigger compliance warning and may be excluded from MVP unless vendor supports it.
- Individually packaged meals should require package count.

Catering industry guidance:

- Dietary requests are not the same as allergy-safe preparation. The RFQ must distinguish preference from medically necessary allergy requirements.
- For large events, a limited menu can reduce line time and improve execution.
- Menu selections should be treated as preferences until vendor confirms availability and pricing.

Operator-first considerations:

- Vendors should not be forced into custom menu obligations before quoting.
- The page should allow "vendor recommendation" because chefs often know what travels and serves best.
- Allergy and cross-contact requirements must be visible and acknowledged by the vendor.

### Page 9: RFQ Rentals, Equipment, and Service Supplies

Purpose: Capture non-food items that affect quote scope and event execution.

Customer request fields:

- Plates.
- Napkins.
- Utensils.
- Cups.
- Serving trays.
- Chafing dishes.
- Sternos.
- Tables.
- Linens.
- Tents.
- Coolers.
- Ice.
- Trash cans.
- Trash removal.
- Generators.
- Lighting.
- Menu signage.
- Queue stanchions.
- Handwashing station.

Required fields:

- Does customer expect vendor to provide serviceware?
- Does customer expect vendor to provide tables or tenting?
- Who handles trash cleanup?

Conditional fields:

- If buffet: serving tables, chafers, sternos, serving utensils.
- If outdoor: tenting and weather plan.
- If beverage: cups, ice, coolers, permits.
- If public event: trash stations and crowd flow.

Validation:

- Equipment request quantities must be positive.
- Tenting requests should require approximate setup area.
- Generator request should consider venue generator rules.

Catering industry guidance:

- Customers often assume utensils, tables, or trash service are included. Operators need these assumptions clarified before quoting.
- Rentals can change pricing materially and may require third-party coordination.

Operator-first considerations:

- This page should separate "must provide" from "nice to have".
- Vendors should be able to mark which requested equipment they can provide, outsource, or decline.

### Page 10: RFQ Budget, Pricing Expectations, and Payment Timing

Purpose: Capture financial expectations without forcing the operator into a price before reviewing requirements.

Required fields:

- Preferred budget range.
- Budget flexibility.
- Desired quote response deadline.
- Who is paying?
- Deposit readiness.

Budget fields:

- Total event budget.
- Per-person budget.
- Food-only budget.
- Separate rentals budget.
- Separate beverage budget.
- Not sure / need vendor guidance.

Payment timing fields:

- Desired deposit date.
- Final payment preference.
- Need invoice or receipt?
- Preferred invoice payment terms if customer will pay later.
- Whether balance may be collected onsite.
- Corporate billing contact.
- Tax-exempt status.
- Purchase order required.

Validation:

- Minimum budget cannot exceed maximum.
- Quote response deadline must be before event date.
- Quote response deadline should be realistic; same-day quotes can be allowed but flagged.
- Tax-exempt request should require document upload later.
- Invoice payment terms should be captured as a preference and confirmed by vendor in the quote/agreement.

Catering industry guidance:

- Budget range is critical for package design. A vendor needs to know whether to propose premium, standard, limited, buffet, or guest-pay options.
- Corporate events often require invoicing, W-9, COI, and purchase order workflows.

Operator-first considerations:

- Vendors should see budget fit before spending time quoting.
- The system should flag budget below vendor minimum.
- Deposit readiness helps operators prioritize serious leads.

### Page 11: RFQ Attachments and Special Notes

Purpose: Capture supporting information that reduces clarification messages.

Optional uploads:

- Venue layout.
- Parking map.
- Event schedule.
- Sample menu.
- Inspiration photos.
- Corporate requirements.
- COI requirements.
- Tax-exempt certificate.
- Permit documentation.

Special notes:

- Event theme.
- VIP guests.
- Accessibility needs.
- Security instructions.
- Cultural or religious food considerations.
- Vendor arrival instructions.
- Noise restrictions.

Validation:

- File type and size limits.
- Private files require authenticated account.
- Uploads should be virus-scanned in future phase.

Operator-first considerations:

- Attachments should be grouped by type so vendors can find logistics docs quickly.
- Venue diagrams and parking maps should be highlighted in RFQ review.

### Page 12: RFQ Review and Submit

Purpose: Let customer review the full RFQ, fix gaps, and submit a clear request.

Functional requirements:

- Show all RFQ sections in a readable summary.
- Highlight missing but important logistics.
- Show vendor targets or matching criteria.
- Show expected next steps.
- Require customer acknowledgement that quote is not final until vendor responds.
- Require customer acknowledgement of platform communication expectations.
- Allow save as draft.
- Allow submit.

Validation:

- Required fields complete.
- At least one vendor target or valid general matching criteria.
- Minimum lead time satisfied or exception explicitly allowed by admin/vendor.
- Customer contact info complete.

Post-submit behavior:

- RFQ status becomes `Submitted`.
- Vendor targets are created.
- Vendor notifications are sent.
- Customer sees confirmation page.

Operator-first considerations:

- Submission should not bury operational risks. It should label them: "power unknown", "permit required", "short service window", "budget below vendor minimum", "site access incomplete".

## 6. Customer Account Pages

### Page 13: Customer RFQ Confirmation Page

Purpose: Confirm submission and set communication expectations.

Functional requirements:

- Show RFQ number.
- Show submitted vendors or matching status.
- Show expected vendor response timeline.
- Show next steps: vendor review, clarification, quote, agreement, deposit, confirmation.
- Provide button to open RFQ detail.
- Provide button to send additional message or upload missing logistics if allowed.

Operator-first considerations:

- Do not encourage customers to submit duplicate RFQs for same event.
- Encourage customers to answer clarification requests quickly.

### Page 14: Customer Dashboard

Purpose: Give customers a simple overview of active requests and bookings.

Functional requirements:

- Show active RFQs.
- Show quotes awaiting review.
- Show agreements awaiting signature.
- Show deposits due.
- Show confirmed upcoming events.
- Show unread messages.
- Show cancelled/completed RFQs.

Filters:

- Status.
- Event date.
- Vendor.

Operator-first considerations:

- Customer dashboard should reduce vendor chasing by clearly showing customer action items.

### Page 15: Customer RFQ Detail Page

Purpose: Provide one place for the customer to track a request.

Functional requirements:

- Show RFQ status timeline.
- Show event summary.
- Show vendor responses.
- Show messages.
- Show quote cards.
- Show missing information requests.
- Show attachments.
- Allow customer to cancel before final confirmation.
- Allow customer to answer clarification questions.

State behavior:

- `Submitted`: waiting for vendor review.
- `Clarification Requested`: customer action required.
- `Quote Sent`: customer can review quote.
- `Agreement Pending`: customer can review agreement.
- `Deposit Paid`: event moving to confirmation.
- `Confirmed`: event booked.

Operator-first considerations:

- Customer actions should be clearly tied to operational needs: "Vendor needs parking details to complete your quote."

### Page 16: Customer Quote Review Page

Purpose: Help customers understand vendor quotes and approve the right one.

Functional requirements:

- Show quote summary: total, deposit, payment schedule, expiration, service style, menu, guest count assumption.
- Show line items: food, service fee, staffing, travel, rentals, taxes, gratuity, overtime.
- Show included and excluded items.
- Show vendor notes and assumptions.
- Show cancellation policy summary.
- Allow accept quote.
- Allow request revision.
- Allow decline quote.
- Show quote revision history.

Validation:

- Customer can accept only current active quote revision.
- Expired quotes require vendor reactivation or revision.

Operator-first considerations:

- Quote assumptions must be visible so customer understands what changes pricing.
- Revision requests should be structured, not freeform only.

### Page 17: Customer Agreement Review and Signature Page

Purpose: Finalize business terms digitally.

Functional requirements:

- Show agreement document.
- Show event details.
- Show accepted quote revision.
- Show payment terms.
- Show cancellation policy.
- Show customer responsibilities.
- Show vendor responsibilities.
- Capture typed legal name.
- Capture signature acknowledgement.
- Capture timestamp and IP metadata.
- Allow download after signing.

Validation:

- Customer must be authorized signer.
- Agreement version must be current.
- Required acknowledgements must be checked.

Operator-first considerations:

- Agreement should protect operator time, cancellation policy, weather contingencies, access requirements, and payment obligations.

### Page 18: Customer Deposit and Payment Page

Purpose: Collect required down payments or customer event payments securely and update booking state.

Functional requirements:

- Show payment amount.
- Show what payment covers.
- Show remaining balance and due dates.
- Show whether the current payment is a down payment, milestone, final balance, invoice payment, or onsite balance.
- Show invoice payment terms when applicable.
- Redirect to Stripe Checkout or embedded payment flow.
- Show payment confirmation.
- Show payment failure and retry.

Validation:

- Agreement must be signed before deposit.
- Payment amount comes from server, not client.
- Deposit cannot be paid twice.
- Future invoice or onsite payments must map to an agreement payment schedule item.

Operator-first considerations:

- Booking should not be marked confirmed until required deposit is paid.
- Payment status should be visible to vendor immediately after confirmation.
- foodtruckzs platform agreement fees should not be shown as customer charges in this flow.

## 7. Vendor Operator Pages

### Page 19: Vendor Signup and Onboarding

Purpose: Allow food truck operators to create a vendor account and prepare for marketplace and operations use.

Functional requirements:

- Create user account.
- Create vendor business profile.
- Capture business name, owner contact, phone, email, website, social links.
- Capture cuisine categories.
- Capture service areas.
- Capture operating model: truck onsite, buffet, drop-off, prepaid meals, guest-pay vending.
- Capture catering minimum.
- Capture average response time goal.
- Capture business license and insurance metadata.
- Capture required marketplace approval fields.
- Guide vendor through Stripe Connect onboarding.
- Show foodtruckzs platform billing terms, including the vendor-specific signed-agreement fee percentage when available.

Required operator setup:

- Business name.
- Primary contact.
- Service area.
- Cuisine.
- Minimum lead time.
- Catering minimum.
- At least one service style.

Operator-first considerations:

- Onboarding should feel like setting up their catering operation, not just a listing.
- Vendors should be able to stay unpublished while configuring menus, policies, and calendar.

### Page 20: Vendor Dashboard

Purpose: Give operators the daily command center for catering operations.

Functional requirements:

- Show new RFQs.
- Show RFQs needing response.
- Show clarification responses from customers.
- Show quotes in progress.
- Show quotes sent and awaiting customer action.
- Show accepted quotes needing agreement/deposit.
- Show upcoming confirmed events.
- Show deposits due or paid.
- Show calendar conflicts.
- Show unread messages.
- Show payout status.

Prioritization:

- Customer action needed.
- Vendor action needed.
- Event date proximity.
- Quote deadline proximity.
- Payment risk.

Operator-first considerations:

- Dashboard should answer: "What do I need to do today to protect revenue and execute events?"
- The dashboard should separate leads from confirmed bookings.

### Page 21: Vendor RFQ Inbox

Purpose: Let operators triage incoming catering requests quickly.

Functional requirements:

- Display RFQ cards with event date, service time, location, headcount, budget, cuisine, service style, target status, and logistics completeness.
- Show badges for high-risk or important items:
  - Short lead time.
  - Budget below minimum.
  - Power unknown.
  - Permit required.
  - Large headcount.
  - Tight service window.
  - Venue restrictions.
  - Allergy sensitive.
- Support filters by status, event date, event type, city, headcount, budget, and response deadline.
- Support actions: accept review, decline, request clarification, start quote.

Operator-first considerations:

- The inbox should help vendors decide fast without opening every detail.
- Declining should be quick and should optionally inform the customer politely.

### Page 22: Vendor RFQ Detail and Triage Page

Purpose: Give operators the complete event packet for decision-making.

Functional requirements:

- Show RFQ summary.
- Show event basics.
- Show venue logistics.
- Show service style.
- Show food requirements.
- Show equipment requests.
- Show budget and timing.
- Show attachments.
- Show customer messages.
- Show system-generated risk flags.
- Show vendor actions: accept, decline, clarify, quote.

Operator decision fields:

- Internal fit score.
- Internal notes.
- Reason for decline.
- Clarification questions.
- Assign team member.

Validation:

- Vendor cannot quote unless RFQ target is accepted or in quote-allowed state.
- Vendor cannot respond if suspended.

Operator-first considerations:

- RFQ detail should feel like an event worksheet.
- Internal notes must not be visible to customer.

### Page 23: Vendor Clarification and Messaging Page

Purpose: Centralize communication around the RFQ.

Functional requirements:

- Show threaded messages.
- Support structured clarification requests.
- Support attachments.
- Show quote and RFQ status changes in timeline.
- Show unread/read state.
- Allow vendor templates for common questions:
  - Where can the truck park?
  - Is power available?
  - Is generator use allowed?
  - What is the final guaranteed guest count?
  - Are permits required?
  - Is COI required?
  - Can the menu be limited for speed?

Operator-first considerations:

- Messaging should reduce repeated typing through templates.
- Clarification requests should map back to RFQ missing fields where possible.

### Page 24: Vendor Quote Builder

Purpose: Let operators create accurate, professional catering quotes quickly.

Functional requirements:

- Create quote from RFQ.
- Pull in event details automatically.
- Select menu package or custom line items.
- Add food line items.
- Add service fees.
- Add staffing fees.
- Add travel fees.
- Add rental/equipment charges.
- Add gratuity or service charge.
- Add taxes if applicable.
- Add overtime rate.
- Define deposit requirement.
- Define payment schedule.
- Define quote expiration.
- Add assumptions and exclusions.
- Preview customer-facing quote.
- Save draft.
- Send quote.

Line item fields:

- Name.
- Description.
- Quantity.
- Unit.
- Unit price.
- Taxable flag.
- Optional/internal flag.

Quote assumptions:

- Guest count basis.
- Service window.
- Menu availability.
- Site access assumptions.
- Power/generator assumptions.
- Staffing assumptions.
- Weather assumptions.
- Final guest count deadline.

Validation:

- Quote must contain at least one charge.
- Deposit cannot exceed total.
- Payment schedule must sum to total.
- Expiration must be before event date.
- Negative line items allowed only for discounts and must be labeled.

Catering industry guidance:

- Quotes should distinguish food cost, service labor, travel, rentals, and fees because these change differently when scope changes.
- Final guest count deadlines are common and should be captured, especially for per-person pricing.

Operator-first considerations:

- Quote builder should make it faster to respond than writing a custom PDF.
- Vendors should be able to reuse menu packages and fee templates.

### Page 25: Vendor Quote Revision and Negotiation Page

Purpose: Manage quote changes without losing history.

Functional requirements:

- Show current quote revision.
- Show previous revisions.
- Show customer revision requests.
- Allow vendor to create new revision.
- Require revision notes.
- Highlight changes from prior revision.
- Send revised quote.

Revision reasons:

- Guest count change.
- Menu change.
- Service style change.
- Venue logistics change.
- Budget adjustment.
- Equipment/rental change.
- Date/time change.

Validation:

- Accepted quotes cannot be revised unless vendor creates a formal change order in future phase.
- Revision must change at least one material term.

Operator-first considerations:

- Vendors need a clean record of what changed and why.
- Revision history protects both parties if terms are disputed.

### Page 26: Vendor Menu Management

Purpose: Let operators build reusable catering menus and packages.

Functional requirements:

- Create menus.
- Create menu items.
- Create packages.
- Set per-person pricing.
- Set package pricing.
- Mark seasonal availability.
- Mark dietary tags.
- Upload menu photos.
- Mark public/private.
- Clone menu or package.

Required fields:

- Menu name.
- Vendor ID.
- Status.

Optional fields:

- Minimum guest count.
- Maximum guest count.
- Prep lead time.
- Availability dates.
- Service style compatibility.

Operator-first considerations:

- Menus should support operational reuse but not force vendors into static pricing publicly.
- Vendors should be able to keep internal quote-only menus.

### Page 27: Vendor Availability and Operating Settings

Purpose: Let operators define when and where they can accept catering.

Functional requirements:

- Define recurring operating hours.
- Define blackout dates.
- Define booking lead time.
- Define travel radius.
- Define service areas.
- Define catering minimum.
- Define maximum daily bookings.
- Define default setup time.
- Define default travel buffer.
- Define quote response preferences.

Validation:

- Availability windows cannot overlap unless allowed.
- Travel radius must be positive.
- Booking lead time must meet platform minimum unless admin override.

Operator-first considerations:

- Availability should reduce bad leads, not create rigid rules that block legitimate opportunities.
- Vendors should be able to mark "request anyway" for some unavailable dates if they want leads.

### Page 28: Vendor Calendar

Purpose: Centralize catering bookings, manual events, truck locations, and blocked time.

Functional requirements:

- Monthly view.
- Weekly view.
- Daily view.
- Agenda view.
- Timeline view.
- Show confirmed catering events.
- Show manual events.
- Show food truck public locations.
- Show festivals.
- Show blocked time.
- Show conflict warnings.
- Allow drag-and-drop for manual events.
- Prevent direct drag changes to confirmed catering event core terms unless change workflow exists.

Calendar event types:

- Confirmed catering.
- Pending catering hold.
- Manual booking.
- Festival.
- Public truck location.
- Blocked time.
- Prep time.

Operator-first considerations:

- Calendar must help avoid double-booking.
- Confirmed catering events should be visually distinct from leads and public vending locations.

### Page 29: Vendor Event Operations Detail Page

Purpose: Turn confirmed bookings into executable event plans.

Functional requirements:

- Show confirmed event summary.
- Show customer contact and onsite contact.
- Show venue logistics.
- Show agreed menu.
- Show guest count.
- Show service window.
- Show arrival/setup/departure times.
- Show staffing notes.
- Show prep notes.
- Show equipment checklist.
- Show payment status.
- Show agreement and documents.
- Show internal notes.
- Mark operational checklist items complete.

Checklist categories:

- Prep.
- Shopping.
- Staffing.
- Equipment.
- Load-in.
- Site setup.
- Service.
- Breakdown.
- Payment follow-up.

Operator-first considerations:

- This page should become the operator's event run sheet.
- It should be mobile-friendly for day-of-event use.

### Page 30: Vendor Agreement and Document Center

Purpose: Give operators access to signed agreements, RFQ attachments, quote history, and compliance docs.

Functional requirements:

- List agreements.
- Filter by event date, customer, status.
- View agreement versions.
- Download signed agreement.
- View RFQ attachments.
- Upload vendor documents such as COI or permits.
- See document access history for signed agreements.

Operator-first considerations:

- Documents should be tied to events and customers.
- Operators should not search through messages to find signed paperwork.

### Page 31: Vendor Payments and Payouts Page

Purpose: Help operators understand deposits, balances, refunds, and payouts.

Functional requirements:

- Show deposits paid.
- Show upcoming balances.
- Show payment schedule.
- Show Stripe payout status.
- Show foodtruckzs agreement fee invoices separately from customer payment processing fees.
- Show foodtruckzs signed-agreement fees billed to the catering company.
- Show platform invoice status.
- Show processing fees.
- Show refunds and disputes.
- Export payment records.

Validation:

- Only authorized vendor roles can view payout details.

Operator-first considerations:

- Vendors care about whether money is collected and when payout arrives.
- Payment status should be connected to event status.
- foodtruckzs agreement fees should be transparent to operators but tracked separately from customer deposits and event balances.

## 8. Admin Pages

### Page 32: Admin Dashboard

Purpose: Give platform operators a summary of marketplace health.

Functional requirements:

- Show new vendor applications.
- Show active disputes.
- Show payout issues.
- Show failed webhooks or payment exceptions.
- Show RFQ volume.
- Show quote conversion.
- Show upcoming high-value events.

### Page 33: Vendor Approval Page

Purpose: Review and approve food truck vendors before marketplace publication.

Functional requirements:

- Show vendor application.
- Show business profile.
- Show service area.
- Show cuisine.
- Show uploaded documents.
- Approve, reject, or request changes.
- Add admin notes.
- Audit every decision.

Operator-first considerations:

- Approval should be clear and respectful to vendors.
- Rejection should explain what is missing.

### Page 34: Admin RFQ and Dispute Review Page

Purpose: Support customer/vendor issues without becoming the normal communication path.

Functional requirements:

- Search RFQs.
- View messages.
- View quote history.
- View agreement.
- View payment records.
- Add admin note.
- Mark dispute status.

Security:

- Sensitive admin access must be audited.

### Page 35: Admin Payment Monitoring Page

Purpose: Monitor deposits, refunds, payouts, and Stripe webhook health.

Functional requirements:

- List payments by status.
- Filter by vendor, customer, event date, payment status.
- Show failed payments.
- Show payout failures.
- Show refund requests.
- Show webhook processing failures.
- Trigger reconciliation job if authorized.

### Page 36: Admin Platform Billing Page

Purpose: Manage foodtruckzs monetization from signed catering agreements.

Functional requirements:

- Configure signed-agreement fee percentage per vendor account.
- Store percentage with no fee amount cap.
- Show pending platform agreement fees.
- Show agreement total used for fee calculation.
- Generate invoices to catering companies.
- Track invoice status: draft, issued, paid, overdue, void, adjusted.
- Add adjustment line items when corrections are required.
- Export platform billing records.
- Audit all billing setting changes.

Operator-first considerations:

- Billing should be transparent and predictable for catering companies.
- Customer down payments should not be confused with foodtruckzs platform invoices.

### Page 37: Admin Marketplace Moderation Page

Purpose: Keep marketplace listings accurate and appropriate.

Functional requirements:

- Review public vendor profiles.
- Moderate photos.
- Moderate descriptions.
- Manage featured vendors.
- Manage cuisine categories.
- Manage service areas.

## 9. Shared Application Requirements

### Notifications

Functional requirements:

- In-app notification center.
- Email notifications for important workflow changes.
- Optional SMS later for urgent reminders.
- Notification preferences.
- Unread counts.

Customer notifications:

- RFQ submitted.
- Vendor accepted review.
- Clarification requested.
- Quote ready.
- Quote revised.
- Agreement ready.
- Deposit due.
- Payment confirmed.
- Event reminder.

Vendor notifications:

- New RFQ.
- Customer clarification response.
- New message.
- Quote accepted.
- Agreement signed.
- Deposit paid.
- Calendar conflict.
- Event reminder.
- Payout update.

Operator-first considerations:

- Vendors should be able to configure notification urgency.
- Critical booking/payment notifications should not be easy to miss.

### Search, Filters, and Empty States

Functional requirements:

- Every list page must have filters relevant to the workflow.
- Empty states should explain the next action.
- No empty state should make the product feel broken.

Operator examples:

- No RFQs: prompt vendor to improve profile, service area, menus, and availability.
- No calendar events: prompt vendor to add blocked dates or manual bookings.
- No menus: prompt vendor to create quote templates.

### Mobile and Tablet Behavior

Functional requirements:

- Customer RFQ must be mobile-first.
- Vendor dashboard must work on tablet.
- Event operations page must work on mobile for day-of-event use.
- Quote builder can be optimized for desktop/tablet first.

Operator-first considerations:

- Food truck operators may manage events from a phone between services.
- Key day-of details must be readable without desktop layout.

## 10. RFQ Data Quality Rules

### RFQ Completeness Score

The system should calculate a completeness score for each RFQ.

High-value completeness categories:

- Event basics complete.
- Venue address confirmed.
- Truck parking known.
- Power/generator known.
- Guest count provided.
- Service style selected.
- Service window realistic.
- Menu preferences provided.
- Dietary/allergy needs provided.
- Budget range provided.
- Equipment expectations clarified.
- Permit/COI requirements known.

Vendor display:

- Complete.
- Needs review.
- Logistics incomplete.
- Budget risk.
- Site risk.
- Timing risk.

### RFQ Risk Flags

The system should generate risk flags:

- Event date inside minimum lead time.
- Headcount above vendor configured capacity.
- Budget below vendor minimum.
- Service window too short for headcount.
- Venue does not confirm food truck allowance.
- Parking unknown.
- Power unavailable and generator not allowed.
- Public event permit required.
- Allergy-sensitive request.
- Weather backup missing for outdoor event.
- COI required.
- Travel outside preferred service area.

Operator-first considerations:

- Risk flags should help vendors triage, not automatically reject all events.
- Vendors should be able to override warnings when they want the business.

## 11. Functional MVP Scope

### Must Have

- Public marketplace search.
- Vendor profile pages.
- Customer RFQ flow.
- Customer dashboard.
- Vendor onboarding.
- Vendor dashboard.
- Vendor RFQ inbox and detail.
- Messaging and clarification.
- Quote builder with revisions.
- Agreement generation and signature.
- Deposit payment through Stripe Connect.
- Future full event invoice payment support.
- Future onsite payment collection support.
- Platform signed-agreement fee tracking for caterer invoicing.
- Vendor calendar with confirmed events and manual events.
- Availability settings.
- Notifications.
- Admin vendor approval.

### Should Have

- RFQ completeness score.
- RFQ risk flags.
- Menu package reuse.
- Equipment checklist.
- Event operations detail page.
- Payment and payout dashboard.
- Platform billing dashboard for operators and admins.
- Agreement document center.

### Later

- AI vendor matching.
- Dynamic pricing.
- Advanced route optimization.
- Inventory forecasting.
- Complex staffing scheduler.
- Public instant booking.
- Customer self-service change orders.

## 12. Acceptance Criteria Themes

### RFQ Acceptance Criteria

- Customer can submit a complete RFQ in a guided flow.
- Vendor receives all operationally necessary details in a structured layout.
- Vendor can identify missing logistics without reading every message.
- Vendor can request clarification from RFQ detail.
- RFQ status changes are visible to both parties.
- RFQ cannot become confirmed without accepted quote, signed agreement, and required deposit.

### Vendor Operations Acceptance Criteria

- Vendor can triage new RFQs from inbox.
- Vendor can build and send quote from RFQ data.
- Vendor can revise quote without losing history.
- Vendor can see confirmed bookings on calendar.
- Vendor can access event run sheet details from calendar.
- Vendor can track deposit and payout state.

### Customer Experience Acceptance Criteria

- Customer can discover vendors and submit quote requests without understanding every catering term.
- Customer can understand why site logistics matter.
- Customer can review quote assumptions before accepting.
- Customer can sign agreement and pay deposit online.
- Customer payment flows do not include foodtruckzs platform agreement fees as customer-facing charges.
- Customer can see booking status and required actions.

## 13. Final Product Direction

foodtruckzs should feel like a serious catering operations platform that happens to create a better marketplace experience. The customer gets access to talented food truck chefs through a guided request flow. The operator gets structured leads, fewer vague inquiries, cleaner quotes, signed agreements, deposits, scheduling discipline, and a practical event run sheet.

The RFQ experience should be detailed where details matter, but not intimidating. The product should teach customers what operators need while protecting operators from unqualified, incomplete, or logistically impossible requests.
