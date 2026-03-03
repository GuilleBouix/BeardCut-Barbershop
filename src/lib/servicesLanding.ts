import type { AppointmentService } from '../types/appointments';
import { SERVICES_FALLBACK } from '../data/services-fallback';

interface ServiceRow {
  id: string;
  name: string;
  duration_min: number;
  price: number | string;
}

const SUPABASE_TIMEOUT_MS = 3500;

const normalizeService = (service: ServiceRow): AppointmentService => ({
  id: service.id,
  name: service.name,
  durationMin: Number(service.duration_min),
  price: Number(service.price),
});

const getFallback = (reason: string) => {
  console.warn(`[servicesLanding] ${reason}. Using local fallback services.`);
  return SERVICES_FALLBACK;
};

export const getLandingServices = async (): Promise<AppointmentService[]> => {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return getFallback('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY');
  }

  const endpoint = new URL('/rest/v1/services', supabaseUrl);
  endpoint.searchParams.set('select', 'id,name,duration_min,price');
  endpoint.searchParams.set('active', 'eq.true');
  endpoint.searchParams.set('order', 'name.asc');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return getFallback(`Supabase responded with status ${response.status}`);
    }

    const data = (await response.json()) as ServiceRow[];

    if (!Array.isArray(data) || data.length === 0) {
      return getFallback('Supabase returned no active services');
    }

    return data.map(normalizeService);
  } catch (error) {
    return getFallback(`Supabase fetch failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  } finally {
    clearTimeout(timeoutId);
  }
};
