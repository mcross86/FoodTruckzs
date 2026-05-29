import { formatRfqNumber, rfqPublicIdentifier } from "@foodtruckzs/shared";

export type RfqApiRequest = {
  apiBaseUrl: string;
  body?: unknown;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  path: string;
  token?: string;
};

export type RfqApiResult<T> = {
  body: unknown;
  data: T | null;
  ok: boolean;
  status: number;
};

export type CreateRfqPayload = {
  attachments: {
    category: string;
    contentType?: string;
    fileName: string;
    notes?: string;
    sizeBytes?: number;
  }[];
  budget: {
    balanceMayBeCollectedOnsite?: boolean;
    budgetFlexibility: string;
    budgetMaxCents?: number;
    budgetMinCents?: number;
    corporateBillingContact?: string;
    depositReadiness: string;
    desiredDepositDate?: string;
    finalPaymentPreference?: string;
    invoiceOrReceiptNeeded?: boolean;
    payer: string;
    purchaseOrderRequired?: boolean;
    quoteResponseDeadline?: string;
    taxExempt?: boolean;
  };
  equipment: {
    expectsVendorServiceware: boolean;
    expectsVendorTablesOrTenting: boolean;
    requests: {
      item: string;
      notes?: string;
      quantity?: number;
      required: boolean;
    }[];
    trashCleanup: string;
  };
  eventBasics: {
    ageMix?: string;
    customerType: string;
    endsAt: string;
    eventName: string;
    eventType: string;
    eventWebsiteUrl?: string;
    estimatedHeadcount: number;
    isOpenToPublic: boolean;
    isRecurring: boolean;
    primaryContact: {
      email: string;
      name: string;
      phone: string;
    };
    startsAt: string;
    timezone: string;
  };
  foodRequirements: {
    allergyNotes?: string;
    buffetLabelsRequired?: boolean;
    crossContaminationSensitive?: boolean;
    cuisinePreferences: string[];
    dairyFreeCount?: number;
    dietaryAccommodations: string[];
    dishesToAvoid: string[];
    glutenFreeCount?: number;
    individuallyPackagedMeals?: boolean;
    mealComponents: string[];
    menuPreference: string;
    mustHaveDishes: string[];
    nutFreeRequired?: boolean;
    otherAllergyNotes?: string;
    shellfishAllergy?: boolean;
    spiceLevel?: string;
    veganCount?: number;
    vegetarianCount?: number;
  };
  serviceStyle: {
    cashierNeeded?: boolean;
    cleanupStaffNeeded?: boolean;
    desiredMealsPerHour?: number;
    desiredServiceStyle: string;
    guestArrivalPattern?: string;
    guestPaymentModel: string;
    mealPeriod: string;
    menuSignageNeeded?: boolean;
    orderAheadNeeded?: boolean;
    serviceEndsAt: string;
    servicePointsRequested?: number;
    serviceStartsAt: string;
    servingStaffNeeded?: boolean;
  };
  specialNotes?: string;
  targetVendorIds: string[];
  venue: {
    additionalInsuredRequired?: boolean;
    allowsFoodTrucks?: boolean;
    businessLicenseRequired?: boolean;
    canRemainOnsite?: boolean;
    city: string;
    coiRequired?: boolean;
    country: string;
    departureTime?: string;
    estimatedDistanceFromTruckToGuestsFeet?: number;
    fireInspectionRequired?: boolean;
    gateOrSecurityInstructions?: string;
    generatorAllowed?: boolean;
    greaseDisposalExpectations?: string;
    healthPermitRequired?: boolean;
    indoorOutdoor: "indoor" | "mixed" | "outdoor";
    line1: string;
    line2?: string;
    loadInInstructions?: string;
    noiseRestrictions?: string;
    onsiteContactName: string;
    onsiteContactPhone: string;
    openFlameRestrictions?: string;
    parkingNotes?: string;
    permitResponsibility?: string;
    postalCode?: string;
    powerAvailable?: boolean;
    powerType?: string;
    restrictionDescription?: string;
    restroomAccessForStaff?: boolean;
    setupAccessTime?: string;
    spaceAvailableForTruckAndLine?: boolean;
    state: string;
    surfaceIsLevel?: boolean;
    surfaceType?: string;
    truckParkingLocation?: string;
    venueName: string;
    wasteDisposalAvailable?: boolean;
    waterAccessAvailable?: boolean;
    weatherBackupPlan?: string;
  };
};

