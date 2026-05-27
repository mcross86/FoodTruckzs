# foodtruckzs

Product Requirements Document (PRD)

## 1. Product Overview

### Product Name

foodtruckzs

### Product Type

Marketplace + Catering Operations Platform

### Vision

foodtruckzs enables customers to request, negotiate, book, and manage food truck catering services through a structured digital RFQ workflow while giving food truck operators a dedicated operational platform to manage catering quotes, agreements, schedules, and payments.

The platform bridges the gap between:

- Customer event planning
- Catering quote management
- Operational scheduling
- Payment coordination

## 2. Problem Statement

Food truck catering today is highly fragmented and manually operated.

Customers struggle to:

- Discover reliable food truck caterers
- Compare offerings
- Organize quotes
- Manage communication
- Finalize agreements digitally

Food truck operators struggle to:

- Manage incoming inquiries
- Track quote lifecycle
- Coordinate schedules
- Collect deposits
- Prevent booking conflicts
- Centralize communication

Most workflows occur across:

- Instagram DMs
- Email
- Phone calls
- PDFs
- Spreadsheets
- Manual invoicing

There is currently no dedicated catering operations workflow built specifically for food truck operators.

## 3. Product Goals

### Customer Goals

- Easily request catering quotes
- Compare food truck vendors
- Manage event requirements digitally
- Sign agreements online
- Pay deposits securely

### Vendor Goals

- Receive structured RFQs
- Respond efficiently
- Build quotes digitally
- Manage catering calendars
- Avoid scheduling conflicts
- Collect deposits
- Centralize operations

### Platform Goals

- Create repeatable RFQ workflows
- Standardize catering communications
- Enable scalable vendor operations
- Generate transaction revenue
- Build a regional catering marketplace

## 4. Primary User Types

### A. Consumer Customer

Individual planning:

- Parties
- Weddings
- Birthdays
- Graduation events
- Private gatherings
- Neighborhood events

### B. Corporate Customer

Businesses planning:

- Office lunches
- Corporate events
- Employee appreciation
- Conferences
- Festivals

### C. Food Truck Caterer (FTC Vendor)

Food truck operators providing:

- Onsite catering
- Buffet catering
- Prepaid meal service
- Mobile vending
- Event food service

### D. Platform Administrator

Internal foodtruckzs operational users.

## 5. Product Architecture

The system is divided into six major modules.

### MODULE 1 — Marketplace Platform

#### Purpose

Customer-facing discovery and RFQ submission experience.

#### Features

##### Vendor Discovery

Customers can browse:

- Cuisine type
- Service style
- Location
- Ratings
- Availability
- Dietary accommodations

##### Vendor Profiles

Each vendor profile includes:

- Business information
- Food photography
- Service regions
- Cuisine categories
- Sample menus
- Pricing ranges
- Catering minimums
- Operational hours

##### Search & Filters

Filters include:

- Cuisine
- Event size
- Budget range
- Vegetarian/vegan
- Alcohol service
- Dessert availability
- Onsite cooking
- Buffet service
- Equipment rentals

##### RFQ Entry Point

Customers can:

- Submit RFQ to a specific vendor
- OR
- Submit generalized RFQ to multiple vendors

### MODULE 2 — RFQ Engine

#### Purpose

Structured catering request workflow.

#### RFQ Workflow Lifecycle

##### Statuses

- Draft
- Submitted
- Vendor Reviewing
- Clarification Requested
- Quote In Progress
- Quote Sent
- Negotiation
- Accepted
- Agreement Pending
- Agreement Signed
- Deposit Paid
- Confirmed
- Completed
- Cancelled

#### RFQ Form Requirements

##### Event Information

Required:

- Event name
- Event type
- Date
- Start/end time
- Venue address
- Indoor/outdoor
- Estimated headcount

Optional:

- Parking notes
- Venue restrictions
- Access instructions

##### Food Requirements

###### Cuisine Selection

Examples:

