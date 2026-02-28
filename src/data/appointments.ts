import type { AppointmentService } from '../types/appointments';

export const APPOINTMENT_SERVICES: AppointmentService[] = [
    { id: 'classic-cut', name: 'Classic Cut', durationMin: 30, price: 800 },
    { id: 'fade-cut', name: 'Fade and Blend', durationMin: 30, price: 900 },
    { id: 'beard-trim', name: 'Beard Trim', durationMin: 30, price: 700 }
];
