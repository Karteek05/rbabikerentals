import { store } from "@/lib/data/store";
import { getSupabaseServiceClient, isSupabaseConfigured } from "@/lib/db/supabase-client";
import type {
  AuditEvent,
  Booking,
  BookingStatus,
  DamageIncident,
  KycRecord,
  KycStatus,
  NotificationJob,
  PaymentEvent,
  PaymentOrder,
  Role,
  User,
  Vehicle,
  VehicleLiveLocation,
  VehicleBlockWindow,
  VehicleDocument
} from "@/lib/types/domain";
import { ApiException } from "@/lib/utils/errors";

type DataMode = "memory" | "supabase";

function getDbErrorDetails(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return { code: undefined, message: "Database request failed." };
  }

  const maybeError = error as { code?: unknown; message?: unknown };
  return {
    code: typeof maybeError.code === "string" ? maybeError.code : undefined,
    message:
      typeof maybeError.message === "string"
        ? maybeError.message
        : "Database request failed."
  };
}

function throwStructuredDbError(error: unknown): never {
  const { code, message } = getDbErrorDetails(error);

  if (code === "23P01" || message.includes("bookings_vehicle_active_window_excl")) {
    throw new ApiException(
      409,
      "vehicle_unavailable",
      "Vehicle already has no free units in the requested time window."
    );
  }

  if (code === "23505" && message.includes("idx_payment_orders_booking_created")) {
    throw new ApiException(
      409,
      "payment_order_exists",
      "An active payment order already exists for this booking."
    );
  }

  throw new ApiException(500, "db_error", "Database request failed.");
}

export function getDataMode(): DataMode {
  if (!isSupabaseConfigured()) {
    const isProduction =
      process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";
    if (isProduction) {
      throw new ApiException(
        500,
        "supabase_not_configured",
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production."
      );
    }
    return "memory";
  }
  return "supabase";
}

export function assertBengaluruCity(city: string) {
  if (city !== "bengaluru") {
    throw new ApiException(
      400,
      "unsupported_city",
      "Phase 1 supports only Bengaluru."
    );
  }
}

function withVehicleDefaults(vehicle: Vehicle): Vehicle {
  return {
    ...vehicle,
    image_urls: vehicle.image_urls ?? []
  };
}

export async function findAppUsersByEmail(email: string): Promise<User[]> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];

  if (getDataMode() === "memory") {
    return store.users.filter(
      (user) => user.email?.trim().toLowerCase() === normalized && !user.deleted_at
    );
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .ilike("email", normalized);
  if (error) throw new ApiException(500, "db_error", error.message);
  return (data ?? []) as User[];
}

const KYC_STATUS_RANK: Record<KycRecord["status"], number> = {
  verified: 5,
  manual_review: 4,
  in_progress: 3,
  not_started: 2,
  failed: 1,
  expired: 0
};

function pickPreferredKycRecord(records: KycRecord[]) {
  return [...records].sort((left, right) => {
    const statusDelta = KYC_STATUS_RANK[right.status] - KYC_STATUS_RANK[left.status];
    if (statusDelta !== 0) return statusDelta;
    const verifiedDelta =
      Number(right.aadhaar_verified) +
      Number(right.dl_verified) -
      (Number(left.aadhaar_verified) + Number(left.dl_verified));
    if (verifiedDelta !== 0) return verifiedDelta;
    return right.updated_at.localeCompare(left.updated_at);
  })[0];
}

function mergeKycRecordsInMemory(
  canonicalUserId: string,
  duplicateIds: string[]
) {
  const duplicateIdSet = new Set(duplicateIds);
  const canonicalKyc = store.kycRecords.find((item) => item.user_id === canonicalUserId);
  const duplicateKycs = store.kycRecords.filter((item) => duplicateIdSet.has(item.user_id));
  if (!duplicateKycs.length) return;

  if (!canonicalKyc) {
    const preferred = pickPreferredKycRecord(duplicateKycs);
    preferred.user_id = canonicalUserId;
    store.kycRecords = store.kycRecords.filter(
      (item) => item.user_id === canonicalUserId || !duplicateIdSet.has(item.user_id)
    );
    return;
  }

  store.kycRecords = store.kycRecords.filter((item) => !duplicateIdSet.has(item.user_id));
}

