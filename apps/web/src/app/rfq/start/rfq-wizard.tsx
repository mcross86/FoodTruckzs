"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { AuthSessionPanel } from "@/components/auth-session-panel";
import { useAuthSession } from "@/lib/auth-session";
import {
  moneyLabel,
  rfqApiRequest,
  type CreateRfqPayload,
  type RfqDetail,
} from "@/lib/rfq-api";

type RfqWizardProps = {
  initialVendorIds: string[];
};

type RequestType = "general" | "multiple" | "selected";

type RfqDraft = {
  attachments: {
    category: string;
    contentType: string;
    fileName: string;
    notes: string;
    sizeMb: string;
  }[];
  budget: {
    balanceMayBeCollectedOnsite: boolean;
    budgetFlexibility: string;
    budgetGuidanceNeeded: boolean;
    budgetMaxDollars: string;
    budgetMinDollars: string;
    corporateBillingContact: string;
    depositReadiness: string;
    desiredDepositDate: string;
    finalPaymentPreference: string;
    invoiceOrReceiptNeeded: boolean;
    payer: string;
    purchaseOrderRequired: boolean;
    quoteResponseDeadlineDate: string;
    quoteResponseDeadlineTime: string;
    taxExempt: boolean;
  };
  equipment: {
    expectsVendorServiceware: boolean;
    expectsVendorTablesOrTenting: boolean;
    requestNotes: string;
    requestedItems: string[];
    trashCleanup: string;
  };
  eventBasics: {
    ageMix: string;
    customerType: string;
    endTime: string;
    eventDate: string;
    eventName: string;
    eventType: string;
    eventWebsiteUrl: string;
    estimatedHeadcount: string;
    isOpenToPublic: boolean;
    isRecurring: boolean;
    primaryContactEmail: string;
    primaryContactName: string;
    primaryContactPhone: string;
    startTime: string;
    timezone: string;
  };
  foodRequirements: {
    allergyNotes: string;
    buffetLabelsRequired: boolean;
    crossContaminationSensitive: boolean;
    cuisinesText: string;
    dairyFreeCount: string;
    dietaryAccommodations: string[];
    dishesToAvoidText: string;
    glutenFreeCount: string;
    individuallyPackagedMeals: boolean;
    mealComponents: string[];
    menuPreference: string;
    mustHaveDishesText: string;
    nutFreeRequired: boolean;
    otherAllergyNotes: string;
    shellfishAllergy: boolean;
    spiceLevel: string;
    veganCount: string;
    vegetarianCount: string;
  };
  requestType: RequestType;
  review: {
    communicationAcknowledged: boolean;
    quoteAcknowledged: boolean;
  };
  serviceStyle: {
    cashierNeeded: boolean;
    cleanupStaffNeeded: boolean;
    desiredMealsPerHour: string;
    desiredServiceStyle: string;
    guestArrivalPattern: string;
    guestPaymentModel: string;
    mealPeriod: string;
    menuSignageNeeded: boolean;
    orderAheadNeeded: boolean;
    serviceEndTime: string;
    servicePointsRequested: string;
    serviceStartTime: string;
    servingStaffNeeded: boolean;
  };
  specialNotes: string;
  targetVendorIdsText: string;
  venue: {
    additionalInsuredRequired: boolean;
    allowsFoodTrucks: "false" | "true" | "unknown";
    businessLicenseRequired: boolean;
    canRemainOnsite: boolean;
    city: string;
    coiRequired: boolean;
    departureTime: string;
    estimatedDistanceFromTruckToGuestsFeet: string;
    fireInspectionRequired: boolean;
    gateOrSecurityInstructions: string;
    generatorAllowed: "false" | "true" | "unknown";
    greaseDisposalExpectations: string;
    healthPermitRequired: boolean;
    indoorOutdoor: "indoor" | "mixed" | "outdoor";
    line1: string;
    line2: string;
    loadInInstructions: string;
    noiseRestrictions: string;
    onsiteContactName: string;
    onsiteContactPhone: string;
    openFlameRestrictions: string;
    parkingNotes: string;
    permitResponsibility: string;
    postalCode: string;
    powerAvailable: "false" | "true" | "unknown";
    powerType: string;
    restrictionDescription: string;
    restroomAccessForStaff: boolean;
    setupAccessTime: string;
    spaceAvailableForTruckAndLine: boolean;
    state: string;
    surfaceIsLevel: boolean;
    surfaceType: string;
    truckParkingLocation: string;
    venueName: string;
    wasteDisposalAvailable: boolean;
    waterAccessAvailable: boolean;
    weatherBackupPlan: string;
  };
};

type FieldProps = {
  children?: React.ReactNode;
  helper?: string;
  label: string;
};

const draftStorageKey = "foodtruckzs.rfqDraft.v1";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const steps = [
  "Start",
  "Event basics",
  "Venue logistics",
  "Service style",
  "Food requirements",
  "Equipment",
  "Budget",
  "Notes",
  "Review",
] as const;

const eventTypes = [
  "Wedding",
  "Birthday",
  "Graduation",
  "Corporate lunch",
  "Employee appreciation",
  "Office catering",
  "Conference",
  "Festival",
  "Community event",
  "School event",
  "Private party",
  "Neighborhood event",
  "Late-night event",
  "Other",
];

const customerTypes = [
  "individual",
  "company",
  "planner",
  "nonprofit",
  "school",
  "venue",
  "municipality",
];

const serviceStyles = [
  "Food truck onsite service",
  "Buffet catering",
  "Full-service catering",
  "Drop-off catering",
  "Prepaid guest meals",
  "Pay-per-guest onsite",
  "Hosted tab with cap",
  "Meal tickets",
  "Plated service",
  "Dessert truck",
  "Beverage service",
  "Late-night snack service",
];

const mealPeriods = [
  "Breakfast",
  "Brunch",
  "Lunch",
  "Dinner",
  "Late-night",
  "Snack",
  "Dessert",
  "All-day service",
];

const paymentModels = [
  "Customer pays full quote",
  "Guests pay individually",
  "Customer covers first fixed amount",
  "Meal vouchers or tickets",
  "Hybrid payment",
];

const dietaryOptions = ["none", "vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"];

const mealComponentOptions = [
  "appetizers",
  "entrees",
  "sides",
  "desserts",
  "beverages",
  "alcohol",
  "late-night menu",
  "kids menu",
  "staff meals",
];

const equipmentOptions = [
  "plates",
  "napkins",
  "utensils",
  "cups",
  "serving trays",
  "chafing dishes",
  "sternos",
  "tables",
  "linens",
  "tents",
  "coolers",
  "ice",
  "trash cans",
  "trash removal",
  "generators",
  "lighting",
  "menu signage",
  "queue stanchions",
  "handwashing station",
];

const venueBooleanFields: { label: string; name: keyof RfqDraft["venue"] }[] = [
  { label: "Surface is level", name: "surfaceIsLevel" },
  { label: "Space for truck and service line", name: "spaceAvailableForTruckAndLine" },
  { label: "Truck can remain onsite", name: "canRemainOnsite" },
  { label: "Staff restroom access", name: "restroomAccessForStaff" },
  { label: "Water access", name: "waterAccessAvailable" },
  { label: "Waste disposal", name: "wasteDisposalAvailable" },
  { label: "Certificate of insurance required", name: "coiRequired" },
  { label: "Additional insured required", name: "additionalInsuredRequired" },
  { label: "Business license required", name: "businessLicenseRequired" },
  { label: "Health permit required", name: "healthPermitRequired" },
  { label: "Fire inspection required", name: "fireInspectionRequired" },
];

const serviceBooleanFields: { label: string; name: keyof RfqDraft["serviceStyle"] }[] = [
  { label: "Need staff to bus tables or clean guest area", name: "cleanupStaffNeeded" },
  { label: "Need serving staff", name: "servingStaffNeeded" },
  { label: "Need vendor cashier", name: "cashierNeeded" },
  { label: "Need menu signage", name: "menuSignageNeeded" },
  { label: "Need order-ahead or ticketing", name: "orderAheadNeeded" },
];

const foodBooleanFields: { label: string; name: keyof RfqDraft["foodRequirements"] }[] = [
  { label: "Nut-free required", name: "nutFreeRequired" },
  { label: "Shellfish allergy", name: "shellfishAllergy" },
  { label: "Cross-contamination sensitivity", name: "crossContaminationSensitive" },
  { label: "Individually packaged meals", name: "individuallyPackagedMeals" },
  { label: "Buffet labels required", name: "buffetLabelsRequired" },
];

const budgetBooleanFields: { label: string; name: keyof RfqDraft["budget"] }[] = [
  { label: "Not sure, need vendor budget guidance", name: "budgetGuidanceNeeded" },
  { label: "Need invoice or receipt", name: "invoiceOrReceiptNeeded" },
  { label: "Balance may be collected onsite", name: "balanceMayBeCollectedOnsite" },
  { label: "Tax-exempt status", name: "taxExempt" },
  { label: "Purchase order required", name: "purchaseOrderRequired" },
];

function futureDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createInitialDraft(initialVendorIds: string[]): RfqDraft {
  return {
    attachments: [],
    budget: {
      balanceMayBeCollectedOnsite: false,
      budgetFlexibility: "Flexible for the right fit",
      budgetGuidanceNeeded: false,
      budgetMaxDollars: "",
      budgetMinDollars: "",
      corporateBillingContact: "",
      depositReadiness: "Ready once quote is accepted",
      desiredDepositDate: "",
      finalPaymentPreference: "Deposit now, final balance before event",
      invoiceOrReceiptNeeded: false,
      payer: "Customer pays full quote",
      purchaseOrderRequired: false,
      quoteResponseDeadlineDate: "",
      quoteResponseDeadlineTime: "17:00",
      taxExempt: false,
    },
    equipment: {
      expectsVendorServiceware: true,
      expectsVendorTablesOrTenting: false,
      requestNotes: "",
      requestedItems: ["plates", "napkins", "utensils"],
      trashCleanup: "Customer handles venue-wide trash; vendor handles service-area cleanup.",
    },
    eventBasics: {
      ageMix: "adults",
      customerType: "individual",
      endTime: "15:00",
      eventDate: futureDate(14),
      eventName: "",
      eventType: "Corporate lunch",
      eventWebsiteUrl: "",
      estimatedHeadcount: "",
      isOpenToPublic: false,
      isRecurring: false,
      primaryContactEmail: "",
      primaryContactName: "",
      primaryContactPhone: "",
      startTime: "11:00",
      timezone: "America/New_York",
    },
    foodRequirements: {
      allergyNotes: "",
      buffetLabelsRequired: false,
      crossContaminationSensitive: false,
      cuisinesText: "",
      dairyFreeCount: "",
      dietaryAccommodations: ["none"],
      dishesToAvoidText: "",
      glutenFreeCount: "",
      individuallyPackagedMeals: false,
      mealComponents: ["entrees", "sides"],
      menuPreference: "Use vendor recommendation",
      mustHaveDishesText: "",
      nutFreeRequired: false,
      otherAllergyNotes: "",
      shellfishAllergy: false,
      spiceLevel: "",
      veganCount: "",
      vegetarianCount: "",
    },
    requestType:
      initialVendorIds.length > 1
        ? "multiple"
        : initialVendorIds.length === 1
          ? "selected"
          : "general",
    review: {
      communicationAcknowledged: false,
      quoteAcknowledged: false,
    },
    serviceStyle: {
      cashierNeeded: false,
      cleanupStaffNeeded: false,
      desiredMealsPerHour: "",
      desiredServiceStyle: "Food truck onsite service",
      guestArrivalPattern: "staggered",
      guestPaymentModel: "Customer pays full quote",
      mealPeriod: "Lunch",
      menuSignageNeeded: true,
      orderAheadNeeded: false,
      serviceEndTime: "14:00",
      servicePointsRequested: "1",
      serviceStartTime: "12:00",
      servingStaffNeeded: false,
    },
    specialNotes: "",
    targetVendorIdsText: initialVendorIds.join("\n"),
    venue: {
      additionalInsuredRequired: false,
      allowsFoodTrucks: "unknown",
      businessLicenseRequired: false,
      canRemainOnsite: true,
      city: "",
      coiRequired: false,
      departureTime: "",
      estimatedDistanceFromTruckToGuestsFeet: "",
      fireInspectionRequired: false,
      gateOrSecurityInstructions: "",
      generatorAllowed: "unknown",
      greaseDisposalExpectations: "",
      healthPermitRequired: false,
      indoorOutdoor: "outdoor",
      line1: "",
      line2: "",
      loadInInstructions: "",
      noiseRestrictions: "",
      onsiteContactName: "",
      onsiteContactPhone: "",
      openFlameRestrictions: "",
      parkingNotes: "",
      permitResponsibility: "",
      postalCode: "",
      powerAvailable: "unknown",
      powerType: "",
      restrictionDescription: "",
      restroomAccessForStaff: false,
      setupAccessTime: "10:30",
      spaceAvailableForTruckAndLine: false,
      state: "",
      surfaceIsLevel: false,
      surfaceType: "",
      truckParkingLocation: "",
      venueName: "",
      wasteDisposalAvailable: false,
      waterAccessAvailable: false,
      weatherBackupPlan: "",
    },
  };
}

