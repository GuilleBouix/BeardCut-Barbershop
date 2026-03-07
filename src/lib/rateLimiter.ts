const BOOKING_KEY = "booking_rate_limit";

interface BookingLimitData {
  attempts: number;
  firstAttempt: number;
  blocked: boolean;
  blockedUntil: number | null;
}

const BOOKING_WINDOW_MS = 60 * 60 * 1000;
const BOOKING_MAX_ATTEMPTS = 3;
const BOOKING_BLOCK_MS = 60 * 60 * 1000;

const getBookingLimitData = (): BookingLimitData => {
  if (typeof window === "undefined") {
    return { attempts: 0, firstAttempt: 0, blocked: false, blockedUntil: null };
  }

  try {
    const stored = sessionStorage.getItem(BOOKING_KEY);
    if (!stored) {
      return { attempts: 0, firstAttempt: 0, blocked: false, blockedUntil: null };
    }

    const data: BookingLimitData = JSON.parse(stored);
    const now = Date.now();

    if (data.blocked && data.blockedUntil && now >= data.blockedUntil) {
      sessionStorage.removeItem(BOOKING_KEY);
      return { attempts: 0, firstAttempt: 0, blocked: false, blockedUntil: null };
    }

    if (data.firstAttempt && now - data.firstAttempt > BOOKING_WINDOW_MS) {
      sessionStorage.removeItem(BOOKING_KEY);
      return { attempts: 0, firstAttempt: 0, blocked: false, blockedUntil: null };
    }

    return data;
  } catch {
    return { attempts: 0, firstAttempt: 0, blocked: false, blockedUntil: null };
  }
};

const setBookingLimitData = (data: BookingLimitData): void => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(BOOKING_KEY, JSON.stringify(data));
};

export const checkBookingLimit = (): { allowed: boolean; message: string; retryAfter: number | null } => {
  const data = getBookingLimitData();
  const now = Date.now();

  if (data.blocked && data.blockedUntil) {
    if (now >= data.blockedUntil) {
      sessionStorage.removeItem(BOOKING_KEY);
      return { allowed: true, message: "", retryAfter: null };
    }
    const retryAfter = Math.ceil((data.blockedUntil - now) / 1000);
    return {
      allowed: false,
      message: `Too many booking attempts. Please try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
      retryAfter,
    };
  }

  if (data.attempts >= BOOKING_MAX_ATTEMPTS) {
    const blockedUntil = now + BOOKING_BLOCK_MS;
    const newData: BookingLimitData = {
      ...data,
      blocked: true,
      blockedUntil,
    };
    setBookingLimitData(newData);
    return {
      allowed: false,
      message: "Too many booking attempts. Please try again in 1 hour.",
      retryAfter: BOOKING_BLOCK_MS / 1000,
    };
  }

  return { allowed: true, message: "", retryAfter: null };
};

export const recordBookingAttempt = (): void => {
  const data = getBookingLimitData();
  const now = Date.now();

  if (data.attempts === 0) {
    setBookingLimitData({
      attempts: 1,
      firstAttempt: now,
      blocked: false,
      blockedUntil: null,
    });
  } else {
    setBookingLimitData({
      ...data,
      attempts: data.attempts + 1,
    });
  }
};

export const resetBookingLimit = (): void => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(BOOKING_KEY);
};