async function mergeKycRecordsForUserReconcile(
  canonicalUserId: string,
  duplicateIds: string[]
) {
  if (!duplicateIds.length) return;

  const supabase = getSupabaseServiceClient();
  const { data: canonicalKyc, error: canonicalError } = await supabase
    .from("kyc_records")
    .select("*")
    .eq("user_id", canonicalUserId)
    .maybeSingle();
  if (canonicalError) throw new ApiException(500, "db_error", canonicalError.message);

  const { data: duplicateKycs, error: duplicateError } = await supabase
    .from("kyc_records")
    .select("*")
    .in("user_id", duplicateIds);
  if (duplicateError) throw new ApiException(500, "db_error", duplicateError.message);

  const duplicates = (duplicateKycs ?? []) as KycRecord[];
  if (!duplicates.length) return;

  if (!canonicalKyc) {
    const preferred = pickPreferredKycRecord(duplicates);
    const { error: moveError } = await supabase
      .from("kyc_records")
      .update({ user_id: canonicalUserId })
      .eq("user_id", preferred.user_id);
    if (moveError) throw new ApiException(500, "db_error", moveError.message);

    const extraDuplicateIds = duplicates
      .map((item) => item.user_id)
      .filter((userId) => userId !== preferred.user_id);
    if (extraDuplicateIds.length) {
      const { error: deleteError } = await supabase
        .from("kyc_records")
        .delete()
        .in("user_id", extraDuplicateIds);
      if (deleteError) throw new ApiException(500, "db_error", deleteError.message);
    }
    return;
  }

  const { error: deleteError } = await supabase
    .from("kyc_records")
    .delete()
    .in(
      "user_id",
      duplicates.map((item) => item.user_id)
    );
  if (deleteError) throw new ApiException(500, "db_error", deleteError.message);
}

const ROLE_RANK: Record<Role, number> = {
  admin: 3,
  partner_investor: 2,
  customer: 1
};

const USER_KYC_STATUS_RANK: Record<KycStatus, number> = {
  verified: 5,
  manual_review: 4,
  in_progress: 3,
  not_started: 2,
  failed: 1,
  expired: 0
};

function pickPreferredRole(roles: Role[]) {
  return roles.reduce((best, role) => (ROLE_RANK[role] > ROLE_RANK[best] ? role : best));
}

function pickPreferredUserKycStatus(statuses: KycStatus[]) {
  return statuses.reduce((best, status) =>
    USER_KYC_STATUS_RANK[status] > USER_KYC_STATUS_RANK[best] ? status : best
  );
}

function firstPresentValue<T>(values: Array<T | null | undefined>) {
  return values.find((value) => value !== null && value !== undefined && value !== "") ?? null;
}

function mergeDuplicateUserProfiles(canonical: User, duplicates: User[]): User {
  const candidates = [canonical, ...duplicates];
  return {
    ...canonical,
    role: pickPreferredRole(candidates.map((user) => user.role)),
    kyc_status: pickPreferredUserKycStatus(candidates.map((user) => user.kyc_status)),
    name: firstPresentValue(candidates.map((user) => user.name)) ?? canonical.name,
    phone: firstPresentValue(candidates.map((user) => user.phone)),
    pan_number: firstPresentValue(candidates.map((user) => user.pan_number)),
    date_of_birth: firstPresentValue(candidates.map((user) => user.date_of_birth)),
    cibil_consent_at: firstPresentValue(candidates.map((user) => user.cibil_consent_at))
  };
}

function mergeDuplicateProfilesInMemory(canonicalUserId: string, duplicates: User[]) {
  const canonicalIndex = store.users.findIndex((user) => user.id === canonicalUserId);
  if (canonicalIndex < 0) return;
  const canonical = store.users[canonicalIndex];
  store.users[canonicalIndex] = mergeDuplicateUserProfiles(canonical, duplicates);
}

