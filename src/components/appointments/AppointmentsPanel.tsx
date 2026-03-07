import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  AuthState,
  BookingFormData,
  ScheduleDay,
  AppointmentService,
  BusinessShift,
  TimeSlot,
  UserAppointment,
} from "../../types/appointments";
import { APPOINTMENT_SERVICES } from "../../data/appointments";
import { supabaseClient } from "../../lib/supabaseClient";
import {
  cancelAppointment,
  createAppointment,
  getBookedSlotsByDate,
  getCurrentSession,
  getMyActiveAppointment,
} from "../../lib/appointmentsApi";
import { initSessionManager, refreshSession, destroySession } from "../../lib/sessionManager";
import { checkBookingLimit, recordBookingAttempt, resetBookingLimit } from "../../lib/rateLimiter";

const EMPTY_FORM: BookingFormData = {
  name: "",
  email: "",
  phone: "",
  notes: "",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOT_INTERVAL_MIN = 30;
const DAYS_PER_PAGE = 5;
const MAX_DAYS_AHEAD = 31;

const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
const PHONE_MIN_LENGTH = 10;
const PHONE_MAX_LENGTH = 20;
const NOTES_MAX_LENGTH = 500;

const sanitizeInput = (input: string): string => {
  return input.replace(/[<>\"'&]/g, "");
};

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[+\d\s()-]{10,20}$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
};

const isValidName = (name: string): boolean => {
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  return nameRegex.test(name);
};

const minutesToHHMM = (minutes: number) => {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};

const timeToMinutes = (time: string) => {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

const formatRangeDate = (dateISO: string) => {
  const parsed = new Date(`${dateISO}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsed);
};

const formatLongDate = (dateISO: string) => {
  const parsed = new Date(`${dateISO}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(parsed);
};

const formatTimeLabel = (timeValue: string) => String(timeValue).slice(0, 5);

const buildDaysFromShifts = (shifts: BusinessShift[]): ScheduleDay[] => {
  const activeShifts = shifts.filter((s) => s.is_active);
  if (activeShifts.length === 0) {
    return [];
  }

  const grouped = new Map<number, BusinessShift[]>();

  activeShifts.forEach((shift) => {
    const existing = grouped.get(shift.weekday) ?? [];
    existing.push(shift);
    grouped.set(shift.weekday, existing);
  });

  grouped.forEach((weekdayShifts) => {
    weekdayShifts.sort(
      (a, b) => timeToMinutes(a.open_time) - timeToMinutes(b.open_time),
    );
  });

  const result: ScheduleDay[] = [];
  const cursor = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + MAX_DAYS_AHEAD);

  while (cursor <= endDate) {
    const weekday = cursor.getDay();
    const shiftsForDay = grouped.get(weekday) ?? [];

    if (shiftsForDay.length > 0) {
      const dateISO = cursor.toISOString().slice(0, 10);
      const slots: TimeSlot[] = [];

      shiftsForDay.forEach((shift) => {
        const start = timeToMinutes(shift.open_time);
        const end = timeToMinutes(shift.close_time);
        for (
          let minute = start;
          minute + SLOT_INTERVAL_MIN <= end;
          minute += SLOT_INTERVAL_MIN
        ) {
          const time = minutesToHHMM(minute);
          slots.push({ id: time, time, available: true });
        }
      });

      if (slots.length > 0) {
        const dayLabel = DAY_LABELS[weekday];
        const dd = cursor.getDate().toString().padStart(2, "0");
        const mm = (cursor.getMonth() + 1).toString().padStart(2, "0");
        result.push({
          dateISO,
          label: `${dayLabel} ${dd}/${mm}`,
          slots,
        });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
};

export default function AppointmentsPanel() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [services, setServices] =
    useState<AppointmentService[]>(APPOINTMENT_SERVICES);
  const [days, setDays] = useState<ScheduleDay[]>([]);
  const [bookedSlotIds, setBookedSlotIds] = useState<string[]>([]);
  const [activeAppointment, setActiveAppointment] =
    useState<UserAppointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    APPOINTMENT_SERVICES[0]?.id ?? "",
  );
  const [selectedDayISO, setSelectedDayISO] = useState<string>("");
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [dayPage, setDayPage] = useState(0);
  const [form, setForm] = useState<BookingFormData>(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  useEffect(() => {
    let active = true;

    const initializeSession = async () => {
      try {
        const session = await getCurrentSession();
        if (!active) {
          return;
        }

        if (session?.user) {
          setAuthState("authenticated");
          setForm((prev) => ({
            ...prev,
            email: prev.email || session.user.email || "",
          }));
        } else {
          setAuthState("unauthenticated");
          setIsLoading(false);
        }
      } catch (error) {
        if (active) {
          setAuthState("unauthenticated");
          setIsLoading(false);
          setErrorMessage((error as Error).message);
        }
      }
    };

    initializeSession();

    const { data: authListener } = supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) {
          return;
        }

        if (session?.user) {
          setAuthState("authenticated");
          setForm((prev) => ({
            ...prev,
            email: prev.email || session.user.email || "",
          }));
        } else {
          setAuthState("unauthenticated");
          setActiveAppointment(null);
          setIsLoading(false);
        }
      },
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authState === "unauthenticated" && !isLoading) {
      window.location.href = "/login";
    }
  }, [authState, isLoading]);

  useEffect(() => {
    if (authState !== "authenticated") {
      return;
    }

    const handleSessionExpired = () => {
      destroySession();
      supabaseClient.auth.signOut();
      setAuthState("unauthenticated");
      setActiveAppointment(null);
      setErrorMessage("Your session has expired. Please log in again.");
    };

    const cleanup = initSessionManager(handleSessionExpired);

    return cleanup;
  }, [authState]);

  useEffect(() => {
    if (authState !== "authenticated") {
      return;
    }

    let active = true;

    const loadData = async () => {
      setIsLoading(true);
      setErrorMessage("");

      const [
        { data: servicesData, error: servicesError },
        { data: shiftsData, error: shiftsError },
      ] = await Promise.all([
        supabaseClient
          .from("services")
          .select("id, name, duration_min, price")
          .eq("active", true)
          .order("name", { ascending: true }),
        supabaseClient
          .from("business_shifts")
          .select("id, weekday, open_time, close_time, is_active")
          .eq("is_active", true)
          .order("weekday", { ascending: true })
          .order("open_time", { ascending: true }),
      ]);

      if (!active) {
        return;
      }

      if (servicesError || shiftsError) {
        const details = [servicesError?.message, shiftsError?.message]
          .filter(Boolean)
          .join(" | ");
        setErrorMessage(
          `Could not load availability from Supabase. ${details || "Check RLS policies and table names."}`,
        );
        setIsLoading(false);
        return;
      }

      if (servicesData && servicesData.length > 0) {
        const normalizedServices: AppointmentService[] = servicesData.map(
          (service) => ({
            id: String(service.id),
            name: String(service.name),
            durationMin: Number(service.duration_min),
            price: Number(service.price),
          }),
        );
        setServices(normalizedServices);
        setSelectedServiceId(
          (current) =>
            normalizedServices.some((service) => service.id === current)
              ? current
              : normalizedServices[0]?.id || "",
        );
      }

      if (shiftsData) {
        const normalizedShifts: BusinessShift[] = (shiftsData as BusinessShift[])
          .map((shift) => ({
            id: Number(shift.id),
            weekday: Number(shift.weekday),
            open_time: String(shift.open_time).slice(0, 8),
            close_time: String(shift.close_time).slice(0, 8),
            is_active: Boolean(shift.is_active),
          }))
          .filter(
            (shift) =>
              Number.isFinite(shift.weekday) &&
              shift.weekday >= 0 &&
              shift.weekday <= 6 &&
              shift.open_time.length >= 5 &&
              shift.close_time.length >= 5,
          );

        const generatedDays = buildDaysFromShifts(
          normalizedShifts,
        );
        setDays(generatedDays);
        setSelectedDayISO(generatedDays[0]?.dateISO ?? "");
      }

      try {
        const appointment = await getMyActiveAppointment();
        if (active) {
          setActiveAppointment(appointment);
        }
      } catch (error) {
        if (active) {
          setErrorMessage((error as Error).message);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [authState]);

  useEffect(() => {
    if (authState !== "authenticated" || !selectedDayISO) {
      setBookedSlotIds([]);
      return;
    }

    let active = true;

    const loadBookedSlots = async () => {
      try {
        const bookedSlots = await getBookedSlotsByDate(selectedDayISO);
        if (active) {
          setBookedSlotIds(bookedSlots);
        }
      } catch (error) {
        if (active) {
          setErrorMessage((error as Error).message);
        }
      }
    };

    loadBookedSlots();

    return () => {
      active = false;
    };
  }, [authState, selectedDayISO]);

  const selectedDay: ScheduleDay | undefined = useMemo(
    () => days.find((day) => day.dateISO === selectedDayISO),
    [days, selectedDayISO],
  );

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId),
    [services, selectedServiceId],
  );

  const selectedSummary = useMemo(() => {
    if (!selectedService || !selectedDayISO || !selectedSlotId) {
      return "";
    }

    return `${selectedService.name} on ${formatLongDate(selectedDayISO)} at ${selectedSlotId}`;
  }, [selectedDayISO, selectedService, selectedSlotId]);

  const selectedDaySlots = useMemo(() => {
    return (
      selectedDay?.slots.map((slot) => ({
        ...slot,
        available: !bookedSlotIds.includes(slot.id),
      })) ?? []
    );
  }, [selectedDay, bookedSlotIds]);

  const activeServiceName = useMemo(() => {
    if (!activeAppointment) {
      return "";
    }

    const service =
      services.find((item) => item.id === activeAppointment.service_id) ??
      APPOINTMENT_SERVICES.find(
        (item) => item.id === activeAppointment.service_id,
      );

    return service?.name ?? activeAppointment.service_id;
  }, [activeAppointment, services]);

  const maxDayPage = useMemo(
    () => Math.max(0, Math.ceil(days.length / DAYS_PER_PAGE) - 1),
    [days.length],
  );

  const visibleDays = useMemo(() => {
    const start = dayPage * DAYS_PER_PAGE;
    return days.slice(start, start + DAYS_PER_PAGE);
  }, [dayPage, days]);

  useEffect(() => {
    if (days.length === 0 || !selectedDayISO) {
      return;
    }

    const index = days.findIndex((day) => day.dateISO === selectedDayISO);
    if (index === -1) {
      return;
    }

    const nextPage = Math.floor(index / DAYS_PER_PAGE);
    setDayPage((currentPage) =>
      currentPage === nextPage ? currentPage : nextPage,
    );
  }, [days, selectedDayISO]);

  useEffect(() => {
    if (dayPage > maxDayPage) {
      setDayPage(maxDayPage);
    }
  }, [dayPage, maxDayPage]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const bookingCheck = checkBookingLimit();
    if (!bookingCheck.allowed) {
      setErrorMessage(bookingCheck.message);
      return;
    }

    if (!selectedServiceId || !selectedDayISO || !selectedSlotId) {
      setErrorMessage(
        "Select a service and an available slot before continuing.",
      );
      return;
    }

    const sanitizedName = sanitizeInput(form.name);
    const sanitizedEmail = sanitizeInput(form.email);
    const sanitizedPhone = sanitizeInput(form.phone);
    const sanitizedNotes = form.notes ? sanitizeInput(form.notes) : "";

    if (!sanitizedName) {
      setErrorMessage("Name is required.");
      return;
    }

    if (sanitizedName.length > NAME_MAX_LENGTH) {
      setErrorMessage(`Name must be less than ${NAME_MAX_LENGTH} characters.`);
      return;
    }

    if (!isValidName(sanitizedName)) {
      setErrorMessage("Name can only contain letters, spaces, hyphens and apostrophes.");
      return;
    }

    if (!sanitizedEmail) {
      setErrorMessage("Email is required.");
      return;
    }

    if (sanitizedEmail.length > EMAIL_MAX_LENGTH) {
      setErrorMessage(`Email must be less than ${EMAIL_MAX_LENGTH} characters.`);
      return;
    }

    if (!isValidEmail(sanitizedEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!sanitizedPhone) {
      setErrorMessage("Phone is required.");
      return;
    }

    if (sanitizedPhone.length < PHONE_MIN_LENGTH || sanitizedPhone.length > PHONE_MAX_LENGTH) {
      setErrorMessage(`Phone must be between ${PHONE_MIN_LENGTH} and ${PHONE_MAX_LENGTH} digits.`);
      return;
    }

    if (!isValidPhone(sanitizedPhone)) {
      setErrorMessage("Please enter a valid phone number.");
      return;
    }

    if (sanitizedNotes.length > NOTES_MAX_LENGTH) {
      setErrorMessage(`Notes must be less than ${NOTES_MAX_LENGTH} characters.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const appointment = await createAppointment({
        serviceId: selectedServiceId,
        dateISO: selectedDayISO,
        slotTime: selectedSlotId,
        customerName: sanitizedName.trim(),
        customerEmail: sanitizedEmail.trim().toLowerCase(),
        customerPhone: sanitizedPhone.trim(),
        notes: sanitizedNotes.trim() || undefined,
      });

      setActiveAppointment(appointment);
      setSuccessMessage("Appointment created successfully.");
      refreshSession();
      resetBookingLimit();
      setSelectedSlotId("");
      setForm((prev) => ({
        ...EMPTY_FORM,
        email: prev.email,
      }));
    } catch (error) {
      recordBookingAttempt();
      setErrorMessage((error as Error).message);
      const refreshed = await getMyActiveAppointment().catch(() => null);
      setActiveAppointment(refreshed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!activeAppointment) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsCancelling(true);
    try {
      await cancelAppointment(activeAppointment.id);
      setActiveAppointment(null);
      setSuccessMessage("Appointment canceled successfully.");
      refreshSession();
      const refreshedSlots = await getBookedSlotsByDate(selectedDayISO).catch(
        () => [],
      );
      setBookedSlotIds(refreshedSlots);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsCancelling(false);
    }
  };

  if (authState === "checking") {
    return (
      <section className="min-h-screen px-4 py-20 flex items-center justify-center">
        <p className="text-[#bdbdbd]">Checking session...</p>
      </section>
    );
  }

  return (
    <section className="min-h-screen flex flex-col items-center justify-center py-16 px-3 sm:px-5 lg:px-8 animate-fade animate-duration-500">
      <div className="w-full max-w-5xl mx-auto animate-fade-down animate-duration-700 animate-delay-100">
        <header className="mb-5 sm:mb-6 animate-fade-down animate-duration-700 animate-delay-200">
          <h1 className="font-playfair text-2xl sm:text-3xl text-white mt-2">
            BOOK AN APPOINTMENT
          </h1>
          <p className="text-sm sm:text-md text-[#9d9d9d] mt-2">
            Choose a date and time first, then confirm your details.
          </p>
        </header>

        <div className="bg-[#101010] border border-[#3d3d3d] text-[#8f8f8f] p-3 sm:p-5 lg:p-6 animate-fade-down animate-duration-700 animate-delay-300">
          {isLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-8 w-60 bg-[#1f1f1f]" />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="h-5 w-40 bg-[#1f1f1f]" />
                  <div className="h-12 w-full bg-[#1a1a1a]" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    <div className="h-10 bg-[#1f1f1f]" />
                    <div className="h-10 bg-[#1f1f1f]" />
                    <div className="h-10 bg-[#1f1f1f]" />
                    <div className="h-10 bg-[#1f1f1f]" />
                    <div className="h-10 bg-[#1f1f1f]" />
                  </div>
                  <div className="h-60 w-full bg-[#1a1a1a]" />
                </div>
                <div className="space-y-3">
                  <div className="h-5 w-48 bg-[#1f1f1f]" />
                  <div className="h-10 w-full bg-[#1a1a1a]" />
                  <div className="h-10 w-full bg-[#1a1a1a]" />
                  <div className="h-10 w-full bg-[#1a1a1a]" />
                  <div className="h-10 w-full bg-[#1a1a1a]" />
                  <div className="h-20 w-full bg-[#1a1a1a]" />
                  <div className="h-10 w-full bg-[#f0f0f0]/20" />
                </div>
              </div>
            </div>
          ) : activeAppointment ? (
            <div className="border border-[#3d3d3d] bg-[#141414] p-4 sm:p-5">
              <h2 className="text-xl text-white font-semibold">
                Your Current Appointment
              </h2>
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  <span className="text-[#9d9d9d]">Service:</span>{" "}
                  <span className="text-white">{activeServiceName}</span>
                </p>
                <p>
                  <span className="text-[#9d9d9d]">Date:</span>{" "}
                  <span className="text-white">
                    {formatLongDate(activeAppointment.date_iso)}
                  </span>
                </p>
                <p>
                  <span className="text-[#9d9d9d]">Time:</span>{" "}
                  <span className="text-white">
                    {formatTimeLabel(activeAppointment.slot_time)}
                  </span>
                </p>
                <p>
                  <span className="text-[#9d9d9d]">Name:</span>{" "}
                  <span className="text-white">
                    {activeAppointment.customer_name}
                  </span>
                </p>
                <p>
                  <span className="text-[#9d9d9d]">Phone:</span>{" "}
                  <span className="text-white">
                    {activeAppointment.customer_phone}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleCancelAppointment}
                disabled={isCancelling}
                className="mt-5 w-full sm:w-auto border border-red-400 text-red-300 px-4 py-2 text-xs font-semibold uppercase tracking-widest transition hover:bg-red-500 hover:text-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCancelling ? "Cancelling..." : "Cancel Appointment"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8">
              <div className="space-y-6 animate-fade animate-duration-700 animate-delay-400">
                <section>
                  <h2 className="text-lg font-semibold text-white mb-4 sm:text-lg">
                    1) Choose a date
                  </h2>

                  {days.length === 0 ? (
                    <p className="text-[#9d9d9d]">
                      No available shifts found. Verify `business_shifts` data
                      and RLS `select` policy.
                    </p>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-4 bg-[#1a1a1a] p-2 sm:p-3 border border-[#3d3d3d] gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setDayPage((prev) => Math.max(0, prev - 1))
                          }
                          disabled={dayPage === 0}
                          className="flex items-center text-white border border-[#3d3d3d] px-2.5 py-1.5 text-sm cursor-pointer hover:bg-white hover:text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Prev
                        </button>

                        <span className="text-white font-medium text-center text-sm sm:text-base">
                          {visibleDays.length > 0
                            ? `${formatRangeDate(visibleDays[0].dateISO)} - ${formatRangeDate(visibleDays[visibleDays.length - 1].dateISO)}`
                            : "No dates"}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setDayPage((prev) => Math.min(maxDayPage, prev + 1))
                          }
                          disabled={dayPage >= maxDayPage}
                          className="flex items-center text-white border border-[#3d3d3d] px-2.5 py-1.5 text-sm cursor-pointer hover:bg-white hover:text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>

                      <div className="mb-4">
                        <h3 className="text-[#8f8f8f] mb-2 text-sm sm:text-base">
                          Available days:
                        </h3>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-5">
                          {visibleDays.map((day) => {
                            const isSelected = selectedDayISO === day.dateISO;
                            return (
                              <button
                                key={day.dateISO}
                                type="button"
                                onClick={() => {
                                  setSelectedDayISO(day.dateISO);
                                  setSelectedSlotId("");
                                }}
                                className={[
                                  "py-2 px-2 text-center text-xs border transition-all cursor-pointer",
                                  isSelected
                                    ? "bg-white text-black border-white font-bold"
                                    : "bg-[#101010] border-[#3d3d3d] text-white hover:bg-white hover:text-black",
                                ].join(" ")}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-[#1a1a1a] p-2.5 sm:p-3 border border-[#3d3d3d] text-sm sm:text-base">
                        <span className="text-[#8f8f8f]">Selected day: </span>
                        <span className="text-white font-medium">
                          {selectedDay
                            ? formatLongDate(selectedDay.dateISO)
                            : "None"}
                        </span>
                      </div>
                    </>
                  )}
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-white mb-4 sm:text-lg">
                    2) Available times
                  </h2>

                  {!selectedDay || selectedDaySlots.length === 0 ? (
                    <p className="text-[#9d9d9d]">
                      Select a day to view available time slots.
                    </p>
                  ) : (
                    <div className="bg-[#1a1a1a] border border-[#3d3d3d] overflow-hidden">
                      <div className="bg-[#101010] p-3 text-center border-b border-[#3d3d3d]">
                        <h3 className="text-white font-medium">
                          Morning & Afternoon
                        </h3>
                      </div>

                      <div className="p-2.5 sm:p-3 h-64 sm:h-72 overflow-y-auto space-y-2">
                        {selectedDaySlots.map((slot) => {
                          const isSelected = selectedSlotId === slot.id;

                          return (
                            <div
                              key={slot.id}
                              className={[
                                "flex justify-between items-center py-2 border-b border-[#3d3d3d] flex-col sm:flex-row gap-2 sm:gap-0",
                                isSelected ? "bg-white/5 px-2" : "",
                                !slot.available ? "opacity-50" : "",
                              ].join(" ")}
                            >
                              <span className="text-white font-mono">
                                {slot.time}
                              </span>

                              {!slot.available ? (
                                <span className="text-[#8f8f8f] px-3 py-1 text-sm">
                                  RESERVED
                                </span>
                              ) : isSelected ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedSlotId(slot.id)}
                                  className="bg-white text-black border border-white px-3 py-1 text-xs sm:text-sm uppercase font-bold cursor-pointer"
                                >
                                  Selected
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedSlotId(slot.id)}
                                  className="text-white border border-white px-3 py-1 hover:bg-white hover:text-black transition-all text-xs sm:text-sm uppercase font-semibold cursor-pointer"
                                >
                                  Reserve
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              </div>

              <aside className="space-y-6 animate-fade animate-duration-700 animate-delay-500">
                <section>
                  <h2 className="text-base font-semibold text-white mb-3 sm:text-lg">
                    3) Confirm your details
                  </h2>

                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                      <label
                        htmlFor="appointment-name"
                        className="block text-[#8f8f8f] mb-1.5 text-sm"
                      >
                        Full Name:
                      </label>
                      <input
                        id="appointment-name"
                        type="text"
                        maxLength={NAME_MAX_LENGTH}
                        value={form.name}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        className="w-full bg-[#1a1a1a] border border-[#3d3d3d] text-white text-sm p-2 sm:p-2.5 focus:outline-none focus:border-white transition-all"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="appointment-email"
                        className="block text-[#8f8f8f] mb-1.5 text-sm"
                      >
                        Email:
                      </label>
                      <input
                        id="appointment-email"
                        type="email"
                        maxLength={EMAIL_MAX_LENGTH}
                        value={form.email}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            email: event.target.value,
                          }))
                        }
                        className="w-full bg-[#1a1a1a] border border-[#3d3d3d] text-white text-sm p-2 sm:p-2.5 focus:outline-none focus:border-white transition-all"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="appointment-phone"
                        className="block text-[#8f8f8f] mb-1.5 text-sm"
                      >
                        Phone:
                      </label>
                      <input
                        id="appointment-phone"
                        type="tel"
                        maxLength={PHONE_MAX_LENGTH}
                        minLength={PHONE_MIN_LENGTH}
                        value={form.phone}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            phone: event.target.value,
                          }))
                        }
                        className="w-full bg-[#1a1a1a] border border-[#3d3d3d] text-white text-sm p-2 sm:p-2.5 focus:outline-none focus:border-white transition-all"
                        placeholder="+1 555 123 4567"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="appointment-service"
                        className="block text-[#8f8f8f] mb-1.5 text-sm"
                      >
                        Service:
                      </label>
                      <select
                        id="appointment-service"
                        value={selectedServiceId}
                        onChange={(event) =>
                          setSelectedServiceId(event.target.value)
                        }
                        className="w-full bg-[#1a1a1a] border border-[#3d3d3d] text-white text-sm p-2 sm:p-2.5 focus:outline-none focus:border-white transition-all"
                      >
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name} - ${service.price}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="appointment-notes"
                        className="block text-[#8f8f8f] mb-1.5 text-sm"
                      >
                        Notes (optional):
                      </label>
                      <textarea
                        id="appointment-notes"
                        maxLength={NOTES_MAX_LENGTH}
                        value={form.notes}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            notes: event.target.value,
                          }))
                        }
                        className="w-full min-h-18 bg-[#1a1a1a] border border-[#3d3d3d] text-white text-sm p-2 sm:p-2.5 focus:outline-none focus:border-white transition-all resize-y"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-white text-black px-4 py-2.5 mt-2 hover:bg-gray-200 transition-colors border border-white font-bold uppercase tracking-widest cursor-pointer text-xs sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Confirming..." : "Confirm Appointment"}
                    </button>

                    {selectedSummary && (
                      <div className="rounded-sm border border-green-700 bg-green-900/25 px-3 py-2 text-xs sm:text-sm text-green-300">
                        Selected appointment: {selectedSummary}
                      </div>
                    )}
                  </form>
                </section>
              </aside>
            </div>
          )}

          {errorMessage && (
            <p className="mt-4 text-sm text-red-400">{errorMessage}</p>
          )}
          {successMessage && (
            <p className="mt-4 text-sm text-green-400">{successMessage}</p>
          )}
        </div>
      </div>
    </section>
  );
}