function text(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function listFromText(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function integerFromText(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function centsFromDollars(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : undefined;
}

function booleanFromChoice(value: "false" | "true" | "unknown"): boolean | undefined {
  if (value === "unknown") {
    return undefined;
  }

  return value === "true";
}

function toIso(date: string, time: string): string {
  const parsed = new Date(`${date}T${time}:00`);

  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function optionalIso(date: string, time = "12:00"): string | undefined {
  return date ? toIso(date, time) : undefined;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isFutureLeadTime(date: string, days: number): boolean {
  const eventDate = new Date(`${date}T00:00:00`);
  const minimum = new Date();
  minimum.setHours(0, 0, 0, 0);
  minimum.setDate(minimum.getDate() + days);
  return eventDate.getTime() >= minimum.getTime();
}

function parseTargetVendorIds(draft: RfqDraft): string[] {
  return draft.requestType === "general" ? [] : listFromText(draft.targetVendorIdsText);
}

function validateStart(draft: RfqDraft): string[] {
  const errors: string[] = [];
  const targetVendorIds = parseTargetVendorIds(draft);

  if (draft.requestType !== "general" && targetVendorIds.length === 0) {
    errors.push("Specific or multi-vendor RFQs need at least one selected vendor ID.");
  }

  for (const vendorId of targetVendorIds) {
    if (!uuidPattern.test(vendorId)) {
      errors.push(`Vendor ID ${vendorId} must be a UUID.`);
    }
  }

  return errors;
}

function validateEventBasics(draft: RfqDraft): string[] {
  const errors: string[] = [];
  const basics = draft.eventBasics;
  const headcount = integerFromText(basics.estimatedHeadcount);

  if (!text(basics.eventName) || basics.eventName.trim().length < 2)
    errors.push("Event name is required.");
  if (!text(basics.eventType)) errors.push("Event type is required.");
  if (!basics.eventDate) errors.push("Event date is required.");
  if (basics.eventDate && !isFutureLeadTime(basics.eventDate, 7)) {
    errors.push("Event date must be at least 7 days from today.");
  }
  if (!basics.startTime || !basics.endTime) errors.push("Event start and end time are required.");
  if (basics.eventDate && basics.startTime && basics.endTime) {
    const startsAt = new Date(toIso(basics.eventDate, basics.startTime));
    const endsAt = new Date(toIso(basics.eventDate, basics.endTime));
    if (startsAt.getTime() >= endsAt.getTime())
      errors.push("Event start time must be before end time.");
  }
  if (!text(basics.timezone)) errors.push("Event timezone is required.");
  if (!headcount || headcount <= 0) errors.push("Estimated headcount must be positive.");
  if (!text(basics.customerType)) errors.push("Customer type is required.");
  if (!text(basics.primaryContactName) || basics.primaryContactName.trim().length < 2) {
    errors.push("Primary contact name is required.");
  }
  if (!isValidEmail(basics.primaryContactEmail))
    errors.push("Primary contact email must be valid.");
  if (!text(basics.primaryContactPhone) || basics.primaryContactPhone.trim().length < 7) {
    errors.push("Primary contact phone is required.");
  }

  return errors;
}

function validateVenue(draft: RfqDraft): string[] {
  const errors: string[] = [];
  const venue = draft.venue;

  if (!text(venue.venueName)) errors.push("Venue name is required.");
  if (!text(venue.line1)) errors.push("Venue street address is required.");
  if (!text(venue.city)) errors.push("Venue city is required.");
  if (!text(venue.state) || venue.state.trim().length < 2) errors.push("Venue state is required.");
  if (!text(venue.onsiteContactName) || venue.onsiteContactName.trim().length < 2) {
    errors.push("Onsite contact name is required.");
  }
  if (!text(venue.onsiteContactPhone) || venue.onsiteContactPhone.trim().length < 7) {
    errors.push("Onsite contact phone is required.");
  }
  if (venue.allowsFoodTrucks === "unknown") {
    errors.push("Confirm whether the venue allows food trucks or outside catering.");
  }
  if (venue.indoorOutdoor === "outdoor" && !text(venue.weatherBackupPlan)) {
    errors.push("Outdoor events need a weather backup plan.");
  }
  if (draft.eventBasics.isOpenToPublic && !text(venue.permitResponsibility)) {
    errors.push("Public events need permit responsibility selected or described.");
  }

  return errors;
}

function validateServiceStyle(draft: RfqDraft): string[] {
  const errors: string[] = [];
  const service = draft.serviceStyle;
  const date = draft.eventBasics.eventDate;

  if (!text(service.desiredServiceStyle)) errors.push("Desired service style is required.");
  if (!text(service.mealPeriod)) errors.push("Meal period is required.");
  if (!text(service.guestPaymentModel)) errors.push("Guest payment model is required.");
  if (!service.serviceStartTime || !service.serviceEndTime) {
    errors.push("Service start and end time are required.");
  }
  if (date && service.serviceStartTime && service.serviceEndTime) {
    const eventStart = new Date(toIso(date, draft.eventBasics.startTime));
    const eventEnd = new Date(toIso(date, draft.eventBasics.endTime));
    const serviceStart = new Date(toIso(date, service.serviceStartTime));
    const serviceEnd = new Date(toIso(date, service.serviceEndTime));

    if (serviceStart.getTime() >= serviceEnd.getTime()) {
      errors.push("Service start time must be before service end time.");
    }
    if (
      serviceStart.getTime() < eventStart.getTime() ||
      serviceEnd.getTime() > eventEnd.getTime()
    ) {
      errors.push("Service window must fall within the event window.");
    }
  }

  return errors;
}

function validateFoodRequirements(draft: RfqDraft): string[] {
  const errors: string[] = [];

  if (listFromText(draft.foodRequirements.cuisinesText).length === 0) {
    errors.push("Add at least one cuisine preference or type 'vendor recommendation'.");
  }
  if (!text(draft.foodRequirements.menuPreference)) errors.push("Menu preference is required.");
  if (draft.foodRequirements.mealComponents.length === 0) {
    errors.push("Select at least one meal component.");
  }
  if (draft.foodRequirements.dietaryAccommodations.length === 0) {
    errors.push("Select dietary accommodations or 'none'.");
  }

  return errors;
}

function validateEquipment(draft: RfqDraft): string[] {
  const errors: string[] = [];

  if (!text(draft.equipment.trashCleanup)) {
    errors.push("Trash cleanup responsibility is required.");
  }

  return errors;
}

function validateBudget(draft: RfqDraft): string[] {
  const errors: string[] = [];
  const budget = draft.budget;
  const min = centsFromDollars(budget.budgetMinDollars);
  const max = centsFromDollars(budget.budgetMaxDollars);

  if (!budget.budgetGuidanceNeeded && min === undefined && max === undefined) {
    errors.push("Enter a budget range or mark that you need vendor guidance.");
  }
  if (min !== undefined && max !== undefined && min > max) {
    errors.push("Budget minimum cannot exceed budget maximum.");
  }
  if (!text(budget.budgetFlexibility)) errors.push("Budget flexibility is required.");
  if (!text(budget.depositReadiness)) errors.push("Deposit readiness is required.");
  if (!text(budget.payer)) errors.push("Who is paying is required.");
  if (budget.quoteResponseDeadlineDate) {
    const deadline = new Date(
      toIso(budget.quoteResponseDeadlineDate, budget.quoteResponseDeadlineTime || "17:00"),
    );
    const eventStart = new Date(toIso(draft.eventBasics.eventDate, draft.eventBasics.startTime));
    if (deadline.getTime() >= eventStart.getTime()) {
      errors.push("Quote response deadline must be before the event starts.");
    }
  }

  return errors;
}

function validateNotes(draft: RfqDraft): string[] {
  const errors: string[] = [];

  for (const [index, attachment] of draft.attachments.entries()) {
    if (!text(attachment.fileName)) errors.push(`Attachment ${index + 1} needs a file name.`);
    if (!text(attachment.category)) errors.push(`Attachment ${index + 1} needs a category.`);
    const sizeMb = Number.parseFloat(attachment.sizeMb);
    if (attachment.sizeMb && (!Number.isFinite(sizeMb) || sizeMb <= 0 || sizeMb > 25)) {
      errors.push(`Attachment ${index + 1} size must be between 0 and 25 MB.`);
    }
  }

  return errors;
}

function validateReview(draft: RfqDraft): string[] {
  const errors = [
    ...validateStart(draft),
    ...validateEventBasics(draft),
    ...validateVenue(draft),
    ...validateServiceStyle(draft),
    ...validateFoodRequirements(draft),
    ...validateEquipment(draft),
    ...validateBudget(draft),
    ...validateNotes(draft),
  ];

  if (!draft.review.quoteAcknowledged) {
    errors.push("Acknowledge that this is a quote request, not a final booking.");
  }
  if (!draft.review.communicationAcknowledged) {
    errors.push("Acknowledge that vendors may need clarification before quoting.");
  }

  return errors;
}

function validateStep(draft: RfqDraft, step: number): string[] {
  switch (step) {
    case 0:
      return validateStart(draft);
    case 1:
      return validateEventBasics(draft);
    case 2:
      return validateVenue(draft);
    case 3:
      return validateServiceStyle(draft);
    case 4:
      return validateFoodRequirements(draft);
    case 5:
      return validateEquipment(draft);
    case 6:
      return validateBudget(draft);
    case 7:
      return validateNotes(draft);
    case 8:
      return validateReview(draft);
    default:
      return [];
  }
}

function reviewWarnings(draft: RfqDraft): string[] {
  const warnings: string[] = [];
  const headcount = integerFromText(draft.eventBasics.estimatedHeadcount) ?? 0;
  const serviceStart = new Date(
    toIso(draft.eventBasics.eventDate, draft.serviceStyle.serviceStartTime),
  );
  const serviceEnd = new Date(
    toIso(draft.eventBasics.eventDate, draft.serviceStyle.serviceEndTime),
  );
  const durationMinutes = (serviceEnd.getTime() - serviceStart.getTime()) / 60_000;

  if (durationMinutes > 0 && durationMinutes < 60 && headcount > 50) {
    warnings.push(
      "Large headcount with a short service window can require a limited menu or more service points.",
    );
  }
  if (!text(draft.venue.truckParkingLocation) && !text(draft.venue.parkingNotes)) {
    warnings.push("Truck parking details are incomplete, which may delay vendor review.");
  }
  if (draft.venue.powerAvailable === "false" && draft.venue.generatorAllowed === "false") {
    warnings.push("Power is unavailable and generator use is not allowed.");
  }
  if (draft.foodRequirements.nutFreeRequired || draft.foodRequirements.shellfishAllergy) {
    warnings.push("Allergy-sensitive requests will need explicit vendor review.");
  }
  if (draft.venue.coiRequired) {
    warnings.push("COI requirements should be visible before vendors spend time quoting.");
  }

  return warnings;
}

function buildPayload(draft: RfqDraft): CreateRfqPayload {
  const date = draft.eventBasics.eventDate;
  const budgetMinCents = centsFromDollars(draft.budget.budgetMinDollars);
  const budgetMaxCents = centsFromDollars(draft.budget.budgetMaxDollars);
  const dietaryAccommodations = draft.foodRequirements.dietaryAccommodations.includes("none")
    ? []
    : draft.foodRequirements.dietaryAccommodations;

  return {
    attachments: draft.attachments.map((attachment) => ({
      category: attachment.category.trim(),
      contentType: text(attachment.contentType),
      fileName: attachment.fileName.trim(),
      notes: text(attachment.notes),
      sizeBytes: attachment.sizeMb
        ? Math.round(Number.parseFloat(attachment.sizeMb) * 1_000_000)
        : undefined,
    })),
    budget: {
      balanceMayBeCollectedOnsite: draft.budget.balanceMayBeCollectedOnsite,
      budgetFlexibility: draft.budget.budgetGuidanceNeeded
        ? `${draft.budget.budgetFlexibility}; customer needs vendor budget guidance`
        : draft.budget.budgetFlexibility,
      budgetMaxCents,
      budgetMinCents,
      corporateBillingContact: text(draft.budget.corporateBillingContact),
      depositReadiness: draft.budget.depositReadiness,
      desiredDepositDate: optionalIso(draft.budget.desiredDepositDate),
      finalPaymentPreference: text(draft.budget.finalPaymentPreference),
      invoiceOrReceiptNeeded: draft.budget.invoiceOrReceiptNeeded,
      payer: draft.budget.payer,
      purchaseOrderRequired: draft.budget.purchaseOrderRequired,
      quoteResponseDeadline: optionalIso(
        draft.budget.quoteResponseDeadlineDate,
        draft.budget.quoteResponseDeadlineTime,
      ),
      taxExempt: draft.budget.taxExempt,
    },
    equipment: {
      expectsVendorServiceware: draft.equipment.expectsVendorServiceware,
      expectsVendorTablesOrTenting: draft.equipment.expectsVendorTablesOrTenting,
      requests: draft.equipment.requestedItems.map((item) => ({
        item,
        notes: text(draft.equipment.requestNotes),
        required: true,
      })),
      trashCleanup: draft.equipment.trashCleanup,
    },
    eventBasics: {
      ageMix: text(draft.eventBasics.ageMix),
      customerType: draft.eventBasics.customerType,
      endsAt: toIso(date, draft.eventBasics.endTime),
      eventName: draft.eventBasics.eventName,
      eventType: draft.eventBasics.eventType,
      eventWebsiteUrl: text(draft.eventBasics.eventWebsiteUrl),
      estimatedHeadcount: integerFromText(draft.eventBasics.estimatedHeadcount) ?? 0,
      isOpenToPublic: draft.eventBasics.isOpenToPublic,
      isRecurring: draft.eventBasics.isRecurring,
      primaryContact: {
        email: draft.eventBasics.primaryContactEmail,
        name: draft.eventBasics.primaryContactName,
        phone: draft.eventBasics.primaryContactPhone,
      },
      startsAt: toIso(date, draft.eventBasics.startTime),
      timezone: draft.eventBasics.timezone,
    },
    foodRequirements: {
      allergyNotes: text(draft.foodRequirements.allergyNotes),
      buffetLabelsRequired: draft.foodRequirements.buffetLabelsRequired,
      crossContaminationSensitive: draft.foodRequirements.crossContaminationSensitive,
      cuisinePreferences: listFromText(draft.foodRequirements.cuisinesText),
      dairyFreeCount: integerFromText(draft.foodRequirements.dairyFreeCount),
      dietaryAccommodations,
      dishesToAvoid: listFromText(draft.foodRequirements.dishesToAvoidText),
      glutenFreeCount: integerFromText(draft.foodRequirements.glutenFreeCount),
      individuallyPackagedMeals: draft.foodRequirements.individuallyPackagedMeals,
      mealComponents: draft.foodRequirements.mealComponents,
      menuPreference: draft.foodRequirements.menuPreference,
      mustHaveDishes: listFromText(draft.foodRequirements.mustHaveDishesText),
      nutFreeRequired: draft.foodRequirements.nutFreeRequired,
      otherAllergyNotes: text(draft.foodRequirements.otherAllergyNotes),
      shellfishAllergy: draft.foodRequirements.shellfishAllergy,
      spiceLevel: text(draft.foodRequirements.spiceLevel),
      veganCount: integerFromText(draft.foodRequirements.veganCount),
      vegetarianCount: integerFromText(draft.foodRequirements.vegetarianCount),
    },
    serviceStyle: {
      cashierNeeded: draft.serviceStyle.cashierNeeded,
      cleanupStaffNeeded: draft.serviceStyle.cleanupStaffNeeded,
      desiredMealsPerHour: integerFromText(draft.serviceStyle.desiredMealsPerHour),
      desiredServiceStyle: draft.serviceStyle.desiredServiceStyle,
      guestArrivalPattern: text(draft.serviceStyle.guestArrivalPattern),
      guestPaymentModel: draft.serviceStyle.guestPaymentModel,
      mealPeriod: draft.serviceStyle.mealPeriod,
      menuSignageNeeded: draft.serviceStyle.menuSignageNeeded,
      orderAheadNeeded: draft.serviceStyle.orderAheadNeeded,
      serviceEndsAt: toIso(date, draft.serviceStyle.serviceEndTime),
      servicePointsRequested: integerFromText(draft.serviceStyle.servicePointsRequested),
      serviceStartsAt: toIso(date, draft.serviceStyle.serviceStartTime),
      servingStaffNeeded: draft.serviceStyle.servingStaffNeeded,
    },
    specialNotes: text(draft.specialNotes),
    targetVendorIds: parseTargetVendorIds(draft),
    venue: {
      additionalInsuredRequired: draft.venue.additionalInsuredRequired,
      allowsFoodTrucks: booleanFromChoice(draft.venue.allowsFoodTrucks),
      businessLicenseRequired: draft.venue.businessLicenseRequired,
      canRemainOnsite: draft.venue.canRemainOnsite,
      city: draft.venue.city,
      coiRequired: draft.venue.coiRequired,
      country: "US",
      departureTime: text(draft.venue.departureTime),
      estimatedDistanceFromTruckToGuestsFeet: integerFromText(
        draft.venue.estimatedDistanceFromTruckToGuestsFeet,
      ),
      fireInspectionRequired: draft.venue.fireInspectionRequired,
      gateOrSecurityInstructions: text(draft.venue.gateOrSecurityInstructions),
      generatorAllowed: booleanFromChoice(draft.venue.generatorAllowed),
      greaseDisposalExpectations: text(draft.venue.greaseDisposalExpectations),
      healthPermitRequired: draft.venue.healthPermitRequired,
      indoorOutdoor: draft.venue.indoorOutdoor,
      line1: draft.venue.line1,
      line2: text(draft.venue.line2),
      loadInInstructions: text(draft.venue.loadInInstructions),
      noiseRestrictions: text(draft.venue.noiseRestrictions),
      onsiteContactName: draft.venue.onsiteContactName,
      onsiteContactPhone: draft.venue.onsiteContactPhone,
      openFlameRestrictions: text(draft.venue.openFlameRestrictions),
      parkingNotes: text(draft.venue.parkingNotes),
      permitResponsibility: text(draft.venue.permitResponsibility),
      postalCode: text(draft.venue.postalCode),
      powerAvailable: booleanFromChoice(draft.venue.powerAvailable),
      powerType: text(draft.venue.powerType),
      restrictionDescription: text(draft.venue.restrictionDescription),
      restroomAccessForStaff: draft.venue.restroomAccessForStaff,
      setupAccessTime: text(draft.venue.setupAccessTime),
      spaceAvailableForTruckAndLine: draft.venue.spaceAvailableForTruckAndLine,
      state: draft.venue.state,
      surfaceIsLevel: draft.venue.surfaceIsLevel,
      surfaceType: text(draft.venue.surfaceType),
      truckParkingLocation: text(draft.venue.truckParkingLocation),
      venueName: draft.venue.venueName,
      wasteDisposalAvailable: draft.venue.wasteDisposalAvailable,
      waterAccessAvailable: draft.venue.waterAccessAvailable,
      weatherBackupPlan: text(draft.venue.weatherBackupPlan),
    },
  };
}

function Field({ children, helper, label }: FieldProps) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      {children}
      {helper ? <span style={{ color: "#555", fontSize: 13 }}>{helper}</span> : null}
    </label>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section
      style={{ border: "1px solid #ddd", borderRadius: 18, display: "grid", gap: 16, padding: 20 }}
    >
      <h2 style={{ margin: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

function inputStyle() {
  return { padding: 10, width: "100%" };
}

function gridStyle() {
  return {
    display: "grid",
    gap: 14,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  };
}

function CheckboxGroup({
  legend,
  onChange,
  options,
  values,
}: {
  legend: string;
  onChange: (values: string[]) => void;
  options: string[];
  values: string[];
}) {
  return (
    <fieldset
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        display: "grid",
        gap: 8,
        margin: 0,
        padding: 12,
      }}
    >
      <legend style={{ fontWeight: 700 }}>{legend}</legend>
      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        }}
      >
        {options.map((option) => (
          <label key={option} style={{ alignItems: "center", display: "flex", gap: 8 }}>
            <input
              checked={values.includes(option)}
              onChange={(event) => {
                if (event.target.checked) {
                  onChange([...values.filter((value) => value !== "none"), option]);
                } else {
                  onChange(values.filter((value) => value !== option));
                }
              }}
              type="checkbox"
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SummaryLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt style={{ fontWeight: 700 }}>{label}</dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </div>
  );
}

export function RfqWizard({ initialVendorIds }: RfqWizardProps) {
  const session = useAuthSession();
  const [draft, setDraft] = useState(() => createInitialDraft(initialVendorIds));
  const [step, setStep] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const warnings = useMemo(() => reviewWarnings(draft), [draft]);
  const previewPayload = useMemo(() => buildPayload(draft), [draft]);

  useEffect(() => {
    const storedDraft = window.localStorage.getItem(draftStorageKey);

    if (storedDraft) {
      try {
        const parsed = JSON.parse(storedDraft) as RfqDraft;
        const selectedIds = listFromText(parsed.targetVendorIdsText);
        const mergedVendorIds = [...new Set([...selectedIds, ...initialVendorIds])];
        setDraft({
          ...createInitialDraft(initialVendorIds),
          ...parsed,
          requestType:
            parsed.requestType === "general" && initialVendorIds.length > 0
              ? initialVendorIds.length === 1
                ? "selected"
                : "multiple"
              : parsed.requestType,
          targetVendorIdsText: mergedVendorIds.join("\n"),
        });
      } catch {
        window.localStorage.removeItem(draftStorageKey);
      }
    }

    setHydrated(true);
  }, [initialVendorIds]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
  }, [draft, hydrated]);

  function updateDraft<K extends keyof RfqDraft>(section: K, value: RfqDraft[K]) {
    setDraft((current) => ({ ...current, [section]: value }));
  }

  function updateSection<K extends keyof RfqDraft>(section: K, value: Partial<RfqDraft[K]>) {
    setDraft((current) => ({
      ...current,
      [section]: {
        ...(current[section] as Record<string, unknown>),
        ...value,
      } as RfqDraft[K],
    }));
  }

  function handleNext() {
    const stepErrors = validateStep(draft, step);
    setErrors(stepErrors);

    if (stepErrors.length === 0) {
      setStep((current) => Math.min(current + 1, steps.length - 1));
      window.scrollTo({ top: 0 });
    }
  }

  function handleBack() {
    setErrors([]);
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0 });
  }

  function addAttachment() {
    updateDraft("attachments", [
      ...draft.attachments,
      {
        category: "venue_layout",
        contentType: "application/pdf",
        fileName: "",
        notes: "",
        sizeMb: "",
      },
    ]);
  }

  function updateAttachment(index: number, value: Partial<RfqDraft["attachments"][number]>) {
    updateDraft(
      "attachments",
      draft.attachments.map((attachment, attachmentIndex) =>
        attachmentIndex === index ? { ...attachment, ...value } : attachment,
      ),
    );
  }

  function removeAttachment(index: number) {
    updateDraft(
      "attachments",
      draft.attachments.filter((_, attachmentIndex) => attachmentIndex !== index),
    );
  }

  async function submitRfq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const stepErrors = validateReview(draft);
    setErrors(stepErrors);
    setSubmitError(null);

    if (!session.accessToken.trim()) {
      setSubmitError("Log in as a customer or choose a saved customer account before submitting.");
      return;
    }

    if (stepErrors.length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await rfqApiRequest<RfqDetail>({
        apiBaseUrl: session.apiBaseUrl,
        body: previewPayload,
        method: "POST",
        path: "/api/v1/rfqs",
        token: session.accessToken,
      });

      if (!result.ok || !result.data) {
        throw new Error(`RFQ submit failed with ${result.status}: ${JSON.stringify(result.body)}`);
      }

      window.sessionStorage.setItem("foodtruckzs.lastSubmittedRfq", JSON.stringify(result.data));
      window.localStorage.removeItem(draftStorageKey);
      window.location.href = `/rfq/confirmation?rfqId=${encodeURIComponent(result.data.rfqId)}`;
    } catch (caughtError) {
      setSubmitError(caughtError instanceof Error ? caughtError.message : "RFQ submit failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function boolInput(section: "equipment" | "review" | "serviceStyle" | "venue", name: string) {
    return (event: ChangeEvent<HTMLInputElement>) =>
      updateSection(section, { [name]: event.target.checked } as Partial<RfqDraft[typeof section]>);
  }

  return (
    <form onSubmit={(event) => void submitRfq(event)} style={{ display: "grid", gap: 20 }}>
      <section
        style={{ background: "#fff4df", borderRadius: 20, display: "grid", gap: 12, padding: 20 }}
      >
        <p style={{ color: "#8a4b00", fontWeight: 700, margin: 0 }}>
          Structured RFQ for operator review
        </p>
        <h1 style={{ margin: 0 }}>Request food truck catering quotes</h1>
        <p style={{ fontSize: 18, lineHeight: 1.5, margin: 0 }}>
          This flow collects the details operators need to decide fit, price accurately, plan
          staffing, and avoid day-of site surprises. You are requesting a quote, not placing a
          delivery order.
        </p>
      </section>

      <nav aria-label="RFQ progress" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {steps.map((label, index) => (
          <button
            key={label}
            onClick={() => {
              setErrors([]);
              setStep(index);
            }}
            style={{
              background: index === step ? "#1f1f1f" : "#f5f5f5",
              border: "1px solid #ccc",
              borderRadius: 999,
              color: index === step ? "#fff" : "#222",
              padding: "8px 12px",
            }}
            type="button"
          >
            {index + 1}. {label}
          </button>
        ))}
      </nav>

      {errors.length > 0 ? (
        <section style={{ background: "#ffe8e8", borderRadius: 14, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Fix before continuing</h2>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {step === 0 ? (
        <Panel title="RFQ Start">
          <p>
            Choose whether this request should go to selected vendors or to matching marketplace
            vendors. Incomplete logistics can still be submitted, but they may slow vendor
            responses.
          </p>
          <div style={gridStyle()}>
            <Field
              helper="General RFQs are matched by city/state, cuisine, service style, headcount, and budget."
              label="Request type"
            >
              <select
                onChange={(event) => updateDraft("requestType", event.target.value as RequestType)}
                style={inputStyle()}
                value={draft.requestType}
              >
                <option value="general">Submit general RFQ to matching vendors</option>
                <option value="selected">Request quote from selected vendor</option>
                <option value="multiple">Request quote from multiple selected vendors</option>
              </select>
            </Field>
            <Field
              helper="Paste one vendor UUID per line. Marketplace CTAs prefill this when available."
              label="Selected vendor IDs"
            >
              <textarea
                disabled={draft.requestType === "general"}
                onChange={(event) => updateDraft("targetVendorIdsText", event.target.value)}
                rows={4}
                style={inputStyle()}
                value={draft.targetVendorIdsText}
              />
            </Field>
          </div>
        </Panel>
      ) : null}

      {step === 1 ? (
        <Panel title="Event Basics">
          <p>
            Date, time, and headcount let operators decide whether the lead is viable before they
            invest time in menu planning.
          </p>
          <div style={gridStyle()}>
            <Field label="Event name">
              <input
                onChange={(event) =>
                  updateSection("eventBasics", { eventName: event.target.value })
                }
                style={inputStyle()}
                value={draft.eventBasics.eventName}
              />
            </Field>
            <Field label="Event type">
              <select
                onChange={(event) =>
                  updateSection("eventBasics", { eventType: event.target.value })
                }
                style={inputStyle()}
                value={draft.eventBasics.eventType}
              >
                {eventTypes.map((eventType) => (
                  <option key={eventType}>{eventType}</option>
                ))}
              </select>
            </Field>
            <Field helper="Minimum platform lead time is 7 days." label="Event date">
              <input
                onChange={(event) =>
                  updateSection("eventBasics", { eventDate: event.target.value })
                }
                style={inputStyle()}
                type="date"
                value={draft.eventBasics.eventDate}
              />
            </Field>
            <Field label="Event start time">
              <input
                onChange={(event) =>
                  updateSection("eventBasics", { startTime: event.target.value })
                }
                style={inputStyle()}
                type="time"
                value={draft.eventBasics.startTime}
              />
            </Field>
            <Field label="Event end time">
              <input
                onChange={(event) => updateSection("eventBasics", { endTime: event.target.value })}
                style={inputStyle()}
                type="time"
                value={draft.eventBasics.endTime}
              />
            </Field>
            <Field label="Event timezone">
              <input
                onChange={(event) => updateSection("eventBasics", { timezone: event.target.value })}
                style={inputStyle()}
                value={draft.eventBasics.timezone}
              />
            </Field>
            <Field label="Estimated headcount">
              <input
                min="1"
                onChange={(event) =>
                  updateSection("eventBasics", { estimatedHeadcount: event.target.value })
                }
                style={inputStyle()}
                type="number"
                value={draft.eventBasics.estimatedHeadcount}
              />
            </Field>
            <Field label="Customer type">
              <select
                onChange={(event) =>
                  updateSection("eventBasics", { customerType: event.target.value })
                }
                style={inputStyle()}
                value={draft.eventBasics.customerType}
              >
                {customerTypes.map((customerType) => (
                  <option key={customerType}>{customerType}</option>
                ))}
              </select>
            </Field>
            <Field label="Primary contact name">
              <input
                onChange={(event) =>
                  updateSection("eventBasics", { primaryContactName: event.target.value })
                }
                style={inputStyle()}
                value={draft.eventBasics.primaryContactName}
              />
            </Field>
            <Field label="Primary contact email">
              <input
                onChange={(event) =>
                  updateSection("eventBasics", { primaryContactEmail: event.target.value })
                }
                style={inputStyle()}
                type="email"
                value={draft.eventBasics.primaryContactEmail}
              />
            </Field>
            <Field label="Primary contact phone">
              <input
                onChange={(event) =>
                  updateSection("eventBasics", { primaryContactPhone: event.target.value })
                }
                style={inputStyle()}
                value={draft.eventBasics.primaryContactPhone}
              />
            </Field>
            <Field label="Event website or invitation link">
              <input
                onChange={(event) =>
                  updateSection("eventBasics", { eventWebsiteUrl: event.target.value })
                }
                style={inputStyle()}
                type="url"
                value={draft.eventBasics.eventWebsiteUrl}
              />
            </Field>
          </div>
          <div style={gridStyle()}>
            <Field label="Expected age mix">
              <select
                onChange={(event) => updateSection("eventBasics", { ageMix: event.target.value })}
                style={inputStyle()}
                value={draft.eventBasics.ageMix}
              >
                <option>adults</option>
                <option>children</option>
                <option>mixed</option>
              </select>
            </Field>
            <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
              <input
                checked={draft.eventBasics.isOpenToPublic}
                onChange={(event) =>
                  updateSection("eventBasics", { isOpenToPublic: event.target.checked })
                }
                type="checkbox"
              />
              Event is open to the public
            </label>
            <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
              <input
                checked={draft.eventBasics.isRecurring}
                onChange={(event) =>
                  updateSection("eventBasics", { isRecurring: event.target.checked })
                }
                type="checkbox"
              />
              This is a recurring event
            </label>
          </div>
        </Panel>
      ) : null}

      {step === 2 ? (
        <Panel title="Venue and Site Logistics">
          <p>
            Trucks need flat parking, access time, queue space, power or generator permission, and
            venue approvals. These details reduce back-and-forth before quoting.
          </p>
          <div style={gridStyle()}>
            <Field label="Venue name">
              <input
                onChange={(event) => updateSection("venue", { venueName: event.target.value })}
                style={inputStyle()}
                value={draft.venue.venueName}
              />
            </Field>
            <Field label="Street address">
              <input
                onChange={(event) => updateSection("venue", { line1: event.target.value })}
                style={inputStyle()}
                value={draft.venue.line1}
              />
            </Field>
            <Field label="Address line 2">
              <input
                onChange={(event) => updateSection("venue", { line2: event.target.value })}
                style={inputStyle()}
                value={draft.venue.line2}
              />
            </Field>
            <Field label="City">
              <input
                onChange={(event) => updateSection("venue", { city: event.target.value })}
                style={inputStyle()}
                value={draft.venue.city}
              />
            </Field>
            <Field label="State">
              <input
                onChange={(event) => updateSection("venue", { state: event.target.value })}
                style={inputStyle()}
                value={draft.venue.state}
              />
            </Field>
            <Field label="ZIP code">
              <input
                onChange={(event) => updateSection("venue", { postalCode: event.target.value })}
                style={inputStyle()}
                value={draft.venue.postalCode}
              />
            </Field>
            <Field label="Indoor or outdoor">
              <select
                onChange={(event) =>
                  updateSection("venue", {
                    indoorOutdoor: event.target.value as RfqDraft["venue"]["indoorOutdoor"],
                  })
                }
                style={inputStyle()}
                value={draft.venue.indoorOutdoor}
              >
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
                <option value="mixed">Mixed</option>
              </select>
            </Field>
            <Field label="Venue allows food trucks/outside catering">
              <select
                onChange={(event) =>
                  updateSection("venue", {
                    allowsFoodTrucks: event.target.value as RfqDraft["venue"]["allowsFoodTrucks"],
                  })
                }
                style={inputStyle()}
                value={draft.venue.allowsFoodTrucks}
              >
                <option value="unknown">Unknown</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </Field>
            <Field label="Onsite contact name">
              <input
                onChange={(event) =>
                  updateSection("venue", { onsiteContactName: event.target.value })
                }
                style={inputStyle()}
                value={draft.venue.onsiteContactName}
              />
            </Field>
            <Field label="Onsite contact phone">
              <input
                onChange={(event) =>
                  updateSection("venue", { onsiteContactPhone: event.target.value })
                }
                style={inputStyle()}
                value={draft.venue.onsiteContactPhone}
              />
            </Field>
          </div>
          <div style={gridStyle()}>
            <Field
              helper="Where can the truck park and where will guests queue?"
              label="Truck parking location"
            >
              <input
                onChange={(event) =>
                  updateSection("venue", { truckParkingLocation: event.target.value })
                }
                style={inputStyle()}
                value={draft.venue.truckParkingLocation}
              />
            </Field>
            <Field label="Parking or residence notes">
              <textarea
                onChange={(event) => updateSection("venue", { parkingNotes: event.target.value })}
                rows={3}
                style={inputStyle()}
                value={draft.venue.parkingNotes}
              />
            </Field>
            <Field label="Surface type">
              <input
                onChange={(event) => updateSection("venue", { surfaceType: event.target.value })}
                placeholder="street, lot, grass, loading dock"
                style={inputStyle()}
                value={draft.venue.surfaceType}
              />
            </Field>
            <Field label="Distance from truck to guests in feet">
              <input
                min="0"
                onChange={(event) =>
                  updateSection("venue", {
                    estimatedDistanceFromTruckToGuestsFeet: event.target.value,
                  })
                }
                style={inputStyle()}
                type="number"
                value={draft.venue.estimatedDistanceFromTruckToGuestsFeet}
              />
            </Field>
            <Field label="Setup access time">
              <input
                onChange={(event) =>
                  updateSection("venue", { setupAccessTime: event.target.value })
                }
                style={inputStyle()}
                type="time"
                value={draft.venue.setupAccessTime}
              />
            </Field>
            <Field label="Required departure time">
              <input
                onChange={(event) => updateSection("venue", { departureTime: event.target.value })}
                style={inputStyle()}
                type="time"
                value={draft.venue.departureTime}
              />
            </Field>
          </div>
          <div style={gridStyle()}>
            <Field label="Power available">
              <select
                onChange={(event) =>
                  updateSection("venue", {
                    powerAvailable: event.target.value as RfqDraft["venue"]["powerAvailable"],
                  })
                }
                style={inputStyle()}
                value={draft.venue.powerAvailable}
              >
                <option value="unknown">Unknown</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </Field>
            <Field label="Power type">
              <input
                onChange={(event) => updateSection("venue", { powerType: event.target.value })}
                placeholder="standard outlet, 20 amp, 30 amp, 50 amp"
                style={inputStyle()}
                value={draft.venue.powerType}
              />
            </Field>
            <Field label="Generator allowed">
              <select
                onChange={(event) =>
                  updateSection("venue", {
                    generatorAllowed: event.target.value as RfqDraft["venue"]["generatorAllowed"],
                  })
                }
                style={inputStyle()}
                value={draft.venue.generatorAllowed}
              >
                <option value="unknown">Unknown</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </Field>
            <Field label="Permit responsibility">
              <input
                onChange={(event) =>
                  updateSection("venue", { permitResponsibility: event.target.value })
                }
                placeholder="customer, vendor, venue, unknown"
                style={inputStyle()}
                value={draft.venue.permitResponsibility}
              />
            </Field>
            <Field label="Weather backup plan">
              <textarea
                onChange={(event) =>
                  updateSection("venue", { weatherBackupPlan: event.target.value })
                }
                rows={3}
                style={inputStyle()}
                value={draft.venue.weatherBackupPlan}
              />
            </Field>
            <Field label="Venue restrictions">
              <textarea
                onChange={(event) =>
                  updateSection("venue", { restrictionDescription: event.target.value })
                }
                rows={3}
                style={inputStyle()}
                value={draft.venue.restrictionDescription}
              />
            </Field>
          </div>
          <div style={gridStyle()}>
            {venueBooleanFields.map(({ label, name }) => (
              <label key={name} style={{ alignItems: "center", display: "flex", gap: 8 }}>
                <input
                  checked={Boolean(draft.venue[name])}
                  onChange={boolInput("venue", name)}
                  type="checkbox"
                />
                {label}
              </label>
            ))}
          </div>
        </Panel>
      ) : null}

      {step === 3 ? (
        <Panel title="Service Style and Guest Flow">
          <p>
            Operators quote differently for organizer-paid service, guest-pay vending, buffets,
            drop-off, and tight corporate lunch windows.
          </p>
          <div style={gridStyle()}>
            <Field label="Desired service style">
              <select
                onChange={(event) =>
                  updateSection("serviceStyle", { desiredServiceStyle: event.target.value })
                }
                style={inputStyle()}
                value={draft.serviceStyle.desiredServiceStyle}
              >
                {serviceStyles.map((serviceStyle) => (
                  <option key={serviceStyle}>{serviceStyle}</option>
                ))}
              </select>
            </Field>
            <Field label="Meal period">
              <select
                onChange={(event) =>
                  updateSection("serviceStyle", { mealPeriod: event.target.value })
                }
                style={inputStyle()}
                value={draft.serviceStyle.mealPeriod}
              >
                {mealPeriods.map((mealPeriod) => (
                  <option key={mealPeriod}>{mealPeriod}</option>
                ))}
              </select>
            </Field>
            <Field label="Service start time">
              <input
                onChange={(event) =>
                  updateSection("serviceStyle", { serviceStartTime: event.target.value })
                }
                style={inputStyle()}
                type="time"
                value={draft.serviceStyle.serviceStartTime}
              />
            </Field>
            <Field label="Service end time">
              <input
                onChange={(event) =>
                  updateSection("serviceStyle", { serviceEndTime: event.target.value })
                }
                style={inputStyle()}
                type="time"
                value={draft.serviceStyle.serviceEndTime}
              />
            </Field>
            <Field label="Guest payment model">
              <select
                onChange={(event) =>
                  updateSection("serviceStyle", { guestPaymentModel: event.target.value })
                }
                style={inputStyle()}
                value={draft.serviceStyle.guestPaymentModel}
              >
                {paymentModels.map((paymentModel) => (
                  <option key={paymentModel}>{paymentModel}</option>
                ))}
              </select>
            </Field>
            <Field label="Guest arrival pattern">
              <input
                onChange={(event) =>
                  updateSection("serviceStyle", { guestArrivalPattern: event.target.value })
                }
                placeholder="all at once, staggered, shifts, open house"
                style={inputStyle()}
                value={draft.serviceStyle.guestArrivalPattern}
              />
            </Field>
            <Field label="Desired meals served per hour">
              <input
                min="1"
                onChange={(event) =>
                  updateSection("serviceStyle", { desiredMealsPerHour: event.target.value })
                }
                style={inputStyle()}
                type="number"
                value={draft.serviceStyle.desiredMealsPerHour}
              />
            </Field>
            <Field label="Service points requested">
              <input
                min="1"
                onChange={(event) =>
                  updateSection("serviceStyle", { servicePointsRequested: event.target.value })
                }
                style={inputStyle()}
                type="number"
                value={draft.serviceStyle.servicePointsRequested}
              />
            </Field>
          </div>
          <div style={gridStyle()}>
            {serviceBooleanFields.map(({ label, name }) => (
              <label key={name} style={{ alignItems: "center", display: "flex", gap: 8 }}>
                <input
                  checked={Boolean(draft.serviceStyle[name])}
                  onChange={boolInput("serviceStyle", name)}
                  type="checkbox"
                />
                {label}
              </label>
            ))}
          </div>
        </Panel>
      ) : null}

      {step === 4 ? (
        <Panel title="Cuisine, Menu, and Food Requirements">
          <p>
            Menu preferences help chefs propose practical packages. Allergy information is separated
            because dietary preferences and allergy-safe preparation are not the same thing.
          </p>
          <div style={gridStyle()}>
            <Field
              helper="Comma-separated. Example: tacos, BBQ, vendor recommendation."
              label="Cuisine preferences"
            >
              <input
                onChange={(event) =>
                  updateSection("foodRequirements", { cuisinesText: event.target.value })
                }
                style={inputStyle()}
                value={draft.foodRequirements.cuisinesText}
              />
            </Field>
            <Field label="Menu preference">
              <select
                onChange={(event) =>
                  updateSection("foodRequirements", { menuPreference: event.target.value })
                }
                style={inputStyle()}
                value={draft.foodRequirements.menuPreference}
              >
                <option>Use vendor recommendation</option>
                <option>Choose from sample menu</option>
                <option>Custom menu request</option>
                <option>Limited event menu</option>
                <option>Package pricing</option>
                <option>Per-person pricing</option>
                <option>A la carte pricing</option>
              </select>
            </Field>
            <Field label="Spice level">
              <input
                onChange={(event) =>
                  updateSection("foodRequirements", { spiceLevel: event.target.value })
                }
                style={inputStyle()}
                value={draft.foodRequirements.spiceLevel}
              />
            </Field>
            <Field label="Must-have dishes">
              <input
                onChange={(event) =>
                  updateSection("foodRequirements", { mustHaveDishesText: event.target.value })
                }
                style={inputStyle()}
                value={draft.foodRequirements.mustHaveDishesText}
              />
            </Field>
            <Field label="Dishes to avoid">
              <input
                onChange={(event) =>
                  updateSection("foodRequirements", { dishesToAvoidText: event.target.value })
                }
                style={inputStyle()}
                value={draft.foodRequirements.dishesToAvoidText}
              />
            </Field>
          </div>
          <CheckboxGroup
            legend="Meal components requested"
            onChange={(values) => updateSection("foodRequirements", { mealComponents: values })}
            options={mealComponentOptions}
            values={draft.foodRequirements.mealComponents}
          />
          <CheckboxGroup
            legend="Dietary accommodations"
            onChange={(values) =>
              updateSection("foodRequirements", { dietaryAccommodations: values })
            }
            options={dietaryOptions}
            values={draft.foodRequirements.dietaryAccommodations}
          />
          <div style={gridStyle()}>
            <Field label="Vegetarian count">
              <input
                min="0"
                onChange={(event) =>
                  updateSection("foodRequirements", { vegetarianCount: event.target.value })
                }
                style={inputStyle()}
                type="number"
                value={draft.foodRequirements.vegetarianCount}
              />
            </Field>
            <Field label="Vegan count">
              <input
                min="0"
                onChange={(event) =>
                  updateSection("foodRequirements", { veganCount: event.target.value })
                }
                style={inputStyle()}
                type="number"
                value={draft.foodRequirements.veganCount}
              />
            </Field>
            <Field label="Gluten-free count">
              <input
                min="0"
                onChange={(event) =>
                  updateSection("foodRequirements", { glutenFreeCount: event.target.value })
                }
                style={inputStyle()}
                type="number"
                value={draft.foodRequirements.glutenFreeCount}
              />
            </Field>
            <Field label="Dairy-free count">
              <input
                min="0"
                onChange={(event) =>
                  updateSection("foodRequirements", { dairyFreeCount: event.target.value })
                }
                style={inputStyle()}
                type="number"
                value={draft.foodRequirements.dairyFreeCount}
              />
            </Field>
          </div>
          <div style={gridStyle()}>
            {foodBooleanFields.map(({ label, name }) => (
              <label key={name} style={{ alignItems: "center", display: "flex", gap: 8 }}>
                <input
                  checked={Boolean(draft.foodRequirements[name])}
                  onChange={(event) =>
                    updateSection("foodRequirements", { [name]: event.target.checked } as Partial<
                      RfqDraft["foodRequirements"]
                    >)
                  }
                  type="checkbox"
                />
                {label}
              </label>
            ))}
          </div>
          <div style={gridStyle()}>
            <Field label="Allergy notes">
              <textarea
                onChange={(event) =>
                  updateSection("foodRequirements", { allergyNotes: event.target.value })
                }
                rows={3}
                style={inputStyle()}
                value={draft.foodRequirements.allergyNotes}
              />
            </Field>
            <Field label="Other allergy notes">
              <textarea
                onChange={(event) =>
                  updateSection("foodRequirements", { otherAllergyNotes: event.target.value })
                }
                rows={3}
                style={inputStyle()}
                value={draft.foodRequirements.otherAllergyNotes}
              />
            </Field>
          </div>
        </Panel>
      ) : null}

      {step === 5 ? (
        <Panel title="Rentals, Equipment, and Service Supplies">
          <p>
            Customers often assume serviceware, tables, tents, generators, or trash handling are
            included. Operators need those assumptions clarified before quoting.
          </p>
          <div style={gridStyle()}>
            <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
              <input
                checked={draft.equipment.expectsVendorServiceware}
                onChange={boolInput("equipment", "expectsVendorServiceware")}
                type="checkbox"
              />
              Expect vendor to provide serviceware
            </label>
            <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
              <input
                checked={draft.equipment.expectsVendorTablesOrTenting}
                onChange={boolInput("equipment", "expectsVendorTablesOrTenting")}
                type="checkbox"
              />
              Expect vendor to provide tables or tenting
            </label>
          </div>
          <CheckboxGroup
            legend="Requested supplies or rentals"
            onChange={(values) => updateSection("equipment", { requestedItems: values })}
            options={equipmentOptions}
            values={draft.equipment.requestedItems}
          />
          <div style={gridStyle()}>
            <Field label="Equipment notes">
              <textarea
                onChange={(event) =>
                  updateSection("equipment", { requestNotes: event.target.value })
                }
                rows={3}
                style={inputStyle()}
                value={draft.equipment.requestNotes}
              />
            </Field>
            <Field label="Who handles trash cleanup?">
              <textarea
                onChange={(event) =>
                  updateSection("equipment", { trashCleanup: event.target.value })
                }
                rows={3}
                style={inputStyle()}
                value={draft.equipment.trashCleanup}
              />
            </Field>
          </div>
        </Panel>
      ) : null}

      {step === 6 ? (
        <Panel title="Budget, Pricing Expectations, and Payment Timing">
          <p>
            Budget range helps vendors design a realistic package without forcing them into a final
            price before reviewing menu, staffing, travel, and rentals.
          </p>
          <div style={gridStyle()}>
            <Field label="Minimum budget">
              <input
                min="0"
                onChange={(event) =>
                  updateSection("budget", { budgetMinDollars: event.target.value })
                }
                placeholder="1500"
                style={inputStyle()}
                type="number"
                value={draft.budget.budgetMinDollars}
              />
            </Field>
            <Field label="Maximum budget">
              <input
                min="0"
                onChange={(event) =>
                  updateSection("budget", { budgetMaxDollars: event.target.value })
                }
                placeholder="3000"
                style={inputStyle()}
                type="number"
                value={draft.budget.budgetMaxDollars}
              />
            </Field>
            <Field label="Budget flexibility">
              <select
                onChange={(event) =>
                  updateSection("budget", { budgetFlexibility: event.target.value })
                }
                style={inputStyle()}
                value={draft.budget.budgetFlexibility}
              >
                <option>Flexible for the right fit</option>
                <option>Firm budget cap</option>
                <option>Can adjust menu to fit budget</option>
                <option>Need vendor guidance</option>
              </select>
            </Field>
            <Field label="Who is paying?">
              <select
                onChange={(event) => updateSection("budget", { payer: event.target.value })}
                style={inputStyle()}
                value={draft.budget.payer}
              >
                {paymentModels.map((paymentModel) => (
                  <option key={paymentModel}>{paymentModel}</option>
                ))}
              </select>
            </Field>
            <Field label="Deposit readiness">
              <select
                onChange={(event) =>
                  updateSection("budget", { depositReadiness: event.target.value })
                }
                style={inputStyle()}
                value={draft.budget.depositReadiness}
              >
                <option>Ready once quote is accepted</option>
                <option>Ready this week</option>
                <option>Need internal approval</option>
                <option>Not sure yet</option>
              </select>
            </Field>
            <Field label="Quote response deadline date">
              <input
                onChange={(event) =>
                  updateSection("budget", { quoteResponseDeadlineDate: event.target.value })
                }
                style={inputStyle()}
                type="date"
                value={draft.budget.quoteResponseDeadlineDate}
              />
            </Field>
            <Field label="Quote response deadline time">
              <input
                onChange={(event) =>
                  updateSection("budget", { quoteResponseDeadlineTime: event.target.value })
                }
                style={inputStyle()}
                type="time"
                value={draft.budget.quoteResponseDeadlineTime}
              />
            </Field>
            <Field label="Desired deposit date">
              <input
                onChange={(event) =>
                  updateSection("budget", { desiredDepositDate: event.target.value })
                }
                style={inputStyle()}
                type="date"
                value={draft.budget.desiredDepositDate}
              />
            </Field>
            <Field label="Final payment preference">
              <input
                onChange={(event) =>
                  updateSection("budget", { finalPaymentPreference: event.target.value })
                }
                style={inputStyle()}
                value={draft.budget.finalPaymentPreference}
              />
            </Field>
            <Field label="Corporate billing contact">
              <input
                onChange={(event) =>
                  updateSection("budget", { corporateBillingContact: event.target.value })
                }
                style={inputStyle()}
                value={draft.budget.corporateBillingContact}
              />
            </Field>
          </div>
          <div style={gridStyle()}>
            {budgetBooleanFields.map(({ label, name }) => (
              <label key={name} style={{ alignItems: "center", display: "flex", gap: 8 }}>
                <input
                  checked={Boolean(draft.budget[name])}
                  onChange={(event) =>
                    updateSection("budget", { [name]: event.target.checked } as Partial<
                      RfqDraft["budget"]
                    >)
                  }
                  type="checkbox"
                />
                {label}
              </label>
            ))}
          </div>
        </Panel>
      ) : null}

      {step === 7 ? (
        <Panel title="Attachments and Special Notes">
          <p>
            Attachment upload is metadata-only in the current backend. Add file names and categories
            now so vendors can see what supporting documents exist.
          </p>
          <Field label="Special notes">
            <textarea
              onChange={(event) => updateDraft("specialNotes", event.target.value)}
              rows={5}
              style={inputStyle()}
              value={draft.specialNotes}
            />
          </Field>
          <div style={{ display: "grid", gap: 12 }}>
            <button onClick={addAttachment} type="button">
              Add attachment metadata
            </button>
            {draft.attachments.map((attachment, index) => (
              <section
                key={index}
                style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}
              >
                <div style={gridStyle()}>
                  <Field label="File name">
                    <input
                      onChange={(event) =>
                        updateAttachment(index, { fileName: event.target.value })
                      }
                      style={inputStyle()}
                      value={attachment.fileName}
                    />
                  </Field>
                  <Field label="Category">
                    <input
                      onChange={(event) =>
                        updateAttachment(index, { category: event.target.value })
                      }
                      style={inputStyle()}
                      value={attachment.category}
                    />
                  </Field>
                  <Field label="Content type">
                    <input
                      onChange={(event) =>
                        updateAttachment(index, { contentType: event.target.value })
                      }
                      style={inputStyle()}
                      value={attachment.contentType}
                    />
                  </Field>
                  <Field label="Size in MB">
                    <input
                      min="0"
                      onChange={(event) => updateAttachment(index, { sizeMb: event.target.value })}
                      style={inputStyle()}
                      type="number"
                      value={attachment.sizeMb}
                    />
                  </Field>
                </div>
                <Field label="Attachment notes">
                  <textarea
                    onChange={(event) => updateAttachment(index, { notes: event.target.value })}
                    rows={2}
                    style={inputStyle()}
                    value={attachment.notes}
                  />
                </Field>
                <button onClick={() => removeAttachment(index)} type="button">
                  Remove attachment
                </button>
              </section>
            ))}
          </div>
        </Panel>
      ) : null}

      {step === 8 ? (
        <Panel title="Review and Submit">
          <section
            style={{
              background: "rgba(135, 221, 247, 0.12)",
              border: "1px solid rgba(135, 221, 247, 0.3)",
              borderRadius: 14,
              marginBottom: 14,
              padding: 14,
            }}
          >
            <p style={{ fontWeight: 700, margin: "0 0 8px" }}>
              Create your free account to submit your request and receive quotes from food trucks.
            </p>
            <AuthSessionPanel requireCustomer session={session} title="Customer Account" />
          </section>
          <p>
            Review the event packet before submission. Operators will see completeness, risk flags,
            vendor targets, and structured sections rather than a loose message thread.
          </p>
          {warnings.length > 0 ? (
            <section style={{ background: "#fff4df", borderRadius: 12, padding: 14 }}>
              <h3 style={{ marginTop: 0 }}>Operational flags</h3>
              <ul>
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          ) : null}
          <dl
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <SummaryLine label="Request type" value={draft.requestType} />
            <SummaryLine
              label="Target vendors"
              value={parseTargetVendorIds(draft).join(", ") || "Matching vendors"}
            />
            <SummaryLine
              label="Event"
              value={`${draft.eventBasics.eventName || "Untitled"} (${draft.eventBasics.eventType})`}
            />
            <SummaryLine
              label="Date and time"
              value={`${draft.eventBasics.eventDate} ${draft.eventBasics.startTime}-${draft.eventBasics.endTime}`}
            />
            <SummaryLine
              label="Headcount"
              value={draft.eventBasics.estimatedHeadcount || "Not entered"}
            />
            <SummaryLine
              label="Venue"
              value={`${draft.venue.venueName || "Venue TBD"}, ${draft.venue.city || "city TBD"}, ${draft.venue.state || "state TBD"}`}
            />
            <SummaryLine
              label="Service"
              value={`${draft.serviceStyle.desiredServiceStyle}, ${draft.serviceStyle.serviceStartTime}-${draft.serviceStyle.serviceEndTime}`}
            />
            <SummaryLine
              label="Cuisine"
              value={listFromText(draft.foodRequirements.cuisinesText).join(", ") || "Not entered"}
            />
            <SummaryLine
              label="Budget"
              value={`${moneyLabel(centsFromDollars(draft.budget.budgetMinDollars))} - ${moneyLabel(
                centsFromDollars(draft.budget.budgetMaxDollars),
              )}`}
            />
            <SummaryLine label="Attachments" value={draft.attachments.length} />
          </dl>
          <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
            <input
              checked={draft.review.quoteAcknowledged}
              onChange={boolInput("review", "quoteAcknowledged")}
              type="checkbox"
            />
            I understand this is a quote request and pricing is not final until a vendor responds.
          </label>
          <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
            <input
              checked={draft.review.communicationAcknowledged}
              onChange={boolInput("review", "communicationAcknowledged")}
              type="checkbox"
            />
            I understand vendors may ask clarification questions before sending a quote.
          </label>
          <details>
            <summary>Preview backend payload</summary>
            <pre style={{ background: "#f6f6f6", overflowX: "auto", padding: 12 }}>
              {JSON.stringify(previewPayload, null, 2)}
            </pre>
          </details>
        </Panel>
      ) : null}

      {submitError ? (
        <section style={{ background: "#ffe8e8", borderRadius: 14, padding: 16 }}>
          <strong>Submit failed:</strong> {submitError}
        </section>
      ) : null}

      <footer
        style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={step === 0} onClick={handleBack} type="button">
            Back
          </button>
          <button onClick={handleNext} type="button">
            {step === steps.length - 1 ? "Validate review" : "Next"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
              setSubmitError(
                "Draft saved locally in this browser. Backend draft persistence is deferred.",
              );
            }}
            type="button"
          >
            Save local draft
          </button>
          <button disabled={isSubmitting || step !== steps.length - 1} type="submit">
            {isSubmitting ? "Submitting..." : "Submit RFQ"}
          </button>
        </div>
      </footer>
    </form>
  );
}