export async function reconcileAppUsersForCanonicalId(
  canonicalUserId: string,
  email: string
) {
  const related = await findAppUsersByEmail(email);
  const duplicateIds = related
    .filter((user) => user.id !== canonicalUserId && !user.deleted_at)
    .map((user) => user.id);

  if (!duplicateIds.length) {
    return { mergedUserIds: [] as string[] };
  }

  const duplicates = related.filter((user) => duplicateIds.includes(user.id));

  if (getDataMode() === "memory") {
    for (const booking of store.bookings) {
      if (duplicateIds.includes(booking.user_id)) {
        booking.user_id = canonicalUserId;
      }
    }
    mergeKycRecordsInMemory(canonicalUserId, duplicateIds);
    mergeDuplicateProfilesInMemory(canonicalUserId, duplicates);
    store.users = store.users.filter((user) => !duplicateIds.includes(user.id));
    return { mergedUserIds: duplicateIds };
  }

  const canonical = await getUserOrThrow(canonicalUserId);
  await upsertUser(mergeDuplicateUserProfiles(canonical, duplicates));

  const supabase = getSupabaseServiceClient();
  const { error: bookingError } = await supabase
    .from("bookings")
    .update({ user_id: canonicalUserId })
    .in("user_id", duplicateIds);
  if (bookingError) throw new ApiException(500, "db_error", bookingError.message);

  await mergeKycRecordsForUserReconcile(canonicalUserId, duplicateIds);

  const { error: deleteError } = await supabase
    .from("app_users")
    .delete()
    .in("id", duplicateIds);
  if (deleteError) throw new ApiException(500, "db_error", deleteError.message);

  return { mergedUserIds: duplicateIds };
}

