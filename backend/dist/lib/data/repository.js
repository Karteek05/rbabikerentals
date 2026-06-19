"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDataMode = getDataMode;
exports.assertBengaluruCity = assertBengaluruCity;
exports.getUserOrThrow = getUserOrThrow;
exports.upsertUser = upsertUser;
exports.getVehicleOrThrow = getVehicleOrThrow;
exports.listVehiclesByOwner = listVehiclesByOwner;
exports.listVehicles = listVehicles;
exports.upsertVehicle = upsertVehicle;
exports.deleteVehicleById = deleteVehicleById;
exports.listVehicleLiveLocations = listVehicleLiveLocations;
exports.upsertVehicleLiveLocation = upsertVehicleLiveLocation;
exports.getKycRecordOrThrow = getKycRecordOrThrow;
exports.getKycByRequestId = getKycByRequestId;
exports.upsertKycRecord = upsertKycRecord;
exports.listManualReviewKyc = listManualReviewKyc;
exports.getBookingOrThrow = getBookingOrThrow;
exports.insertBooking = insertBooking;
exports.updateBooking = updateBooking;
exports.listBookings = listBookings;
exports.insertVehicleBlock = insertVehicleBlock;
exports.listVehicleBlocks = listVehicleBlocks;
exports.insertAuditEvent = insertAuditEvent;
exports.insertPaymentOrder = insertPaymentOrder;
exports.getOpenPaymentOrderForBooking = getOpenPaymentOrderForBooking;
exports.getLatestPaymentOrderForBooking = getLatestPaymentOrderForBooking;
exports.updatePaymentOrderByProviderId = updatePaymentOrderByProviderId;
exports.updatePaymentOrderByBookingId = updatePaymentOrderByBookingId;
exports.hasProcessedPaymentEvent = hasProcessedPaymentEvent;
exports.insertPaymentEvent = insertPaymentEvent;
exports.insertDamageIncident = insertDamageIncident;
exports.listOpenDamageIncidents = listOpenDamageIncidents;
exports.insertVehicleDocument = insertVehicleDocument;
exports.listVehicleDocumentsExpiringBefore = listVehicleDocumentsExpiringBefore;
exports.insertNotificationJob = insertNotificationJob;
const store_1 = require("../../lib/data/store");
const supabase_client_1 = require("../../lib/db/supabase-client");
const errors_1 = require("../../lib/utils/errors");
function getDbErrorDetails(error) {
    if (typeof error !== "object" || error === null) {
        return { code: undefined, message: "Database request failed." };
    }
    const maybeError = error;
    return {
        code: typeof maybeError.code === "string" ? maybeError.code : undefined,
        message: typeof maybeError.message === "string"
            ? maybeError.message
            : "Database request failed."
    };
}
function throwStructuredDbError(error) {
    const { code, message } = getDbErrorDetails(error);
    if (code === "23P01" || message.includes("bookings_vehicle_active_window_excl")) {
        throw new errors_1.ApiException(409, "vehicle_unavailable", "Vehicle already has an active booking in the requested time window.");
    }
    if (code === "23505" && message.includes("idx_payment_orders_booking_created")) {
        throw new errors_1.ApiException(409, "payment_order_exists", "An active payment order already exists for this booking.");
    }
    throw new errors_1.ApiException(500, "db_error", "Database request failed.");
}
function getDataMode() {
    return (0, supabase_client_1.isSupabaseConfigured)() ? "supabase" : "memory";
}
function assertBengaluruCity(city) {
    if (city !== "bengaluru") {
        throw new errors_1.ApiException(400, "unsupported_city", "Phase 1 supports only Bengaluru.");
    }
}
function withVehicleDefaults(vehicle) {
    return {
        ...vehicle,
        image_urls: vehicle.image_urls ?? []
    };
}
async function getUserOrThrow(userId) {
    if (getDataMode() === "memory") {
        const user = store_1.store.users.find((item) => item.id === userId);
        if (!user) {
            throw new errors_1.ApiException(404, "user_not_found", "User does not exist.");
        }
        return user;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("app_users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    if (!data)
        throw new errors_1.ApiException(404, "user_not_found", "User does not exist.");
    return data;
}
async function upsertUser(user) {
    if (getDataMode() === "memory") {
        const existingIndex = store_1.store.users.findIndex((item) => item.id === user.id);
        if (existingIndex >= 0) {
            store_1.store.users[existingIndex] = user;
        }
        else {
            store_1.store.users.push(user);
        }
        return user;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("app_users")
        .upsert(user, { onConflict: "id" })
        .select("*")
        .single();
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return data;
}
async function getVehicleOrThrow(vehicleId) {
    if (getDataMode() === "memory") {
        const vehicle = store_1.store.vehicles.find((item) => item.id === vehicleId);
        if (!vehicle) {
            throw new errors_1.ApiException(404, "vehicle_not_found", "Vehicle does not exist.");
        }
        if (!vehicle.is_active) {
            throw new errors_1.ApiException(409, "vehicle_inactive", "Vehicle is not active.");
        }
        return withVehicleDefaults(vehicle);
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", vehicleId)
        .maybeSingle();
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    if (!data)
        throw new errors_1.ApiException(404, "vehicle_not_found", "Vehicle does not exist.");
    if (!data.is_active) {
        throw new errors_1.ApiException(409, "vehicle_inactive", "Vehicle is not active.");
    }
    return withVehicleDefaults(data);
}
async function listVehiclesByOwner(ownerId) {
    if (getDataMode() === "memory") {
        return store_1.store.vehicles
            .filter((item) => item.owner_id === ownerId)
            .map(withVehicleDefaults);
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("owner_id", ownerId);
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return (data ?? []).map(withVehicleDefaults);
}
async function listVehicles() {
    if (getDataMode() === "memory") {
        return store_1.store.vehicles.map(withVehicleDefaults);
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase.from("vehicles").select("*");
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return (data ?? []).map(withVehicleDefaults);
}
async function upsertVehicle(vehicle) {
    const normalized = withVehicleDefaults(vehicle);
    if (getDataMode() === "memory") {
        const existingIndex = store_1.store.vehicles.findIndex((item) => item.id === normalized.id);
        if (existingIndex >= 0) {
            store_1.store.vehicles[existingIndex] = normalized;
        }
        else {
            store_1.store.vehicles.push(normalized);
        }
        return normalized;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("vehicles")
        .upsert(normalized, { onConflict: "id" })
        .select("*")
        .single();
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return withVehicleDefaults(data);
}
async function deleteVehicleById(vehicleId) {
    if (getDataMode() === "memory") {
        const existing = store_1.store.vehicles.find((item) => item.id === vehicleId);
        if (!existing)
            return null;
        store_1.store.vehicles = store_1.store.vehicles.filter((item) => item.id !== vehicleId);
        store_1.store.vehicleLiveLocations = store_1.store.vehicleLiveLocations.filter((item) => item.vehicle_id !== vehicleId);
        store_1.store.vehicleBlocks = store_1.store.vehicleBlocks.filter((item) => item.vehicle_id !== vehicleId);
        store_1.store.vehicleDocuments = store_1.store.vehicleDocuments.filter((item) => item.vehicle_id !== vehicleId);
        return withVehicleDefaults(existing);
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { error: trackingError } = await supabase
        .from("vehicle_live_locations")
        .delete()
        .eq("vehicle_id", vehicleId);
    if (trackingError)
        throw new errors_1.ApiException(500, "db_error", trackingError.message);
    const { error: blockError } = await supabase
        .from("vehicle_block_windows")
        .delete()
        .eq("vehicle_id", vehicleId);
    if (blockError)
        throw new errors_1.ApiException(500, "db_error", blockError.message);
    const { error: docsError } = await supabase
        .from("vehicle_documents")
        .delete()
        .eq("vehicle_id", vehicleId);
    if (docsError)
        throw new errors_1.ApiException(500, "db_error", docsError.message);
    const { data, error } = await supabase
        .from("vehicles")
        .delete()
        .eq("id", vehicleId)
        .select("*")
        .maybeSingle();
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return data ? withVehicleDefaults(data) : null;
}
async function listVehicleLiveLocations(filter) {
    if (getDataMode() === "memory") {
        const ownerVehicleIds = filter?.ownerId
            ? new Set(store_1.store.vehicles
                .filter((vehicle) => vehicle.owner_id === filter.ownerId)
                .map((vehicle) => vehicle.id))
            : null;
        const includeIds = filter?.vehicleIds ? new Set(filter.vehicleIds) : null;
        return store_1.store.vehicleLiveLocations.filter((item) => {
            if (ownerVehicleIds && !ownerVehicleIds.has(item.vehicle_id))
                return false;
            if (includeIds && !includeIds.has(item.vehicle_id))
                return false;
            return true;
        });
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    let scopedVehicleIds = filter?.vehicleIds ? [...filter.vehicleIds] : undefined;
    if (filter?.ownerId) {
        const { data: ownerVehicles, error: ownerVehiclesError } = await supabase
            .from("vehicles")
            .select("id")
            .eq("owner_id", filter.ownerId);
        if (ownerVehiclesError) {
            throw new errors_1.ApiException(500, "db_error", ownerVehiclesError.message);
        }
        const ownerVehicleIds = (ownerVehicles ?? []).map((item) => item.id);
        if (!ownerVehicleIds.length)
            return [];
        scopedVehicleIds = scopedVehicleIds
            ? scopedVehicleIds.filter((id) => ownerVehicleIds.includes(id))
            : ownerVehicleIds;
    }
    let query = supabase.from("vehicle_live_locations").select("*");
    if (scopedVehicleIds?.length)
        query = query.in("vehicle_id", scopedVehicleIds);
    if (scopedVehicleIds && !scopedVehicleIds.length)
        return [];
    const { data, error } = await query;
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return (data ?? []);
}
async function upsertVehicleLiveLocation(location) {
    if (getDataMode() === "memory") {
        const existingIndex = store_1.store.vehicleLiveLocations.findIndex((item) => item.vehicle_id === location.vehicle_id);
        if (existingIndex >= 0) {
            store_1.store.vehicleLiveLocations[existingIndex] = location;
        }
        else {
            store_1.store.vehicleLiveLocations.push(location);
        }
        return location;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("vehicle_live_locations")
        .upsert(location, { onConflict: "vehicle_id" })
        .select("*")
        .single();
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return data;
}
async function getKycRecordOrThrow(userId) {
    if (getDataMode() === "memory") {
        const kyc = store_1.store.kycRecords.find((item) => item.user_id === userId);
        if (!kyc) {
            throw new errors_1.ApiException(404, "kyc_not_found", "KYC record does not exist.");
        }
        return kyc;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("kyc_records")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    if (!data)
        throw new errors_1.ApiException(404, "kyc_not_found", "KYC record does not exist.");
    return data;
}
async function getKycByRequestId(requestId) {
    if (getDataMode() === "memory") {
        return store_1.store.kycRecords.find((item) => item.request_id === requestId) ?? null;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("kyc_records")
        .select("*")
        .eq("request_id", requestId)
        .maybeSingle();
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return data ?? null;
}
async function upsertKycRecord(kyc) {
    if (getDataMode() === "memory") {
        const existingIndex = store_1.store.kycRecords.findIndex((item) => item.user_id === kyc.user_id);
        if (existingIndex >= 0) {
            store_1.store.kycRecords[existingIndex] = kyc;
        }
        else {
            store_1.store.kycRecords.push(kyc);
        }
        return kyc;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("kyc_records")
        .upsert(kyc, { onConflict: "user_id" })
        .select("*")
        .single();
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return data;
}
async function listManualReviewKyc() {
    if (getDataMode() === "memory") {
        return store_1.store.kycRecords.filter((item) => item.status === "manual_review");
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("kyc_records")
        .select("*")
        .eq("status", "manual_review");
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return (data ?? []);
}
async function getBookingOrThrow(bookingId) {
    if (getDataMode() === "memory") {
        const booking = store_1.store.bookings.find((item) => item.id === bookingId);
        if (!booking) {
            throw new errors_1.ApiException(404, "booking_not_found", "Booking does not exist.");
        }
        return booking;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .maybeSingle();
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    if (!data)
        throw new errors_1.ApiException(404, "booking_not_found", "Booking does not exist.");
    return data;
}
async function insertBooking(booking) {
    if (getDataMode() === "memory") {
        store_1.store.bookings.push(booking);
        return booking;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("bookings")
        .insert(booking)
        .select("*")
        .single();
    if (error)
        throwStructuredDbError(error);
    return data;
}
async function updateBooking(bookingId, patch) {
    if (getDataMode() === "memory") {
        const index = store_1.store.bookings.findIndex((item) => item.id === bookingId);
        if (index < 0) {
            throw new errors_1.ApiException(404, "booking_not_found", "Booking does not exist.");
        }
        const updated = { ...store_1.store.bookings[index], ...patch };
        store_1.store.bookings[index] = updated;
        return updated;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("bookings")
        .update(patch)
        .eq("id", bookingId)
        .select("*")
        .single();
    if (error)
        throwStructuredDbError(error);
    return data;
}
async function listBookings(filter) {
    if (getDataMode() === "memory") {
        return store_1.store.bookings.filter((item) => {
            if (filter?.status && item.status !== filter.status)
                return false;
            if (filter?.userId && item.user_id !== filter.userId)
                return false;
            if (filter?.vehicleId && item.vehicle_id !== filter.vehicleId)
                return false;
            if (filter?.excludeStatuses?.includes(item.status))
                return false;
            return true;
        });
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    let query = supabase.from("bookings").select("*");
    if (filter?.status)
        query = query.eq("status", filter.status);
    if (filter?.userId)
        query = query.eq("user_id", filter.userId);
    if (filter?.vehicleId)
        query = query.eq("vehicle_id", filter.vehicleId);
    if (filter?.excludeStatuses?.length) {
        query = query.not("status", "in", `(${filter.excludeStatuses.join(",")})`);
    }
    const { data, error } = await query;
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return (data ?? []);
}
async function insertVehicleBlock(blockWindow) {
    if (getDataMode() === "memory") {
        store_1.store.vehicleBlocks.push(blockWindow);
        return blockWindow;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("vehicle_block_windows")
        .insert(blockWindow)
        .select("*")
        .single();
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return data;
}
async function listVehicleBlocks(vehicleId) {
    if (getDataMode() === "memory") {
        return store_1.store.vehicleBlocks.filter((item) => item.vehicle_id === vehicleId);
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("vehicle_block_windows")
        .select("*")
        .eq("vehicle_id", vehicleId);
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return (data ?? []);
}
async function insertAuditEvent(event) {
    if (getDataMode() === "memory") {
        store_1.store.auditEvents.push(event);
        return;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { error } = await supabase.from("audit_events").insert(event);
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
}
async function insertPaymentOrder(order) {
    if (getDataMode() === "memory") {
        store_1.store.paymentOrders.push(order);
        return order;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("payment_orders")
        .insert(order)
        .select("*")
        .single();
    if (error)
        throwStructuredDbError(error);
    return data;
}
async function getOpenPaymentOrderForBooking(bookingId) {
    if (getDataMode() === "memory") {
        const matches = store_1.store.paymentOrders
            .filter((item) => item.booking_id === bookingId && item.status === "created")
            .sort((left, right) => right.created_at.localeCompare(left.created_at));
        return matches[0] ?? null;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("payment_orders")
        .select("*")
        .eq("booking_id", bookingId)
        .eq("status", "created")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error)
        throwStructuredDbError(error);
    return data ?? null;
}
async function getLatestPaymentOrderForBooking(bookingId) {
    if (getDataMode() === "memory") {
        const matches = store_1.store.paymentOrders
            .filter((item) => item.booking_id === bookingId)
            .sort((left, right) => right.created_at.localeCompare(left.created_at));
        return matches[0] ?? null;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("payment_orders")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error)
        throwStructuredDbError(error);
    return data ?? null;
}
async function updatePaymentOrderByProviderId(providerOrderId, patch) {
    if (getDataMode() === "memory") {
        const idx = store_1.store.paymentOrders.findIndex((item) => item.provider_order_id === providerOrderId);
        if (idx < 0)
            return null;
        store_1.store.paymentOrders[idx] = { ...store_1.store.paymentOrders[idx], ...patch };
        return store_1.store.paymentOrders[idx];
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("payment_orders")
        .update(patch)
        .eq("provider_order_id", providerOrderId)
        .select("*")
        .maybeSingle();
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return data ?? null;
}
async function updatePaymentOrderByBookingId(bookingId, patch) {
    if (getDataMode() === "memory") {
        const matches = store_1.store.paymentOrders
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.booking_id === bookingId)
            .sort((left, right) => right.item.created_at.localeCompare(left.item.created_at));
        const match = matches[0];
        if (!match)
            return null;
        store_1.store.paymentOrders[match.index] = { ...match.item, ...patch };
        return store_1.store.paymentOrders[match.index];
    }
    const latest = await getLatestPaymentOrderForBooking(bookingId);
    if (!latest)
        return null;
    return updatePaymentOrderByProviderId(latest.provider_order_id, patch);
}
async function hasProcessedPaymentEvent(providerEventId) {
    if (getDataMode() === "memory") {
        return store_1.store.paymentEvents.some((item) => item.provider_event_id === providerEventId);
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("payment_events")
        .select("id")
        .eq("provider_event_id", providerEventId)
        .maybeSingle();
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return Boolean(data);
}
async function insertPaymentEvent(event) {
    if (getDataMode() === "memory") {
        store_1.store.paymentEvents.push(event);
        return;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { error } = await supabase.from("payment_events").insert(event);
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
}
async function insertDamageIncident(incident) {
    if (getDataMode() === "memory") {
        store_1.store.damageIncidents.push(incident);
        return incident;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("damage_incidents")
        .insert(incident)
        .select("*")
        .single();
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return data;
}
async function listOpenDamageIncidents() {
    if (getDataMode() === "memory") {
        return store_1.store.damageIncidents;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase.from("damage_incidents").select("*");
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return (data ?? []);
}
async function insertVehicleDocument(doc) {
    if (getDataMode() === "memory") {
        store_1.store.vehicleDocuments.push(doc);
        return doc;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("vehicle_documents")
        .insert(doc)
        .select("*")
        .single();
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return data;
}
async function listVehicleDocumentsExpiringBefore(isoTime) {
    if (getDataMode() === "memory") {
        return store_1.store.vehicleDocuments.filter((item) => item.expires_at <= isoTime);
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("vehicle_documents")
        .select("*")
        .lte("expires_at", isoTime);
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return (data ?? []);
}
async function insertNotificationJob(job) {
    if (getDataMode() === "memory") {
        store_1.store.notificationJobs.push(job);
        return job;
    }
    const supabase = (0, supabase_client_1.getSupabaseServiceClient)();
    const { data, error } = await supabase
        .from("notification_jobs")
        .insert(job)
        .select("*")
        .single();
    if (error)
        throw new errors_1.ApiException(500, "db_error", error.message);
    return data;
}
