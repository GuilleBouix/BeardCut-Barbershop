export interface AppointmentService {
    id: string;
    name: string;
    durationMin: number;
    price: number;
}

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

export interface BusinessShift {
    id: number;
    weekday: number;
    open_time: string;
    close_time: string;
    is_active: boolean;
}
