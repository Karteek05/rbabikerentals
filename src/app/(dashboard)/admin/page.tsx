"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Icon from "../../components/Icon";
import { listAssignableUnitsForBooking } from "@/lib/bookings/assignable-units";
import { PUBLIC_FLEET } from "@/lib/fleet/catalog";
import {
  formatBookingReference,
  getVehicleDisplayName,
  resolveVehicleThumbnail
} from "@/lib/fleet/display";
import { getKycAdminBadge } from "@/lib/kyc/admin-labels";
import type { KycStatus, BookingStatus } from "@/lib/types/domain";
import { formatBookingStatus } from "@/lib/bookings/status-labels";
import { StatCardsSkeleton, Skeleton } from "@/components/ui/Skeleton";

type Booking = {
  id: string;
  status: BookingStatus;
  user_id: string;
  vehicle_id: string;
  assigned_vehicle_id?: string | null;
  assigned_at?: string | null;
  cancel_reason?: string;
  pickup_at?: string;
  drop_at?: string;
  requested_drop_at?: string | null;
  pickup_zone?: string | null;
  quote?: { total_payable?: number };
  created_at?: string;
  user?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    pan_number?: string | null;
    date_of_birth?: string | null;
    kyc_status?: KycStatus | null;
  } | null;
};

type VehicleItem = {
  id: string;
  owner_id: string;
  city: "bengaluru";
  category: "scooter" | "bike" | "ev_bike";
  brand: string;
  model: string;
  registration_number?: string;
  chassis_number?: string;
  catalog_vehicle_id?: string | null;
  image_urls?: string[];
  is_active: boolean;
  deposit_amount: number;
  rate_per_hour: number;
  rate_per_day: number;
  rate_per_week: number;
  rate_per_month: number;
};

type VehicleForm = {
  owner_id: string;
  category: "scooter" | "bike" | "ev_bike";
  brand: string;
  model: string;
  registration_number: string;
  chassis_number: string;
  catalog_vehicle_id: string;
  is_active: boolean;
  deposit_amount: number;
  rate_per_hour: number;
  rate_per_day: number;
  rate_per_week: number;
  rate_per_month: number;
};

type PartnerApplication = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  partner_business_name?: string | null;
  partner_application_status?: string | null;
  partner_applied_at?: string | null;
  partner_rejection_reason?: string | null;
};

type ApprovedPartner = {
  id: string;
  name: string;
  vehicle_count: number;
};

const navItems = [
  { href: "/admin", icon: "settings", label: "Dashboard" },
  { href: "/admin#partner-applications", icon: "briefcase", label: "Partners" },
  { href: "/admin#fleet", icon: "bike", label: "Fleet Ops" },
  { href: "/admin#bookings", icon: "list", label: "Bookings" },
  { href: "/admin#audit", icon: "search", label: "Audit Logs" }
] as const;