export type RfqDetail = {
  address: {
    city: string;
    country: string;
    line1: string;
    line2: string | null;
    postalCode: string | null;
    state: string;
  } | null;
  attachments: Record<string, unknown>[];
  completenessScore: number;
  completenessStatus: "complete" | "logistics_incomplete" | "needs_review";
  event: {
    endsAt: string;
    estimatedHeadcount: number;
    eventName: string;
    eventType: string;
    indoorOutdoor: string;
    startsAt: string;
    timezone: string;
  };
  messages: {
    attachmentFileId: string | null;
    body: string | null;
    createdAt: string;
    id: string;
    senderUserId: string;
    status: string;
    threadId: string;
  }[];
  requirements: Record<string, Record<string, unknown>>;
  rfqId: string;
  rfqNumber: number;
  riskFlags: {
    code: string;
    label: string;
    severity: "high" | "info" | "warning";
  }[];
  status: string;
  statusHistory: {
    createdAt: string;
    fromStatus: string | null;
    reason: string | null;
    toStatus: string;
  }[];
  threads: {
    customerUserId: string;
    id: string;
    lastMessageAt: string | null;
    lastMessageId: string | null;
    rfqId: string;
    status: string;
    unreadCount: number;
    vendorId: string;
  }[];
  unreadMessageCount: number;
  vendorTargets: {
    id: string;
    rejectedReason: string | null;
    respondedAt: string | null;
    status: string;
    vendor: {
      businessName: string;
      cateringMinimumCents: number | null;
      id: string;
      slug: string;
    };
  }[];
};

export type QuoteLineItemPayload = {
  description?: string;
  isInternal?: boolean;
  isOptional?: boolean;
  name: string;
  quantity: number;
  taxable?: boolean;
  type:
    | "discount"
    | "fee"
    | "food"
    | "gratuity"
    | "rental"
    | "service"
    | "service_charge"
    | "staffing"
    | "tax"
    | "travel"
    | "overtime";
  unit?: string;
  unitAmountCents: number;
};

export type QuoteWritePayload = {
  assumptions: string[];
  cancellationPolicySummary?: string;
  depositRequiredCents: number;
  exclusions: string[];
  expiresAt: string;
  lineItems: QuoteLineItemPayload[];
  menuSummary: string;
  notes?: string;
  paymentSchedule: {
    amountCents: number;
    dueAt?: string;
    label: string;
    type: "deposit" | "final_balance" | "invoice" | "milestone" | "onsite";
  }[];
  serviceStyle: string;
  vendorId?: string;
};

export type QuoteDetail = {
  agreement?: AgreementDetail | null;
  currentRevision: QuoteRevision;
  quote: {
    currentRevisionId: string;
    depositRequiredCents: number;
    expiresAt: string;
    feesCents: number;
    id: string;
    rfqId: string;
    status: string;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    vendorId: string;
  };
  revisions: QuoteRevision[];
  rfq: {
    customerUserId: string;
    eventName: string;
    estimatedHeadcount: number;
    id: string;
    startsAt: string;
    status: string;
  };
  vendor: {
    businessName: string;
    id: string;
    slug: string;
  };
};

export type AgreementDetail = {
  agreement: {
    currentVersionId: string | null;
    documentFileId: string | null;
    generatedAt: string | null;
    id: string;
    rfqId: string;
    signedAt: string | null;
    signedDocumentFileId: string | null;
    status: string;
    vendorId: string;
  };
  currentVersion: AgreementVersion | null;
  nextPaymentAction: {
    amountCents: number;
    dueAt: string | null;
    label: string;
    paymentScheduleItemId: string;
    type: "deposit_required" | "payment_collection_deferred";
  } | null;
  platformFee: {
    feeAmountCents: number;
    feePercentageBasisPoints: number;
    id: string;
    status: string;
  } | null;
  quote: {
    id: string;
    revisionId: string;
    revisionNumber: number;
    totalCents: number;
  };
  rfq: {
    customerUserId: string;
    eventName: string;
    id: string;
    status: string;
  };
  signatures: {
    id: string;
    signedAt: string;
    signedDocumentFileId: string | null;
    signerRole: string;
    signerUserId: string;
    typedName: string;
  }[];
  vendor: {
    businessName: string;
    id: string;
    slug: string;
  };
  versions: AgreementVersion[];
};

export type AgreementVersion = {
  createdAt: string;
  documentFileId: string | null;
  id: string;
  termsSnapshot: Record<string, unknown>;
  versionNumber: number;
};

export type AgreementDownloadUrl = {
  agreementId: string;
  downloadUrl: string;
  expiresAt: string;
  fileId: string | null;
  storageProvider: "stub";
};

export type PaymentDetail = {
  attempts: {
    amountCents: number;
    completedAt: string | null;
    failureCode: string | null;
    failureMessage: string | null;
    id: string;
    status: string;
    stripeCheckoutSessionId: string | null;
    stripePaymentIntentId: string | null;
  }[];
  checkoutUrl: string | null;
  payment: {
    amountCents: number;
    currency: string;
    id: string;
    status: string;
    stripeCheckoutSessionId: string | null;
    stripePaymentIntentId: string | null;
    type: string;
  };
  scheduleItem: {
    amountCents: number;
    dueAt: string | null;
    id: string;
    label: string;
    status: string;
    type: string;
  } | null;
};

export type VendorPaymentSummary = {
  payments: (PaymentDetail & {
    agreementId: string;
    eventName: string;
    rfqId: string;
  })[];
  stripeAccount: {
    accountId: string | null;
    chargesEnabled: boolean;
    detailsSubmitted: boolean;
    disabledReason: string | null;
    payoutsEnabled: boolean;
    readyForPayments: boolean;
  };
  vendorId: string;
};

