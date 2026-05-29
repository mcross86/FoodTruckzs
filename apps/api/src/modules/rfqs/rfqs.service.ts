import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
} from "../../shared/errors/app-error.js";
import type { RequestContext } from "../../shared/middleware/request-context.js";
import type {
  AcceptRfqTargetDto,
  CreateRfqDto,
  MarkThreadReadDto,
  RejectRfqTargetDto,
  RequestClarificationDto,
  RfqListQueryDto,
  SendThreadMessageDto,
} from "./rfqs.dto.js";
import type {
  RfqCandidateVendorRecord,
  RfqDetailRecord,
  RfqRepository,
  RfqTargetRecord,
} from "./rfqs.repository.js";
import { assertRfqTransition, RFQ_STATUSES, type RfqStatus } from "./rfq-state-machine.js";

type RfqTargetStatus = RfqDetailRecord["targets"][number]["target"]["status"];
type MessageThreadRecord = RfqDetailRecord["threads"][number];

type RiskFlag = {
  code: string;
  label: string;
  severity: "info" | "warning" | "high";
};

type RfqServiceResult = {
  address: RfqDetailRecord["address"];
  attachments: Record<string, unknown>[];
  completenessScore: number;
  completenessStatus: "complete" | "needs_review" | "logistics_incomplete";
  event: {
    endsAt: Date;
    estimatedHeadcount: number;
    eventName: string;
    eventType: string;
    indoorOutdoor: string;
    startsAt: Date;
    timezone: string;
  };
  messages: {
    attachmentFileId: string | null;
    body: string | null;
    createdAt: Date;
    id: string;
    senderUserId: string;
    status: string;
    threadId: string;
  }[];
  requirements: Record<string, Record<string, unknown>>;
  riskFlags: RiskFlag[];
  rfqId: string;
  rfqNumber: number;
  status: RfqStatus;
  statusHistory: {
    createdAt: Date;
    fromStatus: RfqStatus | null;
    reason: string | null;
    toStatus: RfqStatus;
  }[];
  vendorTargets: {
    id: string;
    rejectedReason: string | null;
    respondedAt: Date | null;
    status: RfqTargetStatus;
    vendor: {
      businessName: string;
      cateringMinimumCents: number | null;
      id: string;
      slug: string;
    };
  }[];
  threads: {
    customerUserId: string;
    id: string;
    lastMessageAt: Date | null;
    lastMessageId: string | null;
    rfqId: string;
    status: string;
    unreadCount: number;
    vendorId: string;
  }[];
  unreadMessageCount: number;
};

type ThreadMessagesResult = {
  messages: RfqServiceResult["messages"];
  thread: RfqServiceResult["threads"][number];
};

export type RfqService = {
  acceptTarget: (
    ctx: RequestContext,
    rfqId: string,
    targetId: string,
    input: AcceptRfqTargetDto,
  ) => Promise<RfqServiceResult>;
  createRfq: (ctx: RequestContext, input: CreateRfqDto) => Promise<RfqServiceResult>;
  getRfqDetail: (ctx: RequestContext, rfqId: string) => Promise<RfqServiceResult>;
  getThreadMessages: (ctx: RequestContext, threadId: string) => Promise<ThreadMessagesResult>;
  listCustomerRfqs: (ctx: RequestContext, query: RfqListQueryDto) => Promise<RfqServiceResult[]>;
  listVendorRfqs: (
    ctx: RequestContext,
    vendorId: string,
    query: RfqListQueryDto,
  ) => Promise<RfqServiceResult[]>;
  rejectTarget: (
    ctx: RequestContext,
    rfqId: string,
    targetId: string,
    input: RejectRfqTargetDto,
  ) => Promise<RfqServiceResult>;
  requestClarification: (
    ctx: RequestContext,
    rfqId: string,
    input: RequestClarificationDto,
  ) => Promise<RfqServiceResult>;
  markThreadRead: (
    ctx: RequestContext,
    threadId: string,
    input: MarkThreadReadDto,
  ) => Promise<RfqServiceResult>;
  sendThreadMessage: (
    ctx: RequestContext,
    threadId: string,
    input: SendThreadMessageDto,
  ) => Promise<RfqServiceResult>;
};

export type RfqServiceDeps = {
  repository: RfqRepository;
};

const minimumLeadTimeDays = 7;

