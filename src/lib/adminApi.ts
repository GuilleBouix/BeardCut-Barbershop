import type { AdminAppointment, AdminService, AdminShift } from "../types/admin";
import { supabaseClient } from "./supabaseClient";

const APPOINTMENTS_COLUMNS =
  "id,user_id,service_id,date_iso,slot_time,customer_name,customer_email,customer_phone,notes,status,created_at";

const normalizeError = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: string }).message ?? fallback);
  }
  return fallback;
};

export const getAdminSession = async () => {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    throw new Error(normalizeError(error, "Could not read auth session."));
  }
  return data.session;
};

export const isAdminUser = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabaseClient
    .from("admin_users")
    .select("id,user_id")
    .eq("user_id", userId)
    .limit(1);

  if (error) {
    throw new Error(normalizeError(error, "Could not verify admin user."));
  }

  return (data ?? []).length > 0;
};

export const fetchAdminAppointments = async (): Promise<AdminAppointment[]> => {
  const { data, error } = await supabaseClient
    .from("appointments")
    .select(APPOINTMENTS_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(normalizeError(error, "Could not load appointments."));
  }

  return (data ?? []) as AdminAppointment[];
};

export const updateAppointmentStatus = async (
  appointmentId: string,
  status: AdminAppointment["status"],
): Promise<void> => {
  const { error } = await supabaseClient
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId);

  if (error) {
    throw new Error(normalizeError(error, "Could not update appointment status."));
  }
};

export const createIncomeRecord = async (payload: {
  appointment_id: string;
  service_id: string;
  amount: number;
  recorded_by: string;
}): Promise<void> => {
  const { error } = await supabaseClient.from("business_income").insert(payload);
  if (error) {
    throw new Error(normalizeError(error, "Could not record business income."));
  }
};

export const fetchAdminServices = async (): Promise<AdminService[]> => {
  const { data, error } = await supabaseClient
    .from("services")
    .select("id,name,duration_min,price,active,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(normalizeError(error, "Could not load services."));
  }

  return (data ?? []) as AdminService[];
};

export const createService = async (
  service: Omit<AdminService, "id">,
): Promise<void> => {
  const { error } = await supabaseClient.from("services").insert(service);
  if (error) {
    throw new Error(normalizeError(error, "Could not create service."));
  }
};

export const updateService = async (service: AdminService): Promise<void> => {
  const { error } = await supabaseClient
    .from("services")
    .update({
      name: service.name,
      duration_min: service.duration_min,
      price: service.price,
      active: service.active,
    })
    .eq("id", service.id);

  if (error) {
    throw new Error(normalizeError(error, "Could not update service."));
  }
};

export const deleteService = async (serviceId: string): Promise<void> => {
  const { error } = await supabaseClient.from("services").delete().eq("id", serviceId);
  if (error) {
    throw new Error(normalizeError(error, "Could not delete service."));
  }
};

export const fetchAdminShifts = async (): Promise<AdminShift[]> => {
  const { data, error } = await supabaseClient
    .from("business_shifts")
    .select("id,weekday,open_time,close_time,is_active")
    .order("weekday", { ascending: true });

  if (error) {
    throw new Error(normalizeError(error, "Could not load business shifts."));
  }

  return (data ?? []) as AdminShift[];
};

export const deleteShift = async (shiftId: string): Promise<void> => {
  const { error } = await supabaseClient
    .from("business_shifts")
    .delete()
    .eq("id", shiftId);

  if (error) {
    throw new Error(normalizeError(error, "Could not delete business shift."));
  }
};

export const fetchBusinessIncome = async (): Promise<{ amount: number }[]> => {
  const { data, error } = await supabaseClient
    .from("business_income")
    .select("amount");

  if (error) {
    throw new Error(normalizeError(error, "Could not load business income."));
  }

  return (data ?? []) as { amount: number }[];
};

export const createShift = async (shift: AdminShift): Promise<void> => {
  const { error } = await supabaseClient.from("business_shifts").insert(shift);
  if (error) {
    throw new Error(normalizeError(error, "Could not create business shift."));
  }
};

export const updateShift = async (shift: AdminShift): Promise<void> => {
  if (!shift.id) {
    throw new Error("Missing shift id.");
  }

  const { error } = await supabaseClient
    .from("business_shifts")
    .update({
      weekday: shift.weekday,
      open_time: shift.open_time,
      close_time: shift.close_time,
      is_active: shift.is_active,
    })
    .eq("id", shift.id);

  if (error) {
    throw new Error(normalizeError(error, "Could not update business shift."));
  }
};