export async function getUserOrThrow(userId: string): Promise<User> {
  if (getDataMode() === "memory") {
    const user = store.users.find((item) => item.id === userId);
    if (!user) {
      throw new ApiException(404, "user_not_found", "User does not exist.");
    }
    return user;
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new ApiException(500, "db_error", error.message);
  if (!data) throw new ApiException(404, "user_not_found", "User does not exist.");
  return data as User;
}

export async function upsertUser(user: User): Promise<User> {
  if (getDataMode() === "memory") {
    const existingIndex = store.users.findIndex((item) => item.id === user.id);
    if (existingIndex >= 0) {
      store.users[existingIndex] = user;
    } else {
      store.users.push(user);
    }
    return user;
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("app_users")
    .upsert(user, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw new ApiException(500, "db_error", error.message);
  return data as User;
}

export async function anonymizeUserAccount(userId: string): Promise<User> {
  const existing = await getUserOrThrow(userId);
  const anonymized: User = {
    ...existing,
    name: "Deleted account",
    email: null,
    phone: null,
    pan_number: null,
    date_of_birth: null,
    cibil_consent_at: null,
    deleted_at: new Date().toISOString()
  };

  if (getDataMode() === "memory") {
    const existingIndex = store.users.findIndex((item) => item.id === userId);
    if (existingIndex < 0) {
      throw new ApiException(404, "user_not_found", "User does not exist.");
    }
    store.users[existingIndex] = anonymized;
    return anonymized;
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("app_users")
    .update({
      name: anonymized.name,
      email: null,
      phone: null,
      pan_number: null,
      date_of_birth: null,
      cibil_consent_at: null,
      deleted_at: anonymized.deleted_at,
      updated_at: anonymized.deleted_at
    })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw new ApiException(500, "db_error", error.message);

  // Delete the Better Auth user so they can no longer sign in
  const { error: authError } = await supabase
    .from("user")
    .delete()
    .eq("id", userId);
  
  if (authError) {
    console.error("Failed to delete Better Auth user:", authError);
  }

  return data as User;
}

export async function listUsersByIds(userIds: string[]): Promise<User[]> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return [];

  if (getDataMode() === "memory") {
    const include = new Set(ids);
    return store.users.filter((item) => include.has(item.id));
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.from("app_users").select("*").in("id", ids);
  if (error) throw new ApiException(500, "db_error", error.message);
  return (data ?? []) as User[];
}

export async function getVehicleOrThrow(vehicleId: string): Promise<Vehicle> {
  if (getDataMode() === "memory") {
    const vehicle = store.vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) {
      throw new ApiException(404, "vehicle_not_found", "Vehicle does not exist.");
    }
    if (!vehicle.is_active) {
      throw new ApiException(409, "vehicle_inactive", "Vehicle is not active.");
    }
    return withVehicleDefaults(vehicle);
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", vehicleId)
    .maybeSingle();
  if (error) throw new ApiException(500, "db_error", error.message);
  if (!data) throw new ApiException(404, "vehicle_not_found", "Vehicle does not exist.");
  if (!data.is_active) {
    throw new ApiException(409, "vehicle_inactive", "Vehicle is not active.");
  }
  return withVehicleDefaults(data as Vehicle);
}

export async function listVehiclesByOwner(ownerId: string): Promise<Vehicle[]> {
  if (getDataMode() === "memory") {
    return store.vehicles
      .filter((item) => item.owner_id === ownerId)
      .map(withVehicleDefaults);
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("owner_id", ownerId);
  if (error) throw new ApiException(500, "db_error", error.message);
  return ((data ?? []) as Vehicle[]).map(withVehicleDefaults);
}

export async function listVehicles(): Promise<Vehicle[]> {
  if (getDataMode() === "memory") {
    return store.vehicles.map(withVehicleDefaults);
  }
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.from("vehicles").select("*");
  if (error) throw new ApiException(500, "db_error", error.message);
  return ((data ?? []) as Vehicle[]).map(withVehicleDefaults);
}

export async function upsertVehicle(vehicle: Vehicle): Promise<Vehicle> {
  const normalized = withVehicleDefaults(vehicle);
  if (getDataMode() === "memory") {
    const existingIndex = store.vehicles.findIndex((item) => item.id === normalized.id);
    if (existingIndex >= 0) {
      store.vehicles[existingIndex] = normalized;
    } else {
      store.vehicles.push(normalized);
    }
    return normalized;
  }
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("vehicles")
    .upsert(normalized, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw new ApiException(500, "db_error", error.message);
  return withVehicleDefaults(data as Vehicle);
}

export async function deleteVehicleById(vehicleId: string): Promise<Vehicle | null> {
  if (getDataMode() === "memory") {
    const existing = store.vehicles.find((item) => item.id === vehicleId);
    if (!existing) return null;
    store.vehicles = store.vehicles.filter((item) => item.id !== vehicleId);
    store.vehicleLiveLocations = store.vehicleLiveLocations.filter(
      (item) => item.vehicle_id !== vehicleId
    );
    store.vehicleBlocks = store.vehicleBlocks.filter((item) => item.vehicle_id !== vehicleId);
    store.vehicleDocuments = store.vehicleDocuments.filter(
      (item) => item.vehicle_id !== vehicleId
    );
    return withVehicleDefaults(existing);
  }

  const supabase = getSupabaseServiceClient();
  const { error: trackingError } = await supabase
    .from("vehicle_live_locations")
    .delete()
    .eq("vehicle_id", vehicleId);
  if (trackingError) throw new ApiException(500, "db_error", trackingError.message);

  const { error: blockError } = await supabase
    .from("vehicle_block_windows")
    .delete()
    .eq("vehicle_id", vehicleId);
  if (blockError) throw new ApiException(500, "db_error", blockError.message);

  const { error: docsError } = await supabase
    .from("vehicle_documents")
    .delete()
    .eq("vehicle_id", vehicleId);
  if (docsError) throw new ApiException(500, "db_error", docsError.message);

  const { data, error } = await supabase
    .from("vehicles")
    .delete()
    .eq("id", vehicleId)
    .select("*")
    .maybeSingle();
  if (error) throw new ApiException(500, "db_error", error.message);
  return (data as Vehicle | null) ? withVehicleDefaults(data as Vehicle) : null;
}

export async function listVehicleLiveLocations(filter?: {
  ownerId?: string;
  vehicleIds?: string[];
}): Promise<VehicleLiveLocation[]> {
  if (getDataMode() === "memory") {
    const ownerVehicleIds = filter?.ownerId
      ? new Set(
          store.vehicles
            .filter((vehicle) => vehicle.owner_id === filter.ownerId)
            .map((vehicle) => vehicle.id)
        )
      : null;
    const includeIds = filter?.vehicleIds ? new Set(filter.vehicleIds) : null;

    return store.vehicleLiveLocations.filter((item) => {
      if (ownerVehicleIds && !ownerVehicleIds.has(item.vehicle_id)) return false;
      if (includeIds && !includeIds.has(item.vehicle_id)) return false;
      return true;
    });
  }

  const supabase = getSupabaseServiceClient();
  let scopedVehicleIds = filter?.vehicleIds ? [...filter.vehicleIds] : undefined;

  if (filter?.ownerId) {
    const { data: ownerVehicles, error: ownerVehiclesError } = await supabase
      .from("vehicles")
      .select("id")
      .eq("owner_id", filter.ownerId);
    if (ownerVehiclesError) {
      throw new ApiException(500, "db_error", ownerVehiclesError.message);
    }
    const ownerVehicleIds = (ownerVehicles ?? []).map((item) => item.id as string);
    if (!ownerVehicleIds.length) return [];
    scopedVehicleIds = scopedVehicleIds
      ? scopedVehicleIds.filter((id) => ownerVehicleIds.includes(id))
      : ownerVehicleIds;
  }

  let query = supabase.from("vehicle_live_locations").select("*");
  if (scopedVehicleIds?.length) query = query.in("vehicle_id", scopedVehicleIds);
  if (scopedVehicleIds && !scopedVehicleIds.length) return [];

  const { data, error } = await query;
  if (error) throw new ApiException(500, "db_error", error.message);
  return (data ?? []) as VehicleLiveLocation[];
}

export async function upsertVehicleLiveLocation(
  location: VehicleLiveLocation
): Promise<VehicleLiveLocation> {
  if (getDataMode() === "memory") {
    const existingIndex = store.vehicleLiveLocations.findIndex(
      (item) => item.vehicle_id === location.vehicle_id
    );
    if (existingIndex >= 0) {
      store.vehicleLiveLocations[existingIndex] = location;
    } else {
      store.vehicleLiveLocations.push(location);
    }
    return location;
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("vehicle_live_locations")
    .upsert(location, { onConflict: "vehicle_id" })
    .select("*")
    .single();
  if (error) throw new ApiException(500, "db_error", error.message);
  return data as VehicleLiveLocation;
}

export async function getKycRecordOrThrow(userId: string): Promise<KycRecord> {
  if (getDataMode() === "memory") {
    const kyc = store.kycRecords.find((item) => item.user_id === userId);
    if (!kyc) {
      throw new ApiException(404, "kyc_not_found", "KYC record does not exist.");
    }
    return kyc;
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("kyc_records")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new ApiException(500, "db_error", error.message);
  if (!data) throw new ApiException(404, "kyc_not_found", "KYC record does not exist.");
  return data as KycRecord;
}

export async function getKycByRequestId(requestId: string): Promise<KycRecord | null> {
  if (getDataMode() === "memory") {
    return store.kycRecords.find((item) => item.request_id === requestId) ?? null;
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("kyc_records")
    .select("*")
    .eq("request_id", requestId)
    .maybeSingle();
  if (error) throw new ApiException(500, "db_error", error.message);
  return (data as KycRecord | null) ?? null;
}

export async function upsertKycRecord(kyc: KycRecord): Promise<KycRecord> {
  if (getDataMode() === "memory") {
    const existingIndex = store.kycRecords.findIndex((item) => item.user_id === kyc.user_id);
    if (existingIndex >= 0) {
      store.kycRecords[existingIndex] = kyc;
    } else {
      store.kycRecords.push(kyc);
    }
    return kyc;
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("kyc_records")
    .upsert(kyc, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw new ApiException(500, "db_error", error.message);
  return data as KycRecord;
}

export async function listManualReviewKyc(): Promise<KycRecord[]> {
  if (getDataMode() === "memory") {
    return store.kycRecords.filter((item) => item.status === "manual_review");
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("kyc_records")
    .select("*")
    .eq("status", "manual_review");
  if (error) throw new ApiException(500, "db_error", error.message);
  return (data ?? []) as KycRecord[];
}

export async function getBookingOrThrow(bookingId: string): Promise<Booking> {
  if (getDataMode() === "memory") {
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      throw new ApiException(404, "booking_not_found", "Booking does not exist.");
    }
    return booking;
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw new ApiException(500, "db_error", error.message);
  if (!data) throw new ApiException(404, "booking_not_found", "Booking does not exist.");
  return data as Booking;
}

export async function insertBooking(booking: Booking): Promise<Booking> {
  if (getDataMode() === "memory") {
    store.bookings.push(booking);
    return booking;
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("bookings")
    .insert(booking)
    .select("*")
    .single();
  if (error) throwStructuredDbError(error);
  return data as Booking;
}

export async function updateBooking(
  bookingId: string,
  patch: Partial<Booking>
): Promise<Booking> {
  if (getDataMode() === "memory") {
    const index = store.bookings.findIndex((item) => item.id === bookingId);
    if (index < 0) {
      throw new ApiException(404, "booking_not_found", "Booking does not exist.");
    }
    const updated = { ...store.bookings[index], ...patch };
    store.bookings[index] = updated;
    return updated;
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("bookings")
    .update(patch)
    .eq("id", bookingId)
    .select("*")
    .single();
  if (error) throwStructuredDbError(error);
  return data as Booking;
}

export async function listBookings(filter?: {
  status?: string;
  userId?: string;
  userIds?: string[];
  includeRelatedUserIds?: boolean;
  vehicleId?: string;
  excludeStatuses?: BookingStatus[];
}): Promise<Booking[]> {
  let userIds = filter?.userIds;
  if (filter?.includeRelatedUserIds && filter.userId) {
    const user = await getUserOrThrow(filter.userId);
    if (user.email) {
      const related = await findAppUsersByEmail(user.email);
      userIds = [...new Set(related.map((entry) => entry.id))];
    } else {
      userIds = [filter.userId];
    }
  }

  if (getDataMode() === "memory") {
    return store.bookings.filter((item) => {
      if (filter?.status && item.status !== filter.status) return false;
      if (userIds?.length && !userIds.includes(item.user_id)) return false;
      if (!userIds?.length && filter?.userId && item.user_id !== filter.userId) return false;
      if (filter?.vehicleId && item.vehicle_id !== filter.vehicleId) return false;
      if (filter?.excludeStatuses?.includes(item.status)) return false;
      return true;
    });
  }

  const supabase = getSupabaseServiceClient();
  let query = supabase.from("bookings").select("*");
  if (filter?.status) query = query.eq("status", filter.status);
  if (userIds?.length) query = query.in("user_id", userIds);
  else if (filter?.userId) query = query.eq("user_id", filter.userId);
  if (filter?.vehicleId) query = query.eq("vehicle_id", filter.vehicleId);
  if (filter?.excludeStatuses?.length) {
    const quoted = filter.excludeStatuses.map((status) => `"${status}"`).join(",");
    query = query.not("status", "in", `(${quoted})`);
  }

  const { data, error } = await query;
  if (error) throw new ApiException(500, "db_error", error.message);
  return (data ?? []) as Booking[];
}

export async function insertVehicleBlock(blockWindow: VehicleBlockWindow): Promise<VehicleBlockWindow> {
  if (getDataMode() === "memory") {
    store.vehicleBlocks.push(blockWindow);
    return blockWindow;
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("vehicle_block_windows")
    .insert(blockWindow)
    .select("*")
    .single();
  if (error) throw new ApiException(500, "db_error", error.message);
  return data as VehicleBlockWindow;
}

export async function listVehicleBlocks(vehicleId: string): Promise<VehicleBlockWindow[]> {
  if (getDataMode() === "memory") {
    return store.vehicleBlocks.filter((item) => item.vehicle_id === vehicleId);
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("vehicle_block_windows")
    .select("*")
    .eq("vehicle_id", vehicleId);
  if (error) throw new ApiException(500, "db_error", error.message);
  return (data ?? []) as VehicleBlockWindow[];
}

export async function insertAuditEvent(event: AuditEvent): Promise<void> {
  if (getDataMode() === "memory") {
    store.auditEvents.push(event);
    return;
  }

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("audit_events").insert(event);
  if (error) throw new ApiException(500, "db_error", error.message);
}

export async function getLatestAuditEventForResource(
  resourceType: string,
  resourceId: string,
  action?: string
): Promise<AuditEvent | null> {
  if (getDataMode() === "memory") {
    const matches = store.auditEvents
      .filter(
        (item) =>
          item.resource_type === resourceType &&
          item.resource_id === resourceId &&
          (!action || item.action === action)
      )
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
    return matches[0] ?? null;
  }

  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from("audit_events")
    .select("*")
    .eq("resource_type", resourceType)
    .eq("resource_id", resourceId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (action) {
    query = query.eq("action", action);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new ApiException(500, "db_error", error.message);
  return (data as AuditEvent | null) ?? null;
}

export async function insertPaymentOrder(order: PaymentOrder): Promise<PaymentOrder> {
  if (getDataMode() === "memory") {
    store.paymentOrders.push(order);
    return order;
  }
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("payment_orders")
    .insert(order)
    .select("*")
    .single();
  if (error) throwStructuredDbError(error);
  return data as PaymentOrder;
}

export async function getOpenPaymentOrderForBooking(
  bookingId: string
): Promise<PaymentOrder | null> {
  if (getDataMode() === "memory") {
    const matches = store.paymentOrders
      .filter((item) => item.booking_id === bookingId && item.status === "created")
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
    return matches[0] ?? null;
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("payment_orders")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("status", "created")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throwStructuredDbError(error);
  return (data as PaymentOrder | null) ?? null;
}

export async function getLatestPaymentOrderForBooking(
  bookingId: string
): Promise<PaymentOrder | null> {
  if (getDataMode() === "memory") {
    const matches = store.paymentOrders
      .filter((item) => item.booking_id === bookingId)
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
    return matches[0] ?? null;
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("payment_orders")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throwStructuredDbError(error);
  return (data as PaymentOrder | null) ?? null;
}

export async function updatePaymentOrderByProviderId(
  providerOrderId: string,
  patch: Partial<PaymentOrder>
): Promise<PaymentOrder | null> {
  if (getDataMode() === "memory") {
    const idx = store.paymentOrders.findIndex(
      (item) => item.provider_order_id === providerOrderId
    );
    if (idx < 0) return null;
    store.paymentOrders[idx] = { ...store.paymentOrders[idx], ...patch };
    return store.paymentOrders[idx];
  }
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("payment_orders")
    .update(patch)
    .eq("provider_order_id", providerOrderId)
    .select("*")
    .maybeSingle();
  if (error) throw new ApiException(500, "db_error", error.message);
  return (data as PaymentOrder | null) ?? null;
}

export async function updatePaymentOrderById(
  paymentOrderId: string,
  patch: Partial<PaymentOrder>
): Promise<PaymentOrder | null> {
  if (getDataMode() === "memory") {
    const idx = store.paymentOrders.findIndex((item) => item.id === paymentOrderId);
    if (idx < 0) return null;
    store.paymentOrders[idx] = { ...store.paymentOrders[idx], ...patch };
    return store.paymentOrders[idx];
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("payment_orders")
    .update(patch)
    .eq("id", paymentOrderId)
    .select("*")
    .maybeSingle();
  if (error) throw new ApiException(500, "db_error", error.message);
  return (data as PaymentOrder | null) ?? null;
}

export async function hasProcessedPaymentEvent(providerEventId: string): Promise<boolean> {
  if (getDataMode() === "memory") {
    return store.paymentEvents.some((item) => item.provider_event_id === providerEventId);
  }
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("payment_events")
    .select("id")
    .eq("provider_event_id", providerEventId)
    .maybeSingle();
  if (error) throw new ApiException(500, "db_error", error.message);
  return Boolean(data);
}

export async function claimPaymentEvent(event: PaymentEvent): Promise<boolean> {
  if (getDataMode() === "memory") {
    if (store.paymentEvents.some((item) => item.provider_event_id === event.provider_event_id)) {
      return false;
    }
    store.paymentEvents.push(event);
    return true;
  }

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("payment_events").insert(event);
  if (error) {
    if (error.code === "23505") {
      return false;
    }
    throw new ApiException(500, "db_error", error.message);
  }
  return true;
}

export async function insertPaymentEvent(event: PaymentEvent): Promise<void> {
  if (getDataMode() === "memory") {
    store.paymentEvents.push(event);
    return;
  }
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("payment_events").insert(event);
  if (error) throw new ApiException(500, "db_error", error.message);
}

export async function insertDamageIncident(incident: DamageIncident): Promise<DamageIncident> {
  if (getDataMode() === "memory") {
    store.damageIncidents.push(incident);
    return incident;
  }
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("damage_incidents")
    .insert(incident)
    .select("*")
    .single();
  if (error) throw new ApiException(500, "db_error", error.message);
  return data as DamageIncident;
}

export async function listOpenDamageIncidents(): Promise<DamageIncident[]> {
  if (getDataMode() === "memory") {
    return store.damageIncidents;
  }
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.from("damage_incidents").select("*");
  if (error) throw new ApiException(500, "db_error", error.message);
  return (data ?? []) as DamageIncident[];
}

export async function insertVehicleDocument(doc: VehicleDocument): Promise<VehicleDocument> {
  if (getDataMode() === "memory") {
    store.vehicleDocuments.push(doc);
    return doc;
  }
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("vehicle_documents")
    .insert(doc)
    .select("*")
    .single();
  if (error) throw new ApiException(500, "db_error", error.message);
  return data as VehicleDocument;
}

export async function listVehicleDocumentsExpiringBefore(
  isoTime: string
): Promise<VehicleDocument[]> {
  if (getDataMode() === "memory") {
    return store.vehicleDocuments.filter((item) => item.expires_at <= isoTime);
  }
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("vehicle_documents")
    .select("*")
    .lte("expires_at", isoTime);
  if (error) throw new ApiException(500, "db_error", error.message);
  return (data ?? []) as VehicleDocument[];
}

export async function insertNotificationJob(job: NotificationJob): Promise<NotificationJob> {
  if (getDataMode() === "memory") {
    store.notificationJobs.push(job);
    return job;
  }
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("notification_jobs")
    .insert(job)
    .select("*")
    .single();
  if (error) throw new ApiException(500, "db_error", error.message);
  return data as NotificationJob;
}

export async function listNotificationJobs(filter?: {
  recipient?: string;
  channel?: NotificationJob["channel"];
  limit?: number;
}): Promise<NotificationJob[]> {
  if (getDataMode() === "memory") {
    const rows = store.notificationJobs
      .filter((item) => {
        if (filter?.recipient && item.recipient !== filter.recipient) return false;
        if (filter?.channel && item.channel !== filter.channel) return false;
        return true;
      })
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
    return typeof filter?.limit === "number" ? rows.slice(0, filter.limit) : rows;
  }

  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from("notification_jobs")
    .select("*")
    .order("created_at", { ascending: false });
  if (filter?.recipient) query = query.eq("recipient", filter.recipient);
  if (filter?.channel) query = query.eq("channel", filter.channel);
  if (typeof filter?.limit === "number") query = query.limit(filter.limit);

  const { data, error } = await query;
  if (error) throw new ApiException(500, "db_error", error.message);
  return (data ?? []) as NotificationJob[];
}

export async function hasNotificationJobForPayload(params: {
  templateKey: string;
  payloadField: string;
  payloadValue: string;
}): Promise<boolean> {
  if (getDataMode() === "memory") {
    return store.notificationJobs.some(
      (job) =>
        job.template_key === params.templateKey &&
        String(job.payload[params.payloadField] ?? "") === params.payloadValue
    );
  }

  const supabase = getSupabaseServiceClient();
  const { count, error } = await supabase
    .from("notification_jobs")
    .select("id", { count: "exact", head: true })
    .eq("template_key", params.templateKey)
    .eq(`payload->>${params.payloadField}`, params.payloadValue);

  if (error) throw new ApiException(500, "db_error", error.message);
  return (count ?? 0) > 0;
}
