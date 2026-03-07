const SESSION_KEY = "session_activity";

interface SessionActivity {
  lastActivity: number;
  expiresAt: number;
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const getSessionActivity = (): SessionActivity | null => {
  if (typeof window === "undefined") return null;

  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;

    const data: SessionActivity = JSON.parse(stored);
    const now = Date.now();

    if (now >= data.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    return data;
  } catch {
    return null;
  }
};

const setSessionActivity = (): void => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  const data: SessionActivity = {
    lastActivity: now,
    expiresAt: now + SESSION_TIMEOUT_MS,
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
};

export const initSessionManager = (
  onSessionExpired: () => void,
): (() => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  setSessionActivity();

  const resetActivity = () => setSessionActivity();

  const events = ["mousedown", "keydown", "scroll", "touchstart"];
  events.forEach((event) => {
    window.addEventListener(event, resetActivity, { passive: true });
  });

  const intervalId = setInterval(() => {
    const activity = getSessionActivity();
    if (!activity) {
      const now = Date.now();
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const data: SessionActivity = JSON.parse(stored);
        if (now >= data.expiresAt) {
          sessionStorage.removeItem(SESSION_KEY);
          onSessionExpired();
        }
      }
    }
  }, CHECK_INTERVAL_MS);

  return () => {
    clearInterval(intervalId);
    events.forEach((event) => {
      window.removeEventListener(event, resetActivity);
    });
  };
};

export const refreshSession = (): void => {
  setSessionActivity();
};

export const destroySession = (): void => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
};