- BBQ
- Mexican
- Asian fusion
- Seafood
- Southern
- Dessert trucks

###### Menu Preferences

Customer can request:

- Appetizers
- Entrees
- Proteins
- Desserts
- Beverages
- Alcohol
- Late-night menu

###### Dietary Accommodations

- Vegetarian
- Vegan
- Gluten-free
- Dairy-free
- Nut-free

###### Service Style Options

- Full-service catering
- Buffet
- Plated service
- Food truck onsite vending
- Prepaid guest meals
- Pay-per-guest

##### Equipment Requests

Customer may request:

- Coolers
- Tents
- Tables
- Chairs
- Linens
- Utensils
- Silverware
- Glasses
- Plates
- Generators
- Trash stations

##### Budget & Timing

- Preferred budget range
- Quote response deadline
- Minimum 7-day booking lead time

#### Vendor RFQ Management

Food truck operators can:

- Accept RFQ
- Reject RFQ
- Request clarification
- Submit revised quotes
- Upload menus
- Attach documents
- Request deposits

#### Internal Messaging

Threaded communication system:

- customer ↔ vendor
- Timestamped messages
- Quote revision tracking
- Notification system

### MODULE 3 — Vendor Operations Portal

#### Purpose

Operational software for food truck caterers.

#### Dashboard

Vendor dashboard displays:

- Active RFQs
- Pending quotes
- Upcoming events
- Deposits due
- Calendar conflicts
- Unread messages

#### Quote Builder

Vendor can create:

- Line-item pricing
- Service fees
- Staffing fees
- Travel fees
- Gratuity
- Rental charges
- Overtime pricing

#### Menu Builder

Vendor can:

- Create reusable catering menus
- Define package pricing
- Define per-person pricing
- Create seasonal offerings

#### Availability Management

Vendor can:

- Block unavailable dates
- Define operating hours
- Define travel radius
- Define booking minimums

#### Staffing Notes

Internal operational notes:

- Staffing assignments
- Prep requirements
- Equipment checklist

### MODULE 4 — Agreement System

#### Purpose

Digitally finalize catering agreements.

#### Agreement Generation

System generates purchase agreement including:

- Event details
- Menu selections
- Pricing
- Payment terms
- Cancellation policy
- Vendor requirements
- Customer responsibilities

#### Digital Signature Workflow

Customer can:

- Review agreement
- Sign digitally
- Approve quote

Vendor receives:

- Signed agreement copy
- Confirmation notification

#### Agreement Storage

System stores:

- Signed agreements
- Quote revisions
- Attachments
- Payment history

### MODULE 5 — Scheduling System

#### Purpose

Centralized operational scheduling.

#### Catering Calendar

Views:

- Monthly
- Weekly
- Daily
- Timeline
- Agenda

#### Appointment Types

##### Auto-Generated Catering Events

Created from:

- Signed agreements
- Confirmed deposits

Displayed in:

- Primary confirmation color

##### Manual Events

Vendor-created events:

- Food truck operating locations
- Festivals
- Private bookings

Displayed in:

- Secondary color

#### Calendar Features

- Drag-and-drop scheduling
- Conflict warnings
- Travel buffer recommendations
- Recurring events
- Availability syncing

#### Operational Conflict Detection

System warns vendor if:

- Overlapping catering exists
- Staffing conflicts exist
- Travel timing impossible
- Double-booking risk exists

### MODULE 6 — Payment Infrastructure

#### Purpose

Support customer payments to food truck caterers and maintain platform billing records for foodtruckzs monetization.

#### Customer-to-Vendor Payment Model

Food truck caterers can collect customer payments in app when required by the signed catering agreement.

Platform supports:

- Down payments / deposits
- Milestone payments
- Final balances
- Future full-event invoice payments
- Future on-the-spot payment collection

Customer payment records are tied to:

- RFQ
- Accepted quote
- Signed agreement
- Payment schedule
- Vendor payout status

#### Platform Monetization Billing Model

