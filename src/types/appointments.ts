export interface AppointmentService {
    id: string;
    name: string;
    durationMin: number;
    price: number;
}

export type AppointmentStatus = 'booked' | 'canceled' | 'completed';
export type AuthState = 'checking' | 'authenticated' | 'unauthenticated';

export interface TimeSlot {
    id: string;
    time: string;
    available: boolean;
}

export interface ScheduleDay {
    dateISO: string;
    label: string;
    slots: TimeSlot[];
}

export interface BookingFormData {
    name: string;
    email: string;
    phone: string;
    notes?: string;
}

export interface SelectedBooking {
    serviceId: string;
    dateISO: string;
    slotId: string;
}

export interface UserAppointment {
    id: string;
    user_id: string;
    service_id: string;
    date_iso: string;
    slot_time: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    notes: string | null;
    status: AppointmentStatus;
}

export interface BusinessShift {
    id: number;
    weekday: number;
    open_time: string;
    close_time: string;
    is_active: boolean;
}
