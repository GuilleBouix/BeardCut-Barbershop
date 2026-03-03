import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  BookingFormData,
  ScheduleDay,
  SelectedBooking,
  AppointmentService,
  BusinessShift,
  TimeSlot,
} from "../../types/appointments";
import { APPOINTMENT_SERVICES } from "../../data/appointments";
import { supabaseClient } from "../../lib/supabaseClient";

const EMPTY_FORM: BookingFormData = {
  name: "",
  email: "",
  phone: "",
  notes: "",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOT_INTERVAL_MIN = 30;
const DAYS_TO_SHOW = 10;
const DAYS_PER_PAGE = 5;

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

  let traversedDays = 0;
  const maxDaysToTraverse = 90;

  while (result.length < DAYS_TO_SHOW && traversedDays < maxDaysToTraverse) {
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
    traversedDays += 1;
  }

  return result;
};

export default function AppointmentsPanel() {
  const [services, setServices] =
    useState<AppointmentService[]>(APPOINTMENT_SERVICES);
  const [days, setDays] = useState<ScheduleDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
            id: service.id,
            name: service.name,
            durationMin: service.duration_min,
            price: Number(service.price),
          }),
        );
        setServices(normalizedServices);
        setSelectedServiceId(
          (current) => current || normalizedServices[0]?.id || "",
        );
      }

      if (shiftsData) {
        const generatedDays = buildDaysFromShifts(
          shiftsData as BusinessShift[],
        );
        setDays(generatedDays);
        setSelectedDayISO(generatedDays[0]?.dateISO ?? "");
      }

      setIsLoading(false);
    };

    loadData();
  }, []);

  const selectedDay: ScheduleDay | undefined = useMemo(
    () => days.find((day) => day.dateISO === selectedDayISO),
    [days, selectedDayISO],
  );

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId),
    [services, selectedServiceId],
  );

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
    if (nextPage !== dayPage) {
      setDayPage(nextPage);
    }
  }, [days, selectedDayISO, dayPage]);

  useEffect(() => {
    if (dayPage > maxDayPage) {
      setDayPage(maxDayPage);
    }
  }, [dayPage, maxDayPage]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!selectedServiceId || !selectedDayISO || !selectedSlotId) {
      setErrorMessage(
        "Select a service and an available slot before continuing.",
      );
      return;
    }

    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setErrorMessage("Name, email and phone are required.");
      return;
    }

    const bookingSelection: SelectedBooking = {
      serviceId: selectedServiceId,
      dateISO: selectedDayISO,
      slotId: selectedSlotId,
    };

    setSuccessMessage(
      `Selection ready: ${bookingSelection.dateISO} at ${bookingSelection.slotId} for ${form.name}.`,
    );

    setForm(EMPTY_FORM);
    setSelectedSlotId("");
  };

  return (
    <section className="min-h-screen flex flex-col items-center justify-center py-16 px-3 sm:px-5 lg:px-8">
      <div className="w-full max-w-5xl mx-auto">
        <header className="mb-5 sm:mb-6">
          <h1 className="font-playfair text-2xl sm:text-3xl text-white mt-2">
            BOOK AN APPOINTMENT
          </h1>
          <p className="text-sm sm:text-md text-[#9d9d9d] mt-2">
            Choose a date and time first, then confirm your details.
          </p>
        </header>

        <div className="bg-[#101010] border border-[#3d3d3d] text-[#8f8f8f] p-3 sm:p-5 lg:p-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8">
            <div className="space-y-6">
              <section>
                <h2 className="text-lg font-semibold text-white mb-4 sm:text-lg">
                  1) Choose a date
                </h2>

                {isLoading ? (
                  <p className="text-[#9d9d9d]">Loading available shifts...</p>
                ) : days.length === 0 ? (
                  <p className="text-[#9d9d9d]">
                    No available shifts found. Verify `business_shifts` data and
                    RLS `select` policy.
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
                                "py-2 px-2 text-center text-sm border transition-all cursor-pointer",
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

                {!selectedDay || selectedDay.slots.length === 0 ? (
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
                      {selectedDay.slots.map((slot) => {
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
                                Occupied
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

            <aside className="space-y-6">
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
                    className="w-full bg-white text-black px-4 py-2.5 mt-2 hover:bg-gray-200 transition-colors border border-white font-bold uppercase tracking-widest cursor-pointer text-xs sm:text-sm"
                  >
                    Confirm Appointment
                  </button>
                </form>

                <div className="mt-4 text-sm">
                  {selectedDayISO && selectedSlotId ? (
                    <div className="p-3 text-sm sm:text-base bg-green-900/30 text-green-400 border border-green-900">
                      Selected time: {selectedSlotId} on {selectedDayISO}
                    </div>
                  ) : (
                    <p className="text-[#8e8e8e]">
                      No appointment selected yet.
                    </p>
                  )}
                </div>

                {errorMessage && (
                  <p className="mt-4 text-sm text-red-400">{errorMessage}</p>
                )}
                {successMessage && (
                  <p className="mt-4 text-sm text-green-400">
                    {successMessage}
                  </p>
                )}
              </section>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
