export type AdminTabKey = "appointments" | "services" | "business";

export interface AdminService {
  id: string;
  name: string;
  duration_min: number;
  price: number;
  active: boolean;
}

export interface AdminAppointment {
  id: string;
  user_id: string;
  service_id: string;
  date_iso: string;
  slot_time: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
  status: "booked" | "canceled" | "completed";
  created_at?: string;
}

export interface AdminShift {
  id?: string;
  weekday: number;
  open_time: string;
  close_time: string;
  is_active: boolean;
}

export interface BusinessIncome {
  id: string;
  appointment_id: string;
  service_id: string;
  amount: number;
  recorded_by: string;
  created_at: string;
}