foodtruckzs charges food truck caterers a standard percentage fee on each signed catering agreement.

Requirements:

- The platform fee percentage is configurable per food truck caterer/vendor account.
- There is no maximum fee cap.
- The fee is calculated from the signed catering agreement amount.
- The fee becomes billable when the catering agreement is signed.
- foodtruckzs invoices the catering company for the fee.
- The platform fee is tracked separately from customer down payments and vendor payouts.
- The initial model does not require automatically deducting the platform fee from customer payments.

#### Payment Workflow

##### Step 1

Vendor defines:

- Deposit requirement
- Payment schedule
- Whether customer payment is due at signing, before event, on invoice terms, or onsite

##### Step 2

Customer pays deposit.

##### Step 3

Platform holds transaction records.

##### Step 4

Vendor payout/payment status is recorded.

##### Step 5

If the agreement is signed, foodtruckzs calculates the platform agreement fee using the vendor-specific percentage and creates a platform billing record for invoicing the catering company.

#### Refund Support

Support:

- Cancellation windows
- Partial refunds
- Dispute tracking

#### Recommended Architecture

Suggested future integration:

- Stripe Connect

Future customer payment expansion:

- Full event invoice payment
- Invoice due dates and payment terms
- Onsite payment collection
- Saved payment methods where legally and operationally appropriate
- Automated vendor payout reconciliation

## 6. Notifications

### Customer Notifications

- RFQ submitted
- Vendor response
- Clarification request
- Quote ready
- Agreement ready
- Payment confirmation
- Event reminders

### Vendor Notifications

- New RFQ
- New message
- Quote accepted
- Agreement signed
- Payment received
- Scheduling conflict

## 7. Admin Platform

### Admin Capabilities

- Vendor approval
- Marketplace moderation
- Dispute management
- Payout monitoring
- Platform agreement fee monitoring
- Caterer invoice management
- Analytics
- Featured vendor management

## 8. Analytics

### Vendor Analytics

- RFQ conversion rate
- Average quote size
- Booking revenue
- Repeat customers
- Busiest days

### Platform Analytics

- Total GMV
- Vendor growth
- Quote volume
- Conversion funnel
- Top cuisines
- Geographic demand

## 9. Non-Functional Requirements

### Security

- Encrypted payments
- Secure document storage
- Role-based permissions

### Scalability

System should support:

- Multiple metro areas
- Thousands of vendors
- Concurrent RFQs

### Mobile Responsiveness

Platform must support:

- Mobile-first customer flow
- Tablet-friendly vendor operations

## 10. Recommended MVP Scope

### Phase 1 MVP

Focus only on:

- Customer RFQs
- Vendor portal
- Quote workflow
- Messaging
- Calendar
- Agreements
- Deposits

Avoid:

- AI matching
- Dynamic pricing
- Advanced analytics
- Instant booking

## 11. Future Enhancements

### Marketplace Intelligence

- Vendor recommendations
- Smart cuisine matching
- Estimated pricing engine

### AI Features

- RFQ summarization
- Quote drafting assistance
- Schedule optimization

### Logistics Features

- Route optimization
- Staffing coordination
- Inventory forecasting

## 12. Monetization Model

### Revenue Streams

#### Signed Agreement Fee

Standard percentage of each signed catering agreement.

Rules:

- Configurable per food truck caterer/vendor account
- No amount cap
- Calculated when the agreement is signed
- Invoiced to the catering company by foodtruckzs
- Tracked separately from customer deposits and vendor payouts

#### Vendor Subscription

Premium operational software access.

#### Featured Placement

Sponsored vendor discovery.

## 13. Strategic Positioning

foodtruckzs should position itself as:

> “The operational platform for food truck catering.”

Not:

> “A food delivery app.”

The platform’s long-term defensibility comes from:

- Workflow infrastructure
- Quote lifecycle management
- Operational tooling
- Scheduling coordination
- Vendor retention

—not simply marketplace traffic.
