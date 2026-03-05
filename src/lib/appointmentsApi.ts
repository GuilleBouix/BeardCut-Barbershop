import type { Session } from "@supabase/supabase-js";
import { supabaseClient } from "./supabaseClient";
import type { UserAppointment } from "../types/appointments";

const APPOINTMENTS_COLUMNS =
  "id,user_id,service_id,date_iso,slot_time,customer_name,customer_email,customer_phone,notes,status,created_at,updated_at";

export interface CreateAppointmentInput {
  serviceId: string;
  dateISO: string;
  slotTime: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes?: string;
}

const normalizeError = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: string }).message ?? fallback);
  }
  return fallback;
};

export const getCurrentSession = async (): Promise<Session | null> => {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    throw new Error(normalizeError(error, "Could not read auth session."));
  }

  return data.session;
};

export const getMyActiveAppointment = async (): Promise<UserAppointment | null> => {
  const { data, error } = await supabaseClient
    .from("appointments")
    .select(APPOINTMENTS_COLUMNS)
    .eq("status", "booked")
    .order("date_iso", { ascending: true })
    .order("slot_time", { ascending: true });

  if (error) {
    const message = normalizeError(error, "Could not load your active appointment.");
    if (
      message.includes("relation") ||
      message.includes("appointments") ||
      message.includes("permission denied")
    ) {
      return null;
    }
    throw new Error(
      message,
    );
  }

  const now = new Date();
  const active =
    (data as UserAppointment[]).find((item) => {
      const at = new Date(`${item.date_iso}T${String(item.slot_time).slice(0, 5)}:00`);
      return at.getTime() > now.getTime();
    }) ?? null;

  return active;
};

export const getBookedSlotsByDate = async (dateISO: string): Promise<string[]> => {
  const { data, error } = await supabaseClient
    .from("appointments")
    .select("slot_time")
    .eq("status", "booked")
    .eq("date_iso", dateISO);

  if (error) {
    const message = normalizeError(
      error,
      "Could not load occupied slots for selected date.",
    );
    if (
      message.includes("relation") ||
      message.includes("appointments") ||
      message.includes("permission denied")
    ) {
      return [];
    }
    throw new Error(
      message,
    );
  }

  return (data ?? []).map((row) => String(row.slot_time).slice(0, 5));
};

export const createAppointment = async (
  input: CreateAppointmentInput,
): Promise<UserAppointment> => {
  const { data, error } = await supabaseClient.rpc("create_appointment", {
    p_service_id: input.serviceId,
    p_date_iso: input.dateISO,
    p_slot_time: input.slotTime,
    p_customer_name: input.customerName,
    p_customer_email: input.customerEmail,
    p_customer_phone: input.customerPhone,
    p_notes: input.notes?.trim() || null,
  });

  if (error) {
    throw new Error(
      normalizeError(error, "Could not create appointment. Please try again."),
    );
  }

  return data as UserAppointment;
};

export const cancelAppointment = async (
  appointmentId: string,
): Promise<UserAppointment> => {
  const { data, error } = await supabaseClient.rpc("cancel_my_appointment", {
    p_appointment_id: appointmentId,
  });

  if (error) {
    throw new Error(
      normalizeError(error, "Could not cancel appointment. Please try again."),
    );
  }

  return data as UserAppointment;
};