function now(): Date {
  return new Date();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function includesNormalized(value: string | null | undefined, query: string): boolean {
  return value !== null && value !== undefined && normalize(value).includes(query);
}

function isRfqStatus(value: string | undefined): value is RfqStatus {
  return value !== undefined && RFQ_STATUSES.includes(value as RfqStatus);
}

function assertAuthenticatedCustomer(ctx: RequestContext): string {
  if (!ctx.userId) {
    throw new AuthorizationError("Customer authentication is required.");
  }

  if (!ctx.globalRoles.includes("customer")) {
    throw new AuthorizationError("Customer role is required.");
  }

  return ctx.userId;
}

function isAdmin(ctx: RequestContext): boolean {
  return ctx.globalRoles.includes("platform_admin") || ctx.globalRoles.includes("support_admin");
}

function canReadVendor(ctx: RequestContext, vendorId: string): boolean {
  return ctx.vendorMemberships.some(
    (membership) => membership.vendorId === vendorId && membership.status === "active",
  );
}

function canActForVendor(ctx: RequestContext, vendorId: string): boolean {
  return ctx.vendorMemberships.some(
    (membership) =>
      membership.vendorId === vendorId &&
      membership.status === "active" &&
      membership.role !== "viewer",
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function assertCreationBusinessRules(input: CreateRfqDto, currentTime = now()): void {
  const startsAt = new Date(input.eventBasics.startsAt);
  const endsAt = new Date(input.eventBasics.endsAt);
  const serviceStartsAt = new Date(input.serviceStyle.serviceStartsAt);
  const serviceEndsAt = new Date(input.serviceStyle.serviceEndsAt);

  if (startsAt.getTime() < addDays(currentTime, minimumLeadTimeDays).getTime()) {
    throw new BusinessRuleError("Event date must satisfy the 7-day minimum booking lead time.");
  }

  if (startsAt.getTime() >= endsAt.getTime()) {
    throw new BusinessRuleError("Event start time must be before event end time.");
  }

  if (serviceStartsAt.getTime() >= serviceEndsAt.getTime()) {
    throw new BusinessRuleError("Service start time must be before service end time.");
  }

  if (
    serviceStartsAt.getTime() < startsAt.getTime() ||
    serviceEndsAt.getTime() > endsAt.getTime()
  ) {
    throw new BusinessRuleError("Service window must fall within the event window.");
  }

  if (
    input.budget.quoteResponseDeadline &&
    new Date(input.budget.quoteResponseDeadline).getTime() >= startsAt.getTime()
  ) {
    throw new BusinessRuleError("Quote response deadline must be before the event starts.");
  }
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
}

function vendorHasBlackout(record: RfqCandidateVendorRecord, input: CreateRfqDto): boolean {
  const startsAt = new Date(input.eventBasics.startsAt);
  const endsAt = new Date(input.eventBasics.endsAt);

  return record.availabilityExceptions.some(
    (exception) =>
      exception.type === "blackout" &&
      !record.operatingSettings?.requestAnywayOnBlackout &&
      overlaps(startsAt, endsAt, exception.startsAt, exception.endsAt),
  );
}

function serviceAreaMatches(record: RfqCandidateVendorRecord, input: CreateRfqDto): boolean {
  if (record.serviceAreas.length === 0) {
    return true;
  }

  const venueCity = normalize(input.venue.city);
  const venueState = normalize(input.venue.state);

  return record.serviceAreas.some((area) => {
    if (normalize(area.state) !== venueState) {
      return false;
    }

    return (
      includesNormalized(area.city, venueCity) ||
      includesNormalized(area.metroArea, venueCity) ||
      includesNormalized(area.postalCode, normalize(input.venue.postalCode ?? ""))
    );
  });
}

function cuisineMatches(record: RfqCandidateVendorRecord, input: CreateRfqDto): boolean {
  if (input.foodRequirements.cuisinePreferences.length === 0) {
    return true;
  }

  const cuisineQueries = input.foodRequirements.cuisinePreferences.map(normalize);
  return record.cuisines.some((cuisine) =>
    cuisineQueries.some(
      (query) =>
        normalize(cuisine.id) === query ||
        normalize(cuisine.slug) === query ||
        normalize(cuisine.name).includes(query),
    ),
  );
}

function serviceStyleMatches(record: RfqCandidateVendorRecord, input: CreateRfqDto): boolean {
  const query = normalize(input.serviceStyle.desiredServiceStyle);
  const styles = record.profile?.serviceStyles ?? [];

  if (styles.length === 0) {
    return true;
  }

  return styles.some(
    (style) => normalize(style).includes(query) || query.includes(normalize(style)),
  );
}

function headcountFits(record: RfqCandidateVendorRecord, input: CreateRfqDto): boolean {
  const minimumGuestCount = record.operatingSettings?.minimumGuestCount;
  return minimumGuestCount === null || minimumGuestCount === undefined
    ? true
    : input.eventBasics.estimatedHeadcount >= minimumGuestCount;
}

function budgetFits(record: RfqCandidateVendorRecord, input: CreateRfqDto): boolean {
  return (
    input.budget.budgetMaxCents === undefined ||
    record.vendor.cateringMinimumCents === null ||
    record.vendor.cateringMinimumCents <= input.budget.budgetMaxCents
  );
}

function rankCandidate(record: RfqCandidateVendorRecord, input: CreateRfqDto): number {
  let score = 0;

  if (serviceAreaMatches(record, input)) score += 40;
  if (cuisineMatches(record, input)) score += 25;
  if (serviceStyleMatches(record, input)) score += 20;
  if (headcountFits(record, input)) score += 10;
  if (budgetFits(record, input)) score += 5;

  return score;
}

function filterGeneralMatches(
  records: RfqCandidateVendorRecord[],
  input: CreateRfqDto,
): RfqCandidateVendorRecord[] {
  return records
    .filter((record) => serviceAreaMatches(record, input))
    .filter((record) => cuisineMatches(record, input))
    .filter((record) => serviceStyleMatches(record, input))
    .filter((record) => headcountFits(record, input))
    .filter((record) => budgetFits(record, input))
    .filter((record) => !vendorHasBlackout(record, input))
    .sort((left, right) => {
      const scoreDelta = rankCandidate(right, input) - rankCandidate(left, input);
      return scoreDelta === 0
        ? left.vendor.businessName.localeCompare(right.vendor.businessName)
        : scoreDelta;
    })
    .slice(0, 8);
}

function createRequirementRows(input: CreateRfqDto, rfqId: string) {
  return [
    {
      details: {
        ageMix: input.eventBasics.ageMix,
        customerType: input.eventBasics.customerType,
        eventWebsiteUrl: input.eventBasics.eventWebsiteUrl,
        isOpenToPublic: input.eventBasics.isOpenToPublic,
        isRecurring: input.eventBasics.isRecurring,
        primaryContact: input.eventBasics.primaryContact,
      },
      label: "event_basics",
      rfqId,
      type: "other" as const,
    },
    {
      details: input.venue,
      label: "venue_logistics",
      rfqId,
      type: "other" as const,
    },
    {
      details: input.serviceStyle,
      label: "service_style",
      rfqId,
      type: "service" as const,
    },
    {
      details: input.foodRequirements,
      label: "food_requirements",
      rfqId,
      type: "food" as const,
    },
    {
      details: {
        ...input.foodRequirements,
        dietaryAccommodations: input.foodRequirements.dietaryAccommodations,
      },
      label: "dietary_requirements",
      rfqId,
      type: "dietary" as const,
    },
    {
      details: input.equipment,
      label: "equipment",
      rfqId,
      type: "equipment" as const,
    },
    {
      details: input.budget,
      label: "budget",
      rfqId,
      type: "other" as const,
    },
    {
      details: {
        attachments: input.attachments,
        specialNotes: input.specialNotes,
      },
      label: "attachments_and_notes",
      rfqId,
      type: "other" as const,
    },
  ];
}

function sectionsFor(record: RfqDetailRecord): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    record.requirements.map((requirement) => [requirement.label, requirement.details]),
  );
}

function section<T extends Record<string, unknown>>(
  sections: Record<string, Record<string, unknown>>,
  label: string,
): T {
  return (sections[label] ?? {}) as T;
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== null && value !== undefined && value !== "";
}

function serviceDurationMinutes(sections: Record<string, Record<string, unknown>>): number | null {
  const service = section<{ serviceEndsAt?: string; serviceStartsAt?: string }>(
    sections,
    "service_style",
  );

  if (!service.serviceStartsAt || !service.serviceEndsAt) {
    return null;
  }

  return Math.round(
    (new Date(service.serviceEndsAt).getTime() - new Date(service.serviceStartsAt).getTime()) /
      60_000,
  );
}

function completenessFor(record: RfqDetailRecord): {
  score: number;
  status: RfqServiceResult["completenessStatus"];
} {
  const sections = sectionsFor(record);
  const event = section<{ primaryContact?: Record<string, unknown> }>(sections, "event_basics");
  const venue = section<Record<string, unknown>>(sections, "venue_logistics");
  const service = section<Record<string, unknown>>(sections, "service_style");
  const food = section<Record<string, unknown>>(sections, "food_requirements");
  const equipment = section<Record<string, unknown>>(sections, "equipment");
  const budget = section<Record<string, unknown>>(sections, "budget");
  const durationMinutes = serviceDurationMinutes(sections);
  const checks = [
    hasValue(record.rfq.eventName) &&
      hasValue(record.rfq.eventType) &&
      hasValue(record.rfq.startsAt) &&
      hasValue(record.rfq.endsAt) &&
      hasValue(event.primaryContact),
    record.address !== null && hasValue(record.address.line1) && hasValue(record.address.city),
    hasValue(venue.truckParkingLocation) || hasValue(venue.parkingNotes),
    typeof venue.powerAvailable === "boolean" && typeof venue.generatorAllowed === "boolean",
    record.rfq.estimatedHeadcount > 0,
    hasValue(service.desiredServiceStyle),
    durationMinutes !== null && durationMinutes >= 60,
    hasValue(food.cuisinePreferences) && hasValue(food.menuPreference),
    hasValue(food.dietaryAccommodations) || hasValue(food.allergyNotes),
    typeof budget.budgetMinCents === "number" || typeof budget.budgetMaxCents === "number",
    typeof equipment.expectsVendorServiceware === "boolean" &&
      typeof equipment.expectsVendorTablesOrTenting === "boolean",
    typeof venue.coiRequired === "boolean" || hasValue(venue.permitResponsibility),
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  if (score >= 85) {
    return { score, status: "complete" };
  }
  if (!checks[2] || !checks[3] || !checks[11]) {
    return { score, status: "logistics_incomplete" };
  }
  return { score, status: "needs_review" };
}

function pushRisk(flags: RiskFlag[], code: string, label: string, severity: RiskFlag["severity"]) {
  if (!flags.some((flag) => flag.code === code)) {
    flags.push({ code, label, severity });
  }
}

function riskFlagsFor(record: RfqDetailRecord, visibleTargets: RfqTargetRecord[]): RiskFlag[] {
  const sections = sectionsFor(record);
  const event = section<{ isOpenToPublic?: boolean }>(sections, "event_basics");
  const venue = section<Record<string, unknown>>(sections, "venue_logistics");
  const food = section<Record<string, unknown>>(sections, "food_requirements");
  const durationMinutes = serviceDurationMinutes(sections);
  const flags: RiskFlag[] = [];

  if (durationMinutes !== null && durationMinutes < 60) {
    pushRisk(flags, "service_window_too_short", "Service window is under 60 minutes.", "high");
  }

  const mealsPerHour =
    durationMinutes && durationMinutes > 0
      ? (record.rfq.estimatedHeadcount / durationMinutes) * 60
      : null;

  if (mealsPerHour !== null && mealsPerHour > 100) {
    pushRisk(flags, "throughput_risk", "Headcount is high for the service window.", "warning");
  }

  if (venue.allowsFoodTrucks !== true) {
    pushRisk(
      flags,
      "venue_truck_allowance_unconfirmed",
      "Venue has not confirmed food trucks or outside catering.",
      "warning",
    );
  }

  if (!hasValue(venue.truckParkingLocation) && !hasValue(venue.parkingNotes)) {
    pushRisk(flags, "parking_unknown", "Truck parking details are missing.", "warning");
  }

  if (venue.powerAvailable === false && venue.generatorAllowed === false) {
    pushRisk(
      flags,
      "power_unavailable_generator_not_allowed",
      "Power is unavailable and generators are not allowed.",
      "high",
    );
  }

  if (event.isOpenToPublic && !hasValue(venue.permitResponsibility)) {
    pushRisk(flags, "public_event_permit_required", "Permit responsibility is unknown.", "warning");
  }

  if (
    hasValue(food.allergyNotes) ||
    food.nutFreeRequired === true ||
    food.shellfishAllergy === true ||
    food.crossContaminationSensitive === true
  ) {
    pushRisk(
      flags,
      "allergy_sensitive",
      "Allergy-sensitive food requirements need review.",
      "high",
    );
  }

  if (record.rfq.indoorOutdoor === "outdoor" && !hasValue(venue.weatherBackupPlan)) {
    pushRisk(
      flags,
      "weather_backup_missing",
      "Outdoor event is missing a weather backup plan.",
      "warning",
    );
  }

  if (venue.coiRequired === true) {
    pushRisk(flags, "coi_required", "Certificate of insurance is required.", "info");
  }

  for (const target of visibleTargets) {
    if (
      record.rfq.budgetMaxCents !== null &&
      target.vendor.cateringMinimumCents !== null &&
      record.rfq.budgetMaxCents < target.vendor.cateringMinimumCents
    ) {
      pushRisk(
        flags,
        "budget_below_vendor_minimum",
        "Budget is below a targeted vendor minimum.",
        "high",
      );
    }
  }

  return flags;
}

function visibleTargetsFor(record: RfqDetailRecord, ctx: RequestContext): RfqTargetRecord[] {
  if (isAdmin(ctx) || record.rfq.customerUserId === ctx.userId) {
    return record.targets;
  }

  return record.targets.filter((target) => canReadVendor(ctx, target.vendor.id));
}

function canReadThread(thread: MessageThreadRecord, ctx: RequestContext): boolean {
  return (
    isAdmin(ctx) || thread.customerUserId === ctx.userId || canReadVendor(ctx, thread.vendorId)
  );
}

function canSendThreadMessage(thread: MessageThreadRecord, ctx: RequestContext): boolean {
  return thread.customerUserId === ctx.userId || canActForVendor(ctx, thread.vendorId);
}

function visibleThreadsFor(record: RfqDetailRecord, ctx: RequestContext): MessageThreadRecord[] {
  return record.threads.filter((thread) => canReadThread(thread, ctx));
}

function readStateFor(record: RfqDetailRecord, threadId: string, userId: string | undefined) {
  if (!userId) {
    return undefined;
  }

  return record.readStates.find(
    (readState) => readState.threadId === threadId && readState.userId === userId,
  );
}

function unreadCountFor(
  record: RfqDetailRecord,
  thread: MessageThreadRecord,
  ctx: RequestContext,
): number {
  if (!ctx.userId) {
    return 0;
  }

  const readState = readStateFor(record, thread.id, ctx.userId);
  const readAt = readState?.readAt;

  return record.messages.filter(
    (message) =>
      message.threadId === thread.id &&
      message.status === "visible" &&
      message.deletedAt === null &&
      message.senderUserId !== ctx.userId &&
      (!readAt || message.createdAt.getTime() > readAt.getTime()),
  ).length;
}

function threadToResult(
  record: RfqDetailRecord,
  thread: MessageThreadRecord,
  ctx: RequestContext,
): RfqServiceResult["threads"][number] {
  return {
    customerUserId: thread.customerUserId,
    id: thread.id,
    lastMessageAt: thread.lastMessageAt,
    lastMessageId: thread.lastMessageId,
    rfqId: thread.rfqId,
    status: thread.status,
    unreadCount: unreadCountFor(record, thread, ctx),
    vendorId: thread.vendorId,
  };
}

function assertCanRead(record: RfqDetailRecord, ctx: RequestContext): void {
  if (isAdmin(ctx) || record.rfq.customerUserId === ctx.userId) {
    return;
  }

  if (record.targets.some((target) => canReadVendor(ctx, target.vendor.id))) {
    return;
  }

  throw new AuthorizationError("You are not authorized to view this RFQ.");
}

function toServiceResult(record: RfqDetailRecord, ctx: RequestContext): RfqServiceResult {
  const visibleTargets = visibleTargetsFor(record, ctx);
  const sections = sectionsFor(record);
  const completeness = completenessFor(record);
  const attachmentSection = section<{ attachments?: Record<string, unknown>[] }>(
    sections,
    "attachments_and_notes",
  );
  const visibleThreads = visibleThreadsFor(record, ctx);
  const visibleThreadIds = new Set(visibleThreads.map((thread) => thread.id));
  const threads = visibleThreads.map((thread) => threadToResult(record, thread, ctx));

  return {
    address: record.address,
    attachments: attachmentSection.attachments ?? [],
    completenessScore: completeness.score,
    completenessStatus: completeness.status,
    event: {
      endsAt: record.rfq.endsAt,
      estimatedHeadcount: record.rfq.estimatedHeadcount,
      eventName: record.rfq.eventName,
      eventType: record.rfq.eventType,
      indoorOutdoor: record.rfq.indoorOutdoor,
      startsAt: record.rfq.startsAt,
      timezone: record.rfq.timezone,
    },
    messages: record.messages
      .filter(
        (message) =>
          visibleThreadIds.has(message.threadId) &&
          message.status === "visible" &&
          message.deletedAt === null,
      )
      .map((message) => ({
        attachmentFileId: message.attachmentFileId,
        body: message.body,
        createdAt: message.createdAt,
        id: message.id,
        senderUserId: message.senderUserId,
        status: message.status,
        threadId: message.threadId,
      })),
    requirements: sections,
    riskFlags: riskFlagsFor(record, visibleTargets),
    rfqId: record.rfq.id,
    rfqNumber: record.rfq.rfqNumber,
    status: record.rfq.status,
    statusHistory: record.statusHistory.map((history) => ({
      createdAt: history.createdAt,
      fromStatus: history.fromStatus,
      reason: history.reason,
      toStatus: history.toStatus,
    })),
    vendorTargets: visibleTargets.map(({ target, vendor }) => ({
      id: target.id,
      rejectedReason: target.rejectedReason,
      respondedAt: target.respondedAt,
      status: target.status,
      vendor: {
        businessName: vendor.businessName,
        cateringMinimumCents: vendor.cateringMinimumCents,
        id: vendor.id,
        slug: vendor.slug,
      },
    })),
    threads,
    unreadMessageCount: threads.reduce((sum, thread) => sum + thread.unreadCount, 0),
  };
}

async function reloadDetail(repository: RfqRepository, rfqId: string): Promise<RfqDetailRecord> {
  const detail = await repository.findRfqDetailById(rfqId);

  if (detail === null) {
    throw new NotFoundError("RFQ was not found.");
  }

  return detail;
}

async function reloadThread(
  repository: RfqRepository,
  threadId: string,
): Promise<MessageThreadRecord> {
  const thread = await repository.findThreadById(threadId);

  if (thread === null) {
    throw new NotFoundError("Message thread was not found.");
  }

  return thread;
}

function messagesForThread(
  record: RfqDetailRecord,
  threadId: string,
): RfqServiceResult["messages"] {
  return record.messages
    .filter(
      (message) =>
        message.threadId === threadId && message.status === "visible" && message.deletedAt === null,
    )
    .map((message) => ({
      attachmentFileId: message.attachmentFileId,
      body: message.body,
      createdAt: message.createdAt,
      id: message.id,
      senderUserId: message.senderUserId,
      status: message.status,
      threadId: message.threadId,
    }));
}

async function writeStatusTransition(
  repository: RfqRepository,
  record: RfqDetailRecord,
  toStatus: RfqStatus,
  ctx: RequestContext,
  reason: string,
): Promise<RfqDetailRecord> {
  if (record.rfq.status === toStatus) {
    return record;
  }

  assertRfqTransition(record.rfq.status, toStatus);
  const changedAt = now();
  await repository.updateRfqStatus(record.rfq.id, toStatus, changedAt);
  await repository.createStatusHistory({
    actorUserId: ctx.userId,
    fromStatus: record.rfq.status,
    metadata: {},
    reason,
    rfqId: record.rfq.id,
    toStatus,
  });

  return reloadDetail(repository, record.rfq.id);
}

function validTargetStatus(value: string | undefined): value is RfqTargetStatus {
  return (
    value === "invited" ||
    value === "viewed" ||
    value === "accepted" ||
    value === "rejected" ||
    value === "quote_sent" ||
    value === "expired" ||
    value === "cancelled"
  );
}

export function createRfqService(deps: RfqServiceDeps): RfqService {
  const { repository } = deps;

  async function resolveTargetVendors(input: CreateRfqDto): Promise<RfqCandidateVendorRecord[]> {
    const targetVendorIds = unique(input.targetVendorIds);

    if (targetVendorIds.length > 0) {
      const candidates = await repository.findCandidateVendorRecordsByIds(targetVendorIds);
      const foundIds = new Set(candidates.map((candidate) => candidate.vendor.id));
      const missingIds = targetVendorIds.filter((vendorId) => !foundIds.has(vendorId));

      if (missingIds.length > 0) {
        throw new BusinessRuleError("One or more selected vendors are not available for RFQs.", {
          missingVendorIds: missingIds,
        });
      }

      return candidates;
    }

    const candidates = await repository.listCandidateVendorRecords();
    const matches = filterGeneralMatches(candidates, input);

    if (matches.length === 0) {
      throw new BusinessRuleError("No eligible vendors matched this RFQ.");
    }

    return matches;
  }

  async function transitionToVendorReviewIfNeeded(
    repo: RfqRepository,
    detail: RfqDetailRecord,
    ctx: RequestContext,
  ): Promise<RfqDetailRecord> {
    if (detail.rfq.status === "submitted" || detail.rfq.status === "clarification_requested") {
      return writeStatusTransition(
        repo,
        detail,
        "vendor_reviewing",
        ctx,
        "Vendor began RFQ review.",
      );
    }

    if (detail.rfq.status !== "vendor_reviewing") {
      throw new BusinessRuleError("RFQ is not open for vendor review.");
    }

    return detail;
  }

  async function findActionableTarget(
    ctx: RequestContext,
    rfqId: string,
    targetId: string,
  ): Promise<RfqTargetRecord> {
    const target = await repository.findVendorTargetById(rfqId, targetId);

    if (target === null) {
      throw new NotFoundError("RFQ target was not found.");
    }

    if (!canActForVendor(ctx, target.vendor.id)) {
      throw new AuthorizationError("You are not authorized to act for this RFQ target.");
    }

    return target;
  }

  return {
    async createRfq(ctx, input) {
      const customerUserId = assertAuthenticatedCustomer(ctx);
      assertCreationBusinessRules(input);
      const targetVendors = await resolveTargetVendors(input);

      const rfq = await repository.transaction(async (repo) => {
        const address = await repo.createAddress({
          city: input.venue.city,
          country: input.venue.country,
          line1: input.venue.line1,
          line2: input.venue.line2,
          postalCode: input.venue.postalCode,
          state: input.venue.state,
          timezone: input.eventBasics.timezone,
        });
        const createdRfq = await repo.createRfq({
          budgetMaxCents: input.budget.budgetMaxCents,
          budgetMinCents: input.budget.budgetMinCents,
          customerUserId,
          endsAt: new Date(input.eventBasics.endsAt),
          estimatedHeadcount: input.eventBasics.estimatedHeadcount,
          eventName: input.eventBasics.eventName,
          eventType: input.eventBasics.eventType,
          indoorOutdoor: input.venue.indoorOutdoor,
          quoteResponseDeadline: input.budget.quoteResponseDeadline
            ? new Date(input.budget.quoteResponseDeadline)
            : undefined,
          startsAt: new Date(input.eventBasics.startsAt),
          status: "submitted",
          timezone: input.eventBasics.timezone,
          venueAddressId: address.id,
        });

        await repo.createRequirements(createRequirementRows(input, createdRfq.id));
        await repo.createVendorTargets(
          targetVendors.map((vendorRecord) => ({
            rfqId: createdRfq.id,
            status: "invited",
            vendorId: vendorRecord.vendor.id,
          })),
        );
        await repo.createMessageThreads(
          targetVendors.map((vendorRecord) => ({
            customerUserId,
            rfqId: createdRfq.id,
            status: "open",
            vendorId: vendorRecord.vendor.id,
          })),
        );
        await repo.createStatusHistory({
          actorUserId: customerUserId,
          fromStatus: null,
          metadata: {
            targetVendorIds: targetVendors.map((vendorRecord) => vendorRecord.vendor.id),
          },
          reason: "RFQ submitted.",
          rfqId: createdRfq.id,
          toStatus: "submitted",
        });
        await repo.createAuditLog({
          action: "rfq.submitted",
          actorRole: "customer",
          actorUserId: customerUserId,
          entityId: createdRfq.id,
          entityType: "rfq",
          ipAddress: ctx.ipAddress,
          newState: { status: "submitted" },
          requestId: ctx.requestId,
          userAgent: ctx.userAgent,
        });
        await repo.createOutboxEvent({
          aggregateId: createdRfq.id,
          aggregateType: "rfq",
          eventType: "rfq.submitted",
          payload: {
            customerUserId,
            rfqId: createdRfq.id,
            targetVendorIds: targetVendors.map((vendorRecord) => vendorRecord.vendor.id),
          },
          requestId: ctx.requestId,
          status: "pending",
        });

        return createdRfq;
      });
      const detail = await reloadDetail(repository, rfq.id);
      return toServiceResult(detail, ctx);
    },

    async getRfqDetail(ctx, rfqId) {
      const detail = await reloadDetail(repository, rfqId);
      assertCanRead(detail, ctx);
      return toServiceResult(detail, ctx);
    },

    async getThreadMessages(ctx, threadId) {
      const thread = await reloadThread(repository, threadId);
      const detail = await reloadDetail(repository, thread.rfqId);

      if (!canReadThread(thread, ctx)) {
        throw new AuthorizationError("You are not authorized to view this message thread.");
      }

      return {
        messages: messagesForThread(detail, thread.id),
        thread: threadToResult(detail, thread, ctx),
      };
    },

    async listCustomerRfqs(ctx, query) {
      const customerUserId = assertAuthenticatedCustomer(ctx);
      const status = isRfqStatus(query.status) ? query.status : undefined;
      const records = await repository.listCustomerRfqDetails(customerUserId, status);
      return records.slice(0, query.limit).map((record) => toServiceResult(record, ctx));
    },

    async listVendorRfqs(ctx, vendorId, query) {
      if (!canReadVendor(ctx, vendorId)) {
        throw new AuthorizationError("Vendor membership is required.");
      }

      const targetStatus = validTargetStatus(query.targetStatus) ? query.targetStatus : undefined;
      const records = await repository.listVendorRfqDetails(vendorId, targetStatus);
      return records.slice(0, query.limit).map((record) => toServiceResult(record, ctx));
    },

    async acceptTarget(ctx, rfqId, targetId, input) {
      const target = await findActionableTarget(ctx, rfqId, targetId);
      let detail = await reloadDetail(repository, rfqId);
      assertCanRead(detail, ctx);

      if (target.target.status === "accepted") {
        return toServiceResult(detail, ctx);
      }

      if (target.target.status !== "invited" && target.target.status !== "viewed") {
        throw new BusinessRuleError("RFQ target cannot be accepted from its current status.");
      }

      detail = await repository.transaction(async (repo) => {
        const currentDetail = await reloadDetail(repo, rfqId);
        await transitionToVendorReviewIfNeeded(repo, currentDetail, ctx);
        await repo.updateVendorTarget(
          targetId,
          {
            respondedAt: now(),
            status: "accepted",
          },
          now(),
        );
        await repo.createAuditLog({
          action: "rfq_target.accepted",
          actorRole: "vendor_user",
          actorUserId: ctx.userId,
          entityId: rfqId,
          entityType: "rfq",
          ipAddress: ctx.ipAddress,
          newState: { note: input.note, targetId, targetStatus: "accepted" },
          requestId: ctx.requestId,
          userAgent: ctx.userAgent,
          vendorId: target.vendor.id,
        });
        return reloadDetail(repo, rfqId);
      });

      return toServiceResult(detail, ctx);
    },

    async rejectTarget(ctx, rfqId, targetId, input) {
      const target = await findActionableTarget(ctx, rfqId, targetId);
      const detail = await reloadDetail(repository, rfqId);
      assertCanRead(detail, ctx);

      if (target.target.status === "rejected") {
        return toServiceResult(detail, ctx);
      }

      if (target.target.status !== "invited" && target.target.status !== "viewed") {
        throw new BusinessRuleError("RFQ target cannot be rejected from its current status.");
      }

      const updatedDetail = await repository.transaction(async (repo) => {
        await repo.updateVendorTarget(
          targetId,
          {
            rejectedReason: input.reasonCode,
            respondedAt: now(),
            status: "rejected",
          },
          now(),
        );
        await repo.createAuditLog({
          action: "rfq_target.rejected",
          actorRole: "vendor_user",
          actorUserId: ctx.userId,
          entityId: rfqId,
          entityType: "rfq",
          ipAddress: ctx.ipAddress,
          newState: { note: input.note, reasonCode: input.reasonCode, targetId },
          requestId: ctx.requestId,
          userAgent: ctx.userAgent,
          vendorId: target.vendor.id,
        });
        return reloadDetail(repo, rfqId);
      });

      return toServiceResult(updatedDetail, ctx);
    },

    async requestClarification(ctx, rfqId, input) {
      const detail = await reloadDetail(repository, rfqId);
      const target = detail.targets.find((candidate) => canActForVendor(ctx, candidate.vendor.id));

      if (!target) {
        throw new AuthorizationError(
          "You are not authorized to request clarification for this RFQ.",
        );
      }

      const updatedDetail = await repository.transaction(async (repo) => {
        const currentDetail = await transitionToVendorReviewIfNeeded(
          repo,
          await reloadDetail(repo, rfqId),
          ctx,
        );

        if (currentDetail.rfq.status !== "clarification_requested") {
          await writeStatusTransition(
            repo,
            currentDetail,
            "clarification_requested",
            ctx,
            "Vendor requested clarification.",
          );
        }

        if (target.target.status === "invited") {
          await repo.updateVendorTarget(target.target.id, { status: "viewed" }, now());
        }

        const thread = await repo.findThreadByRfqVendor(rfqId, target.vendor.id);

        if (!thread) {
          throw new NotFoundError("RFQ message thread was not found.");
        }

        const message = await repo.createMessage({
          body: input.body,
          senderUserId: ctx.userId!,
          status: "visible",
          threadId: thread.id,
        });
        await repo.updateThreadLastMessage(thread.id, message.id, message.createdAt);
        await repo.createOrUpdateThreadReadState({
          lastReadMessageId: message.id,
          readAt: message.createdAt,
          threadId: thread.id,
          userId: ctx.userId!,
        });
        await repo.createAuditLog({
          action: "rfq.clarification_requested",
          actorRole: "vendor_user",
          actorUserId: ctx.userId,
          entityId: rfqId,
          entityType: "rfq",
          ipAddress: ctx.ipAddress,
          newState: { messageId: message.id, status: "clarification_requested" },
          requestId: ctx.requestId,
          userAgent: ctx.userAgent,
          vendorId: target.vendor.id,
        });
        await repo.createOutboxEvent({
          aggregateId: rfqId,
          aggregateType: "rfq",
          eventType: "rfq.clarification_requested",
          payload: {
            messageId: message.id,
            rfqId,
            vendorId: target.vendor.id,
          },
          requestId: ctx.requestId,
          status: "pending",
        });
        return reloadDetail(repo, rfqId);
      });

      return toServiceResult(updatedDetail, ctx);
    },

    async markThreadRead(ctx, threadId, input) {
      if (!ctx.userId) {
        throw new AuthorizationError("Authentication is required to mark a thread read.");
      }

      const thread = await reloadThread(repository, threadId);
      const detail = await reloadDetail(repository, thread.rfqId);

      if (!canReadThread(thread, ctx)) {
        throw new AuthorizationError("You are not authorized to read this message thread.");
      }

      const threadMessages = messagesForThread(detail, thread.id);
      const lastReadMessageId = input.lastReadMessageId ?? threadMessages.at(-1)?.id;

      if (
        input.lastReadMessageId &&
        !threadMessages.some((message) => message.id === input.lastReadMessageId)
      ) {
        throw new BusinessRuleError("Last read message must belong to the message thread.");
      }

      await repository.createOrUpdateThreadReadState({
        lastReadMessageId,
        readAt: now(),
        threadId: thread.id,
        userId: ctx.userId,
      });

      return toServiceResult(await reloadDetail(repository, thread.rfqId), ctx);
    },

    async sendThreadMessage(ctx, threadId, input) {
      if (!ctx.userId) {
        throw new AuthorizationError("Authentication is required to send a message.");
      }

      const thread = await reloadThread(repository, threadId);

      if (!canSendThreadMessage(thread, ctx)) {
        throw new AuthorizationError("You are not authorized to send messages in this thread.");
      }

      const updatedDetail = await repository.transaction(async (repo) => {
        const currentThread = await reloadThread(repo, threadId);
        const currentDetail = await reloadDetail(repo, currentThread.rfqId);

        if (!canSendThreadMessage(currentThread, ctx)) {
          throw new AuthorizationError("You are not authorized to send messages in this thread.");
        }

        if (
          currentThread.customerUserId === ctx.userId &&
          currentDetail.rfq.status === "clarification_requested"
        ) {
          await writeStatusTransition(
            repo,
            currentDetail,
            "vendor_reviewing",
            ctx,
            "Customer responded to clarification.",
          );
        }

        const message = await repo.createMessage({
          body: input.body,
          senderUserId: ctx.userId!,
          status: "visible",
          threadId: currentThread.id,
        });
        await repo.updateThreadLastMessage(currentThread.id, message.id, message.createdAt);
        await repo.createOrUpdateThreadReadState({
          lastReadMessageId: message.id,
          readAt: message.createdAt,
          threadId: currentThread.id,
          userId: ctx.userId!,
        });
        await repo.createAuditLog({
          action: "message.sent",
          actorRole: currentThread.customerUserId === ctx.userId ? "customer" : "vendor_user",
          actorUserId: ctx.userId,
          entityId: currentThread.id,
          entityType: "message_thread",
          ipAddress: ctx.ipAddress,
          newState: { messageId: message.id, rfqId: currentThread.rfqId },
          requestId: ctx.requestId,
          userAgent: ctx.userAgent,
          vendorId: currentThread.vendorId,
        });
        await repo.createOutboxEvent({
          aggregateId: currentThread.id,
          aggregateType: "message_thread",
          eventType: "message.sent",
          payload: {
            customerUserId: currentThread.customerUserId,
            messageId: message.id,
            rfqId: currentThread.rfqId,
            threadId: currentThread.id,
            vendorId: currentThread.vendorId,
          },
          requestId: ctx.requestId,
          status: "pending",
        });

        return reloadDetail(repo, currentThread.rfqId);
      });

      return toServiceResult(updatedDetail, ctx);
    },
  };
}