export type StripeOnboardingLink = {
  onboardingUrl: string;
  stripeAccount: VendorPaymentSummary["stripeAccount"];
};

export type CalendarWarning = {
  code: string;
  eventIds: string[];
  isHard: boolean;
  message: string;
  severity: "conflict" | "warning";
};

export type CalendarEvent = {
  cateringEventId: string | null;
  endsAt: string;
  id: string;
  isBlocking: boolean;
  location: string | null;
  notes: string | null;
  source: string;
  startsAt: string;
  status: string;
  title: string;
  type: string;
  warnings: CalendarWarning[];
};

export type CalendarView = {
  events: CalendarEvent[];
  groups: {
    date: string;
    eventIds: string[];
  }[];
  range: {
    startsFrom: string;
    startsTo: string;
  };
  vendorId: string;
  view: "agenda" | "day" | "month" | "timeline" | "week";
  warnings: CalendarWarning[];
};

export type EventOperationsDetail = {
  agreedMenu: {
    lineItems: {
      description: string | null;
      name: string;
      quantity: number;
      totalAmountCents: number;
      type: string;
      unit: string;
    }[];
    menuSummary: string | null;
    serviceStyle: unknown;
  };
  calendarEvent: CalendarEvent;
  contacts: {
    customer: Record<string, unknown> | null;
    onsite: {
      name: string | null;
      phone: string | null;
    };
  };
  documents: {
    agreementDownloadPath: string | null;
    agreementId: string | null;
    currentVersionId: string | null;
    documentFileId: string | null;
    signedDocumentFileId: string | null;
  };
  equipmentChecklist: {
    item: string;
    notes: string | null;
    quantity: number | null;
    required: boolean;
    status: "pending";
  }[];
  internalNotes: string | null;
  paymentStatus: {
    paidCents: number;
    payments: {
      amountCents: number;
      id: string;
      status: string;
      type: string;
    }[];
    schedule: {
      amountCents: number;
      dueAt: string | null;
      id: string;
      label: string;
      paidAt: string | null;
      status: string;
      type: string;
    }[];
    totalCents: number;
  };
  prepNotes: string[];
  runSheetStatus: "confirmed_catering" | "manual_event";
  staffingNotes: string[];
  venueLogistics: {
    address: {
      city: string;
      country: string;
      line1: string;
      line2: string | null;
      postalCode: string | null;
      state: string;
    } | null;
    details: Record<string, unknown>;
    eventEndsAt: string;
    eventStartsAt: string;
    guestCount: number | null;
    serviceWindow: {
      endsAt: unknown;
      startsAt: unknown;
    };
  };
  warnings: CalendarWarning[];
};

export type QuoteRevision = {
  assumptions: string[];
  cancellationPolicySummary: string | null;
  createdAt: string;
  depositRequiredCents: number;
  exclusions: string[];
  expiresAt: string;
  feesCents: number;
  id: string;
  lineItems: {
    description: string | null;
    id: string;
    isInternal: boolean;
    isOptional: boolean;
    name: string;
    quantity: number;
    taxable: boolean;
    totalAmountCents: number;
    type: string;
    unit: string;
    unitAmountCents: number;
  }[];
  menuSummary: string | null;
  notes: string | null;
  paymentSchedule: {
    amountCents: number;
    dueAt: string | null;
    id: string;
    label: string;
    status: string;
    type: string;
  }[];
  revisionNumber: number;
  serviceStyle: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

type ApiEnvelope<T> = {
  data?: T;
};

export const defaultRfqApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function endpoint(apiBaseUrl: string, path: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}${path}`;
}

export async function rfqApiRequest<T>(request: RfqApiRequest): Promise<RfqApiResult<T>> {
  const headers = new Headers({
    accept: "application/json",
  });

  if (request.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  if (request.token?.trim()) {
    headers.set("authorization", `Bearer ${request.token.trim()}`);
  }

  for (const [key, value] of Object.entries(request.headers ?? {})) {
    headers.set(key, value);
  }

  const response = await fetch(endpoint(request.apiBaseUrl, request.path), {
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
    headers,
    method: request.method ?? "GET",
  });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  const data =
    body && typeof body === "object" && "data" in body
      ? ((body as ApiEnvelope<T>).data ?? null)
      : null;

  return {
    body,
    data,
    ok: response.ok,
    status: response.status,
  };
}

export function moneyLabel(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return "Not listed";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}

export function statusLabel(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export { formatRfqNumber };

/** URL path segment for an RFQ (prefers public RFQ number). */
export function rfqLinkIdentifier(rfq: { rfqId: string; rfqNumber?: number }): string {
  if (typeof rfq.rfqNumber === "number" && rfq.rfqNumber > 0) {
    return rfqPublicIdentifier({ rfqNumber: rfq.rfqNumber });
  }

  return rfq.rfqId;
}
