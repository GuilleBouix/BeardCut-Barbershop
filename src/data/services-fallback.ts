import type { AppointmentService } from '../types/appointments';

export const SERVICES_FALLBACK: AppointmentService[] = [
  {
    id: 'fallback-haircut',
    name: 'Classic Haircut',
    durationMin: 40,
    price: 8000,
  },
  {
    id: 'fallback-modern',
    name: 'Modern Haircut',
    durationMin: 45,
    price: 10000,
  },
  {
    id: 'fallback-fade',
    name: 'Fade & Taper',
    durationMin: 45,
    price: 9000,
  },
  {
    id: 'fallback-lines',
    name: 'Line Design',
    durationMin: 35,
    price: 6000,
  },
  {
    id: 'fallback-beard-fix',
    name: 'Beard Trim',
    durationMin: 30,
    price: 5000,
  },
  {
    id: 'fallback-beard-design',
    name: 'Beard Styling',
    durationMin: 30,
    price: 7000,
  },
  {
    id: 'fallback-traditional-shave',
    name: 'Traditional Shave',
    durationMin: 35,
    price: 8000,
  },
  {
    id: 'fallback-beard-color',
    name: 'Beard Color',
    durationMin: 30,
    price: 6500,
  },
  {
    id: 'fallback-hair-color',
    name: 'Hair Color',
    durationMin: 45,
    price: 15000,
  },
  {
    id: 'fallback-treatment',
    name: 'Hair Treatment',
    durationMin: 40,
    price: 12000,
  },
  {
    id: 'fallback-massage',
    name: 'Scalp Massage',
    durationMin: 20,
    price: 4000,
  },
  {
    id: 'fallback-eyebrows',
    name: 'Eyebrow Grooming',
    durationMin: 15,
    price: 3000,
  },
];