const emptyVehicleForm: VehicleForm = {
  owner_id: "partner_001",
  category: "scooter",
  brand: "Honda",
  model: "Activa 110",
  registration_number: "",
  chassis_number: "",
  catalog_vehicle_id: "",
  is_active: true,
  deposit_amount: 2000,
  rate_per_hour: 0,
  rate_per_day: 3200,
  rate_per_week: 1600,
  rate_per_month: 6000
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge-${status.replace(/_/g, "_")}`}>
      {formatBookingStatus(status)}
    </span>
  );
}

function KycStatusBadge({ status }: { status?: KycStatus | null }) {
  const { label, badgeClass } = getKycAdminBadge(status);
  return <span className={`badge ${badgeClass}`}>{label}</span>;
}

function truncateFleetId(id: string, max = 14) {
  if (id.length <= max) return id;
  return `${id.slice(0, max)}…`;
}

function formatDate(iso?: string) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return iso;
  }
}

function mapVehicleToForm(vehicle: VehicleItem): VehicleForm {
  return {
    owner_id: vehicle.owner_id,
    category: vehicle.category,
    brand: vehicle.brand,
    model: vehicle.model,
    registration_number: vehicle.registration_number ?? "",
    chassis_number: vehicle.chassis_number ?? "",
    catalog_vehicle_id: vehicle.catalog_vehicle_id ?? "",
    is_active: vehicle.is_active,
    deposit_amount: vehicle.deposit_amount,
    rate_per_hour: vehicle.rate_per_hour,
    rate_per_day: vehicle.rate_per_day,
    rate_per_week: vehicle.rate_per_week,
    rate_per_month: vehicle.rate_per_month
  };
}

export default function AdminDashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [bookingFilter, setBookingFilter] = useState("all");
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicleForm);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  
  const [docType, setDocType] = useState<"rc" | "insurance" | "invoice">("rc");
  const [uploadDocFile, setUploadDocFile] = useState<File | null>(null);
  const [docExpiresAt, setDocExpiresAt] = useState("");
  const [vehicleDocuments, setVehicleDocuments] = useState<any[]>([]);
  const [partnerApplications, setPartnerApplications] = useState<PartnerApplication[]>([]);
  const [approvedPartners, setApprovedPartners] = useState<ApprovedPartner[]>([]);
  const [partnerAppFilter, setPartnerAppFilter] = useState<"pending" | "approved" | "rejected" | "all">(
    "pending"
  );
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [pendingPartnerCount, setPendingPartnerCount] = useState(0);
  const [assignDraft, setAssignDraft] = useState<Record<string, string>>({});
  const [assignmentEdit, setAssignmentEdit] = useState<Record<string, boolean>>({});
  const [recentlyAssigned, setRecentlyAssigned] = useState<Set<string>>(() => new Set());

  const fetchInit = useMemo(
    () => ({
      credentials: "include" as const,
      headers: {
        "content-type": "application/json"
      }
    }),
    []
  );

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === editingVehicleId) ?? null,
    [vehicles, editingVehicleId]
  );

  const physicalUnits = useMemo(
    () => vehicles.filter((vehicle) => vehicle.chassis_number?.trim() && vehicle.is_active),
    [vehicles]
  );

  const vehicleById = useMemo(
    () => Object.fromEntries(vehicles.map((vehicle) => [vehicle.id, vehicle])),
    [vehicles]
  );

  function unitsForBooking(booking: Booking) {
    if (!booking.pickup_at || !booking.drop_at) return [];
    return listAssignableUnitsForBooking(
      booking as any,
      physicalUnits as any,
      bookings as any
    );
  }

  const refreshAll = useCallback(async () => {
    setError(null);
    setLoading("refresh");
    try {
      const [bookingsRes, vehiclesRes, partnersRes, applicationsRes, pendingAppsRes] =
        await Promise.all([
        fetch("/api/admin/bookings", { ...fetchInit }),
        fetch("/api/admin/vehicles?include_inactive=true", { ...fetchInit }),
        fetch("/api/admin/partners", { ...fetchInit }),
        fetch(`/api/admin/partners/applications?status=${partnerAppFilter}`, { ...fetchInit }),
        fetch("/api/admin/partners/applications?status=pending", { ...fetchInit })
      ]);
      const [bookingsJson, vehiclesJson, partnersJson, applicationsJson, pendingAppsJson] =
        await Promise.all([
        bookingsRes.json(),
        vehiclesRes.json(),
        partnersRes.json(),
        applicationsRes.json(),
        pendingAppsRes.json()
      ]);

      if (!bookingsRes.ok || !bookingsJson.ok) {
        setError(bookingsJson?.error?.message ?? "Failed to load bookings");
        return;
      }
      if (!vehiclesRes.ok || !vehiclesJson.ok) {
        setError(vehiclesJson?.error?.message ?? "Failed to load vehicles");
        return;
      }

      const nextVehicles = (vehiclesJson.data.vehicles as VehicleItem[]) ?? [];
      const nextBookings = bookingsJson.data.bookings as Booking[];
      setBookings(nextBookings);
      setAssignDraft(
        Object.fromEntries(
          nextBookings.map((booking) => [booking.id, booking.assigned_vehicle_id ?? ""])
        )
      );
      setVehicles(nextVehicles);

      if (!partnersRes.ok || !partnersJson.ok) {
        setError(partnersJson?.error?.message ?? "Failed to load partners");
      } else {
        const nextPartners = (partnersJson.data.partners as ApprovedPartner[]) ?? [];
        setApprovedPartners(nextPartners);
        if (nextPartners.length) {
          setVehicleForm((prev) => {
            if (nextPartners.some((partner) => partner.id === prev.owner_id)) return prev;
            return { ...prev, owner_id: nextPartners[0].id };
          });
        }
      }

      if (!applicationsRes.ok || !applicationsJson.ok) {
        setError((current) =>
          current ?? applicationsJson?.error?.message ?? "Failed to load partner applications"
        );
      } else {
        setPartnerApplications(applicationsJson.data.applications ?? []);
      }

      if (pendingAppsRes.ok && pendingAppsJson.ok) {
        setPendingPartnerCount((pendingAppsJson.data.applications ?? []).length);
      }

      if (editingVehicleId && !nextVehicles.some((vehicle) => vehicle.id === editingVehicleId)) {
        setEditingVehicleId(null);
        setVehicleForm(emptyVehicleForm);
      }
    } finally {
      setLoading(null);
    }
  }, [fetchInit, editingVehicleId, partnerAppFilter]);

  useEffect(() => {
    refreshAll().catch((e) => setError(String(e)));
  }, [refreshAll]);

  async function rejectBooking(bookingId: string) {
    setError(null);
    setLoading(`reject-${bookingId}`);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/reject`, {
        method: "POST",
        ...fetchInit,
        body: JSON.stringify({ reason: "Admin rejected during ops review" })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to reject booking");
      } else {
        showSuccess(`Booking ${bookingId} rejected.`);
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function approvePartnerApplication(userId: string) {
    setError(null);
    setLoading(`partner-approve-${userId}`);
    try {
      const res = await fetch(`/api/admin/partners/applications/${userId}/approve`, {
        method: "POST",
        ...fetchInit
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to approve partner application");
      } else {
        showSuccess(`Partner application approved for ${userId}.`);
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function rejectPartnerApplication(userId: string) {
    setError(null);
    setLoading(`partner-reject-${userId}`);
    try {
      const res = await fetch(`/api/admin/partners/applications/${userId}/reject`, {
        method: "POST",
        ...fetchInit,
        body: JSON.stringify({ reason: rejectReason || "Application not approved at this time." })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to reject partner application");
      } else {
        showSuccess(`Partner application rejected for ${userId}.`);
        setRejectingUserId(null);
        setRejectReason("");
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function approveBooking(bookingId: string) {
    setError(null);
    setLoading(`approve-${bookingId}`);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/approve`, {
        method: "POST",
        ...fetchInit,
        body: JSON.stringify({ note: "Approved for payment after ops review" })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to approve booking");
      } else {
        showSuccess(`Booking ${bookingId} approved for payment.`);
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function assignBookingUnit(bookingId: string) {
    const assignedVehicleId = assignDraft[bookingId];
    if (!assignedVehicleId) {
      setError("Select a physical bike before assigning.");
      return;
    }
    setError(null);
    setLoading(`assign-${bookingId}`);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/assign`, {
        method: "POST",
        ...fetchInit,
        body: JSON.stringify({ assigned_vehicle_id: assignedVehicleId })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to assign bike");
      } else {
        showSuccess(`Physical bike assigned for ${formatBookingReference(bookingId)}.`);
        if (json.data?.booking) {
          const updated = json.data.booking as Booking;
          setBookings((current) =>
            current.map((booking) => (booking.id === bookingId ? { ...booking, ...updated } : booking))
          );
          setAssignDraft((current) => ({
            ...current,
            [bookingId]: updated.assigned_vehicle_id ?? ""
          }));
        }
        setAssignmentEdit((current) => ({ ...current, [bookingId]: false }));
        setRecentlyAssigned((current) => new Set(current).add(bookingId));
        window.setTimeout(() => {
          setRecentlyAssigned((current) => {
            const next = new Set(current);
            next.delete(bookingId);
            return next;
          });
        }, 5000);
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function startBookingRide(bookingId: string) {
    setError(null);
    setLoading(`start-${bookingId}`);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/start`, {
        method: "POST",
        ...fetchInit
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to start booking");
      } else {
        showSuccess(`Booking ${bookingId} marked as ongoing.`);
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function completeBookingRide(bookingId: string) {
    setError(null);
    setLoading(`complete-${bookingId}`);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/complete`, {
        method: "POST",
        ...fetchInit
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to complete booking");
      } else {
        showSuccess(`Booking ${bookingId} marked as completed.`);
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function saveVehicle() {
    setError(null);
    setLoading("save-vehicle");
    try {
      const payload = {
        ...vehicleForm,
        catalog_vehicle_id: vehicleForm.catalog_vehicle_id.trim() || undefined,
        city: "bengaluru"
      };
      const url = editingVehicleId
        ? `/api/admin/vehicles/${editingVehicleId}`
        : "/api/admin/vehicles";
      const method = editingVehicleId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        ...fetchInit,
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to save vehicle");
        return;
      }
      const vehicleId = json?.data?.vehicle?.id as string | undefined;
      if (!editingVehicleId && vehicleId) {
        setEditingVehicleId(vehicleId);
      }
      showSuccess(editingVehicleId ? "Vehicle updated successfully." : "Vehicle created successfully.");
      await refreshAll();
    } finally {
      setLoading(null);
    }
  }

  function editVehicle(vehicle: VehicleItem) {
    setEditingVehicleId(vehicle.id);
    setVehicleForm(mapVehicleToForm(vehicle));
    setNewImageUrl("");
    setUploadFile(null);
    setUploadDocFile(null);
    setDocExpiresAt("");
    setError(null);
    
    // Fetch documents for the selected vehicle
    fetch(`/api/vehicles/${vehicle.id}/documents`, { credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        if (json.ok && json.data.documents) {
          setVehicleDocuments(json.data.documents);
        }
      })
      .catch((err) => console.error("Failed to load documents", err));
  }

  function resetVehicleEditor() {
    setEditingVehicleId(null);
    setVehicleForm(emptyVehicleForm);
    setNewImageUrl("");
    setUploadFile(null);
    setUploadDocFile(null);
    setDocExpiresAt("");
    setVehicleDocuments([]);
  }

  async function toggleVehicle(vehicle: VehicleItem) {
    setError(null);
    setLoading(`toggle-${vehicle.id}`);
    try {
      const res = await fetch(`/api/admin/vehicles/${vehicle.id}`, {
        method: "PATCH",
        ...fetchInit,
        body: JSON.stringify({ is_active: !vehicle.is_active })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to update vehicle status");
      } else {
        showSuccess(
          `Vehicle ${vehicle.id} ${vehicle.is_active ? "deactivated" : "activated"} successfully.`
        );
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function deleteVehicle(vehicleId: string) {
    if (!window.confirm(`Delete vehicle ${vehicleId}? This cannot be undone.`)) return;
    setError(null);
    setLoading(`delete-${vehicleId}`);
    try {
      const res = await fetch(`/api/admin/vehicles/${vehicleId}`, {
        method: "DELETE",
        ...fetchInit
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to delete vehicle");
      } else {
        showSuccess(`Vehicle ${vehicleId} deleted.`);
        if (editingVehicleId === vehicleId) resetVehicleEditor();
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function addImageUrl() {
    if (!editingVehicleId) {
      setError("Create or select a vehicle first before adding images.");
      return;
    }
    if (!newImageUrl.trim()) {
      setError("Enter an image URL.");
      return;
    }
    setError(null);
    setLoading("image-url");
    try {
      const res = await fetch(`/api/admin/vehicles/${editingVehicleId}/images`, {
        method: "POST",
        ...fetchInit,
        body: JSON.stringify({ image_url: newImageUrl.trim() })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to add image URL");
      } else {
        setNewImageUrl("");
        showSuccess("Image URL added.");
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function uploadVehicleImage() {
    if (!editingVehicleId) {
      setError("Create or select a vehicle first before uploading images.");
      return;
    }
    if (!uploadFile) {
      setError("Choose an image file first.");
      return;
    }
    setError(null);
    setLoading("image-file");
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      const res = await fetch(`/api/admin/vehicles/${editingVehicleId}/images`, {
        method: "POST",
        credentials: "include",
        body: formData
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to upload image");
      } else {
        setUploadFile(null);
        showSuccess("Vehicle image uploaded.");
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  async function uploadVehicleDocument() {
    if (!editingVehicleId) {
      setError("Create or select a vehicle first before uploading documents.");
      return;
    }
    if (!uploadDocFile) {
      setError("Choose a document file first.");
      return;
    }
    setError(null);
    setLoading("document-file");
    try {
      const formData = new FormData();
      formData.append("file", uploadDocFile);
      formData.append("doc_type", docType);
      if (docExpiresAt) {
        formData.append("expires_at", docExpiresAt);
      }
      
      const res = await fetch(`/api/admin/vehicles/${editingVehicleId}/documents`, {
        method: "POST",
        credentials: "include",
        body: formData
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to upload document");
      } else {
        setUploadDocFile(null);
        setDocExpiresAt("");
        showSuccess("Vehicle document uploaded.");
        // Refresh documents
        const docRes = await fetch(`/api/vehicles/${editingVehicleId}/documents`, { credentials: "include" });
        const docJson = await docRes.json();
        if (docJson.ok) {
          setVehicleDocuments(docJson.data.documents || []);
        }
      }
    } finally {
      setLoading(null);
    }
  }

  async function removeImage(imageUrl: string) {
    if (!selectedVehicle) return;
    setError(null);
    setLoading("remove-image");
    try {
      const nextImages = (selectedVehicle.image_urls ?? []).filter((item) => item !== imageUrl);
      const res = await fetch(`/api/admin/vehicles/${selectedVehicle.id}`, {
        method: "PATCH",
        ...fetchInit,
        body: JSON.stringify({ image_urls: nextImages })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to remove image");
      } else {
        showSuccess("Image removed.");
        await refreshAll();
      }
    } finally {
      setLoading(null);
    }
  }

  const statusCounts = bookings.reduce<Record<string, number>>((acc, booking) => {
    acc[booking.status] = (acc[booking.status] || 0) + 1;
    return acc;
  }, {});

  const filteredBookings =
    bookingFilter === "all" ? bookings : bookings.filter((booking) => booking.status === bookingFilter);
  const approvableStatuses = new Set(["pending_kyc", "admin_review"]);
  const assignableStatuses = new Set(["confirmed", "ongoing", "extension_requested", "extended"]);

  const totalRevenue = bookings
    .filter((booking) =>
      ["confirmed", "ongoing", "completed", "extended"].includes(booking.status)
    )
    .reduce((sum, booking) => sum + (booking.quote?.total_payable ?? 0), 0);

  const activeFleetCount = vehicles.filter((vehicle) => vehicle.is_active).length;
  const inactiveFleetCount = vehicles.length - activeFleetCount;

  const filterTabs = [
    { key: "all", label: "All" },
    { key: "pending_kyc", label: "Pending review" },
    { key: "admin_review", label: "Admin Review" },
    { key: "payment_pending", label: "Payment Pending" },
    { key: "confirmed", label: "Confirmed" },
    { key: "ongoing", label: "Ongoing" },
    { key: "cancelled", label: "Cancelled" }
  ];

  const sortedVehicles = [...vehicles].sort((a, b) => a.id.localeCompare(b.id));
  const partnerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const partner of approvedPartners) {
      map.set(partner.id, partner.name);
    }
    return map;
  }, [approvedPartners]);
  const initialLoading = loading === "refresh" && bookings.length === 0 && vehicles.length === 0;

  return (
    <div className="dashboard-layout ops-shell">
      <Sidebar role="admin" navItems={[...navItems]} userName="Admin (ops)" />

      <div className="dashboard-content">
        <div className="flex-between mb-6">
          <div className="page-header" style={{ marginBottom: 0 }}>
            <h1 className="inline-flex items-center gap-2">
              <Icon name="settings" className="w-5 h-5" />
              Admin Dashboard
            </h1>
            <p>Booking operations, fleet controls, and approval review.</p>
          </div>
          <button className="btn btn-secondary" onClick={refreshAll} disabled={!!loading}>
            {loading === "refresh" ? <span className="spinner" /> : <Icon name="refresh" className="w-4 h-4" />} Refresh All
          </button>
        </div>

        {error && (
          <div className="error-banner inline-flex items-center gap-2">
            <Icon name="warning" className="w-4 h-4" />
            {error}
          </div>
        )}
        {successMsg && (
          <div className="success-banner inline-flex items-center gap-2">
            <Icon name="checkCircle" className="w-4 h-4" />
            {successMsg}
          </div>
        )}

        {initialLoading ? (
          <>
            <StatCardsSkeleton />
            <Skeleton className="mb-6 h-72 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </>
        ) : (
        <>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Bookings</div>
            <div className="stat-value">{bookings.length}</div>
            <div className="stat-sub">All statuses</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Admin Review Queue</div>
            <div className="stat-value accent">{statusCounts["admin_review"] || 0}</div>
            <div className="stat-sub">Awaiting approval</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Fleet</div>
            <div className="stat-value">{activeFleetCount}</div>
            <div className="stat-sub">Inactive: {inactiveFleetCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Rides</div>
            <div className="stat-value">{statusCounts["ongoing"] || 0}</div>
            <div className="stat-sub">Currently ongoing</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Platform Revenue</div>
            <div className="stat-value accent" style={{ fontSize: "1.4rem" }}>
              ₹{totalRevenue.toLocaleString()}
            </div>
            <div className="stat-sub">Confirmed + active</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Partner Applications</div>
            <div className="stat-value accent">{pendingPartnerCount}</div>
            <div className="stat-sub">Pending review</div>
          </div>
        </div>

        <div id="partner-applications" className="mb-6">
          <div className="section-header mb-4">
            <div>
              <h2 className="inline-flex items-center gap-2">
                <Icon name="briefcase" className="w-5 h-5" />
                Partner Applications
              </h2>
              <p>Review partner onboarding requests before granting dashboard access.</p>
            </div>
          </div>

          <div className="partner-tab-row mb-4">
            {(["pending", "approved", "rejected", "all"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                className={`partner-tab${partnerAppFilter === filter ? " active" : ""}`}
                onClick={() => setPartnerAppFilter(filter)}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          <div className="card partner-table-card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Business</th>
                    <th>Applied</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerApplications.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="partner-empty-cell">
                        No applications in this filter
                      </td>
                    </tr>
                  ) : (
                    partnerApplications.map((application) => {
                      const status = application.partner_application_status ?? "approved";
                      return (
                      <tr key={application.id}>
                        <td>{application.name}</td>
                        <td>{application.email ?? "—"}</td>
                        <td>{application.phone ?? "—"}</td>
                        <td>{application.partner_business_name ?? "—"}</td>
                        <td>{formatDate(application.partner_applied_at ?? undefined)}</td>
                        <td>
                          <span className={`badge badge-${status}`}>
                            {status}
                          </span>
                        </td>
                        <td>
                          {application.partner_application_status === "pending" ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={!!loading}
                                onClick={() => approvePartnerApplication(application.id)}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={!!loading}
                                onClick={() => setRejectingUserId(application.id)}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {rejectingUserId ? (
            <div className="card mt-4 p-4">
              <div className="form-label mb-2">Rejection reason</div>
              <textarea
                className="form-input mb-3"
                rows={3}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Reason sent to the partner by email"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setRejectingUserId(null);
                    setRejectReason("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!!loading}
                  onClick={() => rejectPartnerApplication(rejectingUserId)}
                >
                  Confirm reject
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div id="fleet" className="mb-6">
          <div className="section-header mb-4">
            <div>
              <h2 className="inline-flex items-center gap-2">
                <Icon name="bike" className="w-5 h-5" />
                Fleet Operations
              </h2>
              <p>Create, update, deactivate, delete vehicles, and manage images.</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="card p-4 lg:col-span-1">
              <div className="flex-between mb-4">
                <div style={{ fontWeight: 700 }}>
                  {editingVehicleId ? `Editing ${editingVehicleId}` : "Add New Vehicle"}
                </div>
                {editingVehicleId && (
                  <button className="btn btn-secondary btn-sm" onClick={resetVehicleEditor}>
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="form-row mb-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="form-group">
                  <label className="form-label">Partner owner</label>
                  <select
                    className="form-input form-select"
                    value={vehicleForm.owner_id}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({ ...prev, owner_id: event.target.value }))
                    }
                  >
                    {approvedPartners.length === 0 ? (
                      <option value="">No approved partners</option>
                    ) : (
                      approvedPartners.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.name} ({partner.id}) · {partner.vehicle_count} vehicles
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-input form-select"
                    value={vehicleForm.category}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        category: event.target.value as VehicleForm["category"]
                      }))
                    }
                  >
                    <option value="scooter">Scooter</option>
                    <option value="bike">Bike</option>
                    <option value="ev_bike">EV Bike</option>
                  </select>
                </div>
              </div>

              <div className="form-row mb-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="form-group">
                  <label className="form-label">Brand</label>
                  <input
                    className="form-input"
                    value={vehicleForm.brand}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({ ...prev, brand: event.target.value }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input
                    className="form-input"
                    value={vehicleForm.model}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({ ...prev, model: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="form-row mb-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="form-group">
                  <label className="form-label">Reg Number</label>
                  <input
                    className="form-input"
                    value={vehicleForm.registration_number || ""}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({ ...prev, registration_number: event.target.value }))
                    }
                    placeholder="KA-01-AB-1234"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Chassis No.</label>
                  <input
                    className="form-input"
                    value={vehicleForm.chassis_number || ""}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({ ...prev, chassis_number: event.target.value }))
                    }
                  />
                </div>
              </div>

              {vehicleForm.chassis_number.trim() ? (
                <div className="form-group mb-3">
                  <label className="form-label">Fleet model (for booking assignment)</label>
                  <select
                    className="form-input form-select"
                    value={vehicleForm.catalog_vehicle_id}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        catalog_vehicle_id: event.target.value
                      }))
                    }
                  >
                    <option value="">Auto-detect from brand/model</option>
                    {PUBLIC_FLEET.map((catalog) => (
                      <option key={catalog.id} value={catalog.id}>
                        {catalog.brand} {catalog.model}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="form-row mb-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="form-group">
                  <label className="form-label">Deposit (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={vehicleForm.deposit_amount}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        deposit_amount: Number(event.target.value)
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Hourly Rate (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={vehicleForm.rate_per_hour}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        rate_per_hour: Number(event.target.value)
                      }))
                    }
                  />
                </div>
              </div>

              <div className="form-row mb-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="form-group">
                  <label className="form-label">Daily Rate (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={vehicleForm.rate_per_day}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        rate_per_day: Number(event.target.value)
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Weekly Rate (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={vehicleForm.rate_per_week}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        rate_per_week: Number(event.target.value)
                      }))
                    }
                  />
                </div>
              </div>

              <div className="form-row mb-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="form-group">
                  <label className="form-label">Monthly Rate (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={vehicleForm.rate_per_month}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        rate_per_month: Number(event.target.value)
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-input form-select"
                    value={vehicleForm.is_active ? "active" : "inactive"}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        is_active: event.target.value === "active"
                      }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <button className="btn btn-primary w-full" onClick={saveVehicle} disabled={!!loading}>
                {loading === "save-vehicle" ? <span className="spinner" /> : <Icon name="checkCircle" className="w-4 h-4" />}
                {editingVehicleId ? "Update Vehicle" : "Create Vehicle"}
              </button>

              {selectedVehicle && (
                <div style={{ marginTop: 18, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>Vehicle Images</div>
                  <div className="form-group mb-2">
                    <label className="form-label">Add Image URL</label>
                    <div className="flex gap-2">
                      <input
                        className="form-input"
                        value={newImageUrl}
                        onChange={(event) => setNewImageUrl(event.target.value)}
                        placeholder="https://..."
                      />
                      <button className="btn btn-secondary btn-sm" onClick={addImageUrl} disabled={!!loading}>
                        {loading === "image-url" ? <span className="spinner" /> : "Add"}
                      </button>
                    </div>
                  </div>

                  <div className="form-group mb-3">
                    <label className="form-label">Upload Image File</label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        className="form-input"
                        accept="image/*"
                        onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                      />
                      <button className="btn btn-secondary btn-sm" onClick={uploadVehicleImage} disabled={!!loading}>
                        {loading === "image-file" ? <span className="spinner" /> : "Upload"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(selectedVehicle.image_urls ?? []).map((imageUrl) => (
                      <div key={imageUrl} className="card p-2">
                        <img
                          src={imageUrl}
                          alt="vehicle"
                          style={{
                            width: "100%",
                            height: 74,
                            objectFit: "cover",
                            borderRadius: 8,
                            border: "1px solid rgba(0,0,0,0.08)"
                          }}
                        />
                        <button
                          className="btn btn-danger btn-sm w-full mt-2"
                          onClick={() => removeImage(imageUrl)}
                          disabled={!!loading}
                        >
                          {loading === "remove-image" ? <span className="spinner" /> : "Remove"}
                        </button>
                      </div>
                    ))}
                    {(selectedVehicle.image_urls ?? []).length === 0 && (
                      <div className="text-xs text-muted">No images added yet.</div>
                    )}
                  </div>
                </div>
              )}

              {selectedVehicle && (
                <div style={{ marginTop: 18, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>Vehicle Documents</div>
                  
                  <div className="form-row mb-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <div className="form-group">
                      <label className="form-label">Document Type</label>
                      <select
                        className="form-input form-select"
                        value={docType}
                        onChange={(e) => setDocType(e.target.value as any)}
                      >
                        <option value="rc">Registration (RC)</option>
                        <option value="insurance">Insurance</option>
                        <option value="invoice">Invoice</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Expiry (Optional)</label>
                      <input
                        type="date"
                        className="form-input"
                        value={docExpiresAt}
                        onChange={(e) => setDocExpiresAt(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group mb-3">
                    <label className="form-label">Upload Document</label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        className="form-input"
                        accept="application/pdf,image/*"
                        onChange={(event) => setUploadDocFile(event.target.files?.[0] ?? null)}
                      />
                      <button className="btn btn-secondary btn-sm" onClick={uploadVehicleDocument} disabled={!!loading}>
                        {loading === "document-file" ? <span className="spinner" /> : "Upload"}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {vehicleDocuments.map((doc: any) => (
                      <div key={doc.id} className="card p-2 flex-between">
                        <div>
                          <div style={{ fontWeight: 600 }}>{doc.doc_type.toUpperCase()}</div>
                          <div className="text-xs text-muted">Expires: {doc.expires_at ? formatDate(doc.expires_at) : "N/A"}</div>
                        </div>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                          View
                        </a>
                      </div>
                    ))}
                    {vehicleDocuments.length === 0 && (
                      <div className="text-xs text-muted">No documents uploaded yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="card p-4 lg:col-span-2 admin-fleet-vehicle-list">
              <div className="section-header mb-4">
                <div>
                  <h2 className="inline-flex items-center gap-2">
                    <Icon name="list" className="w-5 h-5" />
                    Vehicle List
                  </h2>
                  <p>{sortedVehicles.length} vehicles in admin fleet catalog</p>
                </div>
              </div>
              <div className="table-container">
                <table className="admin-fleet-table">
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Owner</th>
                      <th>Rates</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVehicles.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="admin-fleet-table__empty">
                          No vehicles in fleet yet.
                        </td>
                      </tr>
                    ) : (
                      sortedVehicles.map((vehicle) => {
                        const ownerName = partnerNameById.get(vehicle.owner_id);
                        const thumb = resolveVehicleThumbnail(vehicle);
                        return (
                          <tr key={vehicle.id}>
                            <td className="admin-fleet-table__vehicle">
                              <div className="admin-fleet-table__vehicle-inner">
                                <img
                                  src={thumb.src}
                                  alt={thumb.alt}
                                  className="ops-vehicle-thumb"
                                  loading="lazy"
                                  onError={(event) => {
                                    event.currentTarget.src = thumb.fallback;
                                  }}
                                />
                                <div className="admin-fleet-table__vehicle-copy">
                                  <div className="admin-fleet-table__vehicle-name">
                                    {getVehicleDisplayName(vehicle.id, {
                                      brand: vehicle.brand,
                                      model: vehicle.model
                                    })}
                                  </div>
                                  <div className="admin-fleet-table__vehicle-meta">
                                    {vehicle.registration_number || truncateFleetId(vehicle.id)}
                                  </div>
                                  <div className="admin-fleet-table__vehicle-meta">{vehicle.category}</div>
                                </div>
                              </div>
                            </td>
                            <td className="admin-fleet-table__owner">
                              <div className="admin-fleet-table__owner-name" title={vehicle.owner_id}>
                                {ownerName ?? truncateFleetId(vehicle.owner_id, 20)}
                              </div>
                              {ownerName ? (
                                <div className="admin-fleet-table__owner-id" title={vehicle.owner_id}>
                                  {truncateFleetId(vehicle.owner_id)}
                                </div>
                              ) : null}
                            </td>
                            <td className="admin-fleet-table__rates">
                              <dl className="admin-fleet-rates">
                                <div>
                                  <dt>Day</dt>
                                  <dd>₹{vehicle.rate_per_day}</dd>
                                </div>
                                <div>
                                  <dt>Week</dt>
                                  <dd>₹{vehicle.rate_per_week}</dd>
                                </div>
                                <div>
                                  <dt>Month</dt>
                                  <dd>₹{vehicle.rate_per_month}</dd>
                                </div>
                                {vehicle.rate_per_hour > 0 ? (
                                  <div>
                                    <dt>Hour</dt>
                                    <dd>₹{vehicle.rate_per_hour}</dd>
                                  </div>
                                ) : null}
                              </dl>
                            </td>
                            <td className="admin-fleet-table__status">
                              <StatusBadge status={vehicle.is_active ? "active" : "cancelled"} />
                            </td>
                            <td className="admin-fleet-table__actions">
                              <div className="admin-fleet-table__action-group">
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => editVehicle(vehicle)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => toggleVehicle(vehicle)}
                                  disabled={!!loading}
                                >
                                  {loading === `toggle-${vehicle.id}` ? (
                                    <span className="spinner" />
                                  ) : vehicle.is_active ? (
                                    "Deactivate"
                                  ) : (
                                    "Activate"
                                  )}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => deleteVehicle(vehicle.id)}
                                  disabled={!!loading}
                                >
                                  {loading === `delete-${vehicle.id}` ? <span className="spinner" /> : "Delete"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div id="bookings" className="mb-6">
          <div className="section-header mb-4">
            <div>
              <h2 className="inline-flex items-center gap-2">
                <Icon name="list" className="w-5 h-5" />
                All Bookings
              </h2>
              <p>
                {filteredBookings.length} booking
                {filteredBookings.length !== 1 ? "s" : ""} shown
              </p>
            </div>
          </div>

          <div className="filter-tabs">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                className={`filter-tab${bookingFilter === tab.key ? " active" : ""}`}
                onClick={() => setBookingFilter(tab.key)}
              >
                {tab.label}
                {tab.key !== "all" && statusCounts[tab.key] ? (
                  <span
                    style={{
                      marginLeft: 4,
                      background: "var(--surface-highest)",
                      borderRadius: "100px",
                      padding: "0 5px",
                      fontSize: "0.65rem"
                    }}
                  >
                    {statusCounts[tab.key]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {filteredBookings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon inline-flex items-center justify-center">
                <Icon name="list" className="w-6 h-6" />
              </div>
              <p>No bookings found.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Customer</th>
                    <th>Vehicle</th>
                    <th>Pickup</th>
                    <th>Drop</th>
                    <th>Status</th>
                    <th>Review</th>
                    <th>Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="td-id">{formatBookingReference(booking.id)}</td>
                      <td className="td-muted">
                        <div style={{ fontWeight: 700, color: "var(--on-surface)" }}>
                          {booking.user?.name ?? booking.user_id}
                        </div>
                        <div className="text-xs text-muted">{booking.user?.email ?? booking.user_id}</div>
                        {booking.user?.phone && <div className="text-xs text-muted">{booking.user.phone}</div>}
                        <div style={{ marginTop: 6 }}>
                          <KycStatusBadge status={booking.user?.kyc_status} />
                        </div>
                      </td>
                      <td className="td-muted">
                        <div style={{ fontWeight: 700 }}>{getVehicleDisplayName(booking.vehicle_id)}</div>
                        <div className="text-xs text-muted">{booking.vehicle_id}</div>
                        {assignableStatuses.has(booking.status) ? (
                          booking.assigned_vehicle_id && !assignmentEdit[booking.id] ? (
                            <div
                              style={{
                                marginTop: 8,
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: recentlyAssigned.has(booking.id)
                                  ? "1px solid #86efac"
                                  : "1px solid rgba(0,0,0,0.08)",
                                background: recentlyAssigned.has(booking.id) ? "#f0fdf4" : "#fafafa"
                              }}
                            >
                              <span className="badge badge-verified" style={{ marginBottom: 6 }}>
                                {recentlyAssigned.has(booking.id) ? "Bike assigned just now" : "Bike assigned"}
                              </span>
                              <div className="text-xs" style={{ fontWeight: 700, color: "var(--primary)" }}>
                                {vehicleById[booking.assigned_vehicle_id]?.chassis_number ??
                                  booking.assigned_vehicle_id}
                                {vehicleById[booking.assigned_vehicle_id]?.registration_number
                                  ? ` (${vehicleById[booking.assigned_vehicle_id]?.registration_number})`
                                  : ""}
                              </div>
                              {booking.assigned_at ? (
                                <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                                  Since {formatDate(booking.assigned_at)}
                                </div>
                              ) : null}
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ marginTop: 8 }}
                                onClick={() => {
                                  setAssignmentEdit((current) => ({ ...current, [booking.id]: true }));
                                  setAssignDraft((current) => ({
                                    ...current,
                                    [booking.id]: booking.assigned_vehicle_id ?? ""
                                  }));
                                }}
                              >
                                Change bike
                              </button>
                            </div>
                          ) : (
                            <div style={{ marginTop: 8 }}>
                              <div className="text-xs text-muted" style={{ marginBottom: 6 }}>
                                {booking.assigned_vehicle_id
                                  ? "Pick a different physical unit:"
                                  : "Link a chassis number to this booking:"}
                              </div>
                              {(() => {
                                const availableUnits = unitsForBooking(booking);
                                return (
                                  <>
                                    <div className="text-xs text-muted" style={{ marginBottom: 6 }}>
                                      {availableUnits.length} unit
                                      {availableUnits.length === 1 ? "" : "s"} available for{" "}
                                      {getVehicleDisplayName(booking.vehicle_id)}
                                    </div>
                                    {availableUnits.length === 0 ? (
                                      <div
                                        className="text-xs"
                                        style={{ color: "#92400e", marginBottom: 6 }}
                                      >
                                        No free units linked to this model. Edit a physical bike and
                                        set its fleet model, or wait until overlapping bookings end.
                                      </div>
                                    ) : null}
                                    <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                                      <select
                                        className="form-input"
                                        style={{ minWidth: 180, fontSize: "0.75rem" }}
                                        value={assignDraft[booking.id] ?? ""}
                                        onChange={(event) =>
                                          setAssignDraft((current) => ({
                                            ...current,
                                            [booking.id]: event.target.value
                                          }))
                                        }
                                      >
                                        <option value="">Select physical bike</option>
                                        {availableUnits.map((unit) => (
                                          <option key={unit.id} value={unit.id}>
                                            {unit.chassis_number}
                                            {unit.registration_number
                                              ? ` (${unit.registration_number})`
                                              : ""}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => assignBookingUnit(booking.id)}
                                        disabled={
                                          loading === `assign-${booking.id}` ||
                                          availableUnits.length === 0
                                        }
                                      >
                                        {loading === `assign-${booking.id}` ? (
                                          <span className="spinner" />
                                        ) : booking.assigned_vehicle_id ? (
                                          "Update assignment"
                                        ) : (
                                          "Assign bike"
                                        )}
                                      </button>
                                      {booking.assigned_vehicle_id ? (
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          onClick={() =>
                                            setAssignmentEdit((current) => ({
                                              ...current,
                                              [booking.id]: false
                                            }))
                                          }
                                        >
                                          Cancel
                                        </button>
                                      ) : null}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          )
                        ) : booking.assigned_vehicle_id ? (
                          <div className="text-xs" style={{ marginTop: 4, color: "var(--primary)" }}>
                            Assigned:{" "}
                            {vehicleById[booking.assigned_vehicle_id]?.chassis_number ??
                              booking.assigned_vehicle_id}
                          </div>
                        ) : null}
                      </td>
                      <td className="td-muted">
                        <div>{formatDate(booking.pickup_at)}</div>
                        <div className="text-xs text-muted">{booking.pickup_zone ?? "Bengaluru"}</div>
                      </td>
                      <td className="td-muted">{formatDate(booking.drop_at)}</td>
                      <td>
                        <StatusBadge status={booking.status} />
                      </td>
                      <td>
                        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                          <span className="spec-chip">
                            {approvableStatuses.has(booking.status)
                              ? "Awaiting admin approval"
                              : booking.status === "payment_pending"
                                ? "Payment link sent"
                                : formatBookingStatus(booking.status)}
                          </span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: "var(--primary)" }}>
                        {booking.quote?.total_payable
                          ? `₹${booking.quote.total_payable.toLocaleString()}`
                          : "-"}
                      </td>
                      <td>
                        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                          {approvableStatuses.has(booking.status) && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => approveBooking(booking.id)}
                              disabled={loading === `approve-${booking.id}`}
                            >
                              {loading === `approve-${booking.id}` ? (
                                <span className="spinner" />
                              ) : (
                                <Icon name="checkCircle" className="w-4 h-4" />
                              )}{" "}
                              Approve
                            </button>
                          )}
                          {["confirmed", "extended", "extension_requested"].includes(booking.status) && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => startBookingRide(booking.id)}
                              disabled={loading === `start-${booking.id}`}
                            >
                              {loading === `start-${booking.id}` ? (
                                <span className="spinner" />
                              ) : (
                                <Icon name="scooter" className="w-4 h-4" />
                              )}{" "}
                              Start
                            </button>
                          )}
                          {["ongoing", "extended"].includes(booking.status) && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => completeBookingRide(booking.id)}
                              disabled={loading === `complete-${booking.id}`}
                            >
                              {loading === `complete-${booking.id}` ? (
                                <span className="spinner" />
                              ) : (
                                <Icon name="checkCircle" className="w-4 h-4" />
                              )}{" "}
                              Complete
                            </button>
                          )}
                        {!["cancelled", "completed"].includes(booking.status) && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => rejectBooking(booking.id)}
                            disabled={loading === `reject-${booking.id}`}
                          >
                            {loading === `reject-${booking.id}` ? (
                              <span className="spinner" />
                            ) : (
                              <Icon name="close" className="w-4 h-4" />
                            )}{" "}
                            Reject
                          </button>
                        )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
