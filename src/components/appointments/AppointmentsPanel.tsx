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
    <section className="min-h-screen px-6 py-20 lg:px-20 2xl:px-30 flex items-center">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-8">
          <p className="text-sm tracking-[0.2em] uppercase text-[#9a9a9a]">
            Booking Panel
          </p>
          <h1 className="font-playfair text-2xl sm:text-4xl text-white mt-2">
            BOOK AN APPOINTMENT
          </h1>
          <p className="text-[#9d9d9d] mt-3">
            Services and schedule are loaded from Supabase.
          </p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 border border-[#2f2f2f] bg-black/30 p-5 sm:p-7">
            <h2 className="text-white text-2xl font-semibold">
              1. Choose a Service
            </h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {services.map((service) => {
                const isSelected = selectedServiceId === service.id;
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setSelectedServiceId(service.id)}
                    className={[
                      "text-left border p-4 transition cursor-pointer",
                      isSelected
                        ? "border-white bg-black/40"
                        : "border-[#3a3a3a] bg-black/20 hover:border-[#707070]",
                    ].join(" ")}
                  >
                    <p className="text-white font-medium">{service.name}</p>
                    <p className="text-[#9d9d9d] text-sm mt-1">
                      {service.durationMin} min
                    </p>
                    <p className="text-[#d6d6d6] text-sm mt-2">
                      ${service.price}
                    </p>
                  </button>
                );
              })}
            </div>

            <h2 className="text-white text-2xl font-semibold mt-8">
              2. Choose Date and Time
            </h2>

            {isLoading ? (
              <p className="mt-4 text-[#9d9d9d]">Loading available shifts...</p>
            ) : (
              <>
                {days.length === 0 && (
                  <p className="mt-4 text-[#9d9d9d]">
                    No available shifts found. Verify `business_shifts` data and
                    RLS `select` policy.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {days.map((day) => {
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
                          "px-4 py-2 border text-sm transition cursor-pointer",
                          isSelected
                            ? "border-white text-white"
                            : "border-[#3a3a3a] text-[#b5b5b5] hover:border-[#707070]",
                        ].join(" ")}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>

                <h3 className="mt-4 text-white text-xl font-semibold">Hours</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedDay?.slots.map((slot) => {
                    const isSelected = selectedSlotId === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={!slot.available}
                        onClick={() =>
                          slot.available && setSelectedSlotId(slot.id)
                        }
                        className={[
                          "px-3 py-2 text-sm border transition cursor-pointer",
                          !slot.available
                            ? "border-[#2a2a2a] text-[#666] cursor-not-allowed"
                            : isSelected
                              ? "border-white text-white bg-black/40"
                              : "border-[#505050] text-[#d0d0d0] hover:border-white",
                        ].join(" ")}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <aside className="border border-[#2f2f2f] bg-black/30 p-5 sm:p-7 h-fit">
            <h2 className="text-white text-2xl font-semibold">
              3. Your Details
            </h2>
            <p className="text-[#9d9d9d] text-sm mt-2">
              Name, email and phone are required.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                className="w-full border border-[#3a3a3a] bg-black/25 px-3 py-2 text-white outline-none focus:border-white transition-colors "
              />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
                className="w-full border border-[#3a3a3a] bg-black/25 px-3 py-2 text-white outline-none focus:border-white transition-colors "
              />
              <input
                type="tel"
                placeholder="Phone"
                value={form.phone}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, phone: event.target.value }))
                }
                className="w-full border border-[#3a3a3a] bg-black/25 px-3 py-2 text-white outline-none focus:border-white transition-colors "
              />
              <textarea
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, notes: event.target.value }))
                }
                className="w-full min-h-24 border border-[#3a3a3a] bg-black/25 px-3 py-2 text-white outline-none focus:border-white resize-y"
              />

              <button
                type="submit"
                className="w-full border border-white px-4 py-3 text-white hover:bg-white hover:text-black transition-colors cursor-pointer"
              >
                Reserve Appointment
              </button>
            </form>

            <div className="mt-4 text-sm">
              {selectedService && selectedDayISO && selectedSlotId ? (
                <p className="text-[#c8c8c8]">
                  Selected: {selectedService.name} on {selectedDayISO} at{" "}
                  {selectedSlotId}
                </p>
              ) : (
                <p className="text-[#8e8e8e]">No appointment selected yet.</p>
              )}
            </div>

            {errorMessage && (
              <p className="mt-4 text-sm text-red-400">{errorMessage}</p>
            )}
            {successMessage && (
              <p className="mt-4 text-sm text-green-400">{successMessage}</p>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
