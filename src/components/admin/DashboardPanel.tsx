import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  BadgeDollarSign,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  ClipboardList,
  Clock,
  Edit2,
  ArrowLeft,
  Plus,
  RefreshCcw,
  Save,
  Scissors,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import type {
  AdminAppointment,
  AdminService,
  AdminShift,
  AdminTabKey,
} from "../../types/admin";
import {
  createIncomeRecord,
  createService,
  createShift,
  deleteShift,
  deleteService,
  fetchAdminAppointments,
  fetchAdminServices,
  fetchAdminShifts,
  fetchBusinessIncome,
  getAdminSession,
  isAdminUser,
  updateAppointmentStatus,
  updateService,
  updateShift,
} from "../../lib/adminApi";
import { supabaseClient } from "../../lib/supabaseClient";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const EMPTY_SERVICE: AdminService = {
  id: "",
  name: "",
  duration_min: 30,
  price: 0,
  active: true,
};

const sanitizeInput = (input: string): string => {
  return input.replace(/[<>\"'&]/g, "").trim();
};

const isValidTime = (value: string): boolean => {
  return /^\d{2}:\d{2}$/.test(value);
};

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

interface ShiftDraftRange {
  id?: string;
  open_time: string;
  close_time: string;
  is_active: boolean;
}

interface ShiftDraft {
  weekday: number;
  split_enabled: boolean;
  primary: ShiftDraftRange;
  secondary: ShiftDraftRange;
}

export default function DashboardPanel() {
  const [authState, setAuthState] = useState<"checking" | "authorized">(
    "checking",
  );
  const [adminUserId, setAdminUserId] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTabKey>("appointments");
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [shifts, setShifts] = useState<AdminShift[]>([]);
  const [shiftDrafts, setShiftDrafts] = useState<ShiftDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [busyAppointmentId, setBusyAppointmentId] = useState<string | null>(
    null,
  );
  const [newService, setNewService] = useState<AdminService>(EMPTY_SERVICE);
  const [editingService, setEditingService] = useState<AdminService | null>(
    null,
  );
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "booked" | "completed" | "canceled"
  >("all");
  const [incomeRows, setIncomeRows] = useState<{ amount: number }[]>([]);

  const servicesById = useMemo(() => {
    const map = new Map<string, AdminService>();
    services.forEach((service) => map.set(service.id, service));
    return map;
  }, [services]);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const [appointmentsData, servicesData, shiftsData, incomeData] =
        await Promise.all([
          fetchAdminAppointments(),
          fetchAdminServices(),
          fetchAdminShifts(),
          fetchBusinessIncome(),
        ]);
      setAppointments(appointmentsData);
      setServices(servicesData);
      setShifts(shiftsData);
      setIncomeRows(incomeData);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        const session = await getAdminSession();
        if (!session?.user) {
          window.location.assign("/login");
          return;
        }

        const admin = await isAdminUser(session.user.id);
        if (!admin) {
          await supabaseClient.auth.signOut();
          window.location.assign("/login");
          return;
        }

        if (!active) {
          return;
        }

        setAdminUserId(session.user.id);
        setAuthState("authorized");
        await loadDashboardData();
      } catch (error) {
        if (active) {
          setErrorMessage((error as Error).message);
          setIsLoading(false);
        }
      }
    };

    initialize();

    return () => {
      active = false;
    };
  }, [loadDashboardData]);

  useEffect(() => {
    const drafts: ShiftDraft[] = WEEKDAYS.map((_, weekday) => {
      const existing = shifts
        .filter((shift) => shift.weekday === weekday)
        .sort(
          (a, b) =>
            timeToMinutes(String(a.open_time).slice(0, 5)) -
            timeToMinutes(String(b.open_time).slice(0, 5)),
        );
      const primary = existing[0];
      const secondary = existing[1];
      return {
        weekday,
        split_enabled: Boolean(secondary),
        primary: {
          id: primary?.id,
          open_time: String(primary?.open_time ?? "09:00").slice(0, 5),
          close_time: String(primary?.close_time ?? "18:00").slice(0, 5),
          is_active: primary?.is_active ?? false,
        },
        secondary: {
          id: secondary?.id,
          open_time: String(secondary?.open_time ?? "16:00").slice(0, 5),
          close_time: String(secondary?.close_time ?? "20:00").slice(0, 5),
          is_active: secondary?.is_active ?? false,
        },
      };
    });
    setShiftDrafts(drafts);
  }, [shifts]);

  const totalIncome = useMemo(
    () => incomeRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    [incomeRows],
  );

  const appointmentStats = useMemo(() => {
    const totals = {
      total: appointments.length,
      booked: 0,
      completed: 0,
      canceled: 0,
    };
    appointments.forEach((item) => {
      if (item.status === "booked") totals.booked += 1;
      if (item.status === "completed") totals.completed += 1;
      if (item.status === "canceled") totals.canceled += 1;
    });
    return totals;
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    if (statusFilter === "all") {
      return appointments;
    }
    return appointments.filter((item) => item.status === statusFilter);
  }, [appointments, statusFilter]);

  const hasBookedAppointmentsForService = useCallback(
    (serviceId: string) =>
      appointments.some(
        (item) => item.service_id === serviceId && item.status === "booked",
      ),
    [appointments],
  );

  const getTodayISO = () => new Date().toISOString().slice(0, 10);

  const isWithinRanges = (
    timeValue: string,
    ranges: Array<{ start: number; end: number }>,
  ) => {
    const minutes = timeToMinutes(String(timeValue).slice(0, 5));
    return ranges.some(
      (range) => minutes >= range.start && minutes < range.end,
    );
  };

  const handleCompleteAppointment = useCallback(
    async (appointment: AdminAppointment) => {
      if (
        appointment.status !== "booked" ||
        !adminUserId ||
        busyAppointmentId === appointment.id
      ) {
        return;
      }

      const service = servicesById.get(appointment.service_id);
      if (!service) {
        setErrorMessage(
          "Service not found. Refresh services before completing.",
        );
        return;
      }

      setBusyAppointmentId(appointment.id);
      setErrorMessage("");
      setSuccessMessage("");
      try {
        await updateAppointmentStatus(appointment.id, "completed");
        try {
          await createIncomeRecord({
            appointment_id: appointment.id,
            service_id: appointment.service_id,
            amount: service.price,
            recorded_by: adminUserId,
          });
        } catch (error) {
          const message = String((error as Error).message ?? "");
          if (!message.toLowerCase().includes("duplicate")) {
            throw error;
          }
        }

        setAppointments((prev) =>
          prev.map((item) =>
            item.id === appointment.id
              ? { ...item, status: "completed" }
              : item,
          ),
        );
        setIncomeRows((prev) => [...prev, { amount: service.price }]);
        setSuccessMessage("Appointment completed and income recorded.");
      } catch (error) {
        setErrorMessage((error as Error).message);
      } finally {
        setBusyAppointmentId(null);
      }
    },
    [adminUserId, servicesById],
  );

  const handleCancelAppointment = useCallback(
    async (appointment: AdminAppointment) => {
      if (appointment.status !== "booked") {
        return;
      }

      const confirmed = window.confirm(
        "Cancel this appointment? Make sure you notify the client.",
      );
      if (!confirmed) {
        return;
      }

      setBusyAppointmentId(appointment.id);
      setErrorMessage("");
      setSuccessMessage("");
      try {
        await updateAppointmentStatus(appointment.id, "canceled");
        setAppointments((prev) =>
          prev.map((item) =>
            item.id === appointment.id ? { ...item, status: "canceled" } : item,
          ),
        );
        setSuccessMessage("Appointment canceled.");
      } catch (error) {
        setErrorMessage((error as Error).message);
      } finally {
        setBusyAppointmentId(null);
      }
    },
    [],
  );

  const handleCreateService = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setErrorMessage("");
      setSuccessMessage("");

      const name = sanitizeInput(newService.name);

      if (!name) {
        setErrorMessage("Service name is required.");
        return;
      }

      try {
        await createService({
          name,
          duration_min: Number(newService.duration_min),
          price: Number(newService.price),
          active: Boolean(newService.active),
        });
        setSuccessMessage("Service created.");
        setNewService(EMPTY_SERVICE);
        await loadDashboardData();
      } catch (error) {
        setErrorMessage((error as Error).message);
      }
    },
    [loadDashboardData, newService],
  );

  const handleStartEdit = useCallback((service: AdminService) => {
    setEditingService({ ...service });
    setIsServiceModalOpen(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingService(null);
    setIsServiceModalOpen(false);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingService) {
      return;
    }

    const original = services.find(
      (service) => service.id === editingService.id,
    );
    if (
      original &&
      original.duration_min !== editingService.duration_min &&
      hasBookedAppointmentsForService(editingService.id)
    ) {
      setErrorMessage(
        "Cannot change duration for a service with active appointments.",
      );
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    try {
      await updateService(editingService);
      setSuccessMessage("Service updated.");
      setEditingService(null);
      setIsServiceModalOpen(false);
      await loadDashboardData();
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  }, [
    editingService,
    hasBookedAppointmentsForService,
    loadDashboardData,
    services,
  ]);

  const handleDeleteService = useCallback(
    async (serviceId: string) => {
      if (hasBookedAppointmentsForService(serviceId)) {
        setErrorMessage("Cannot delete a service with active appointments.");
        return;
      }
      const confirmed = window.confirm("Delete this service?");
      if (!confirmed) {
        return;
      }

      setErrorMessage("");
      setSuccessMessage("");
      try {
        await deleteService(serviceId);
        setSuccessMessage("Service deleted.");
        await loadDashboardData();
      } catch (error) {
        setErrorMessage((error as Error).message);
      }
    },
    [hasBookedAppointmentsForService, loadDashboardData],
  );

  const handleShiftChange = useCallback(
    (
      weekday: number,
      range: "primary" | "secondary" | "meta",
      field: keyof ShiftDraftRange | "split_enabled",
      value: string | boolean,
    ) => {
      setShiftDrafts((prev) =>
        prev.map((shift) => {
          if (shift.weekday !== weekday) {
            return shift;
          }
          if (range === "meta") {
            return {
              ...shift,
              split_enabled: Boolean(value),
            };
          }
          return {
            ...shift,
            [range]: {
              ...shift[range],
              [field]: value,
            },
          };
        }),
      );
    },
    [],
  );

  const handleSaveShift = useCallback(
    async (weekday: number) => {
      const draft = shiftDrafts.find((item) => item.weekday === weekday);
      if (!draft) {
        return;
      }

      const updatedDrafts = shiftDrafts.map((item) =>
        item.weekday === weekday ? draft : item,
      );
      const hasActiveDay = updatedDrafts.some((item) => {
        const primaryActive = item.primary.is_active;
        const secondaryActive = item.split_enabled && item.secondary.is_active;
        return primaryActive || secondaryActive;
      });
      if (!hasActiveDay) {
        setErrorMessage("At least one business day must remain active.");
        return;
      }

      const primaryValid =
        isValidTime(draft.primary.open_time) &&
        isValidTime(draft.primary.close_time) &&
        timeToMinutes(draft.primary.open_time) <
          timeToMinutes(draft.primary.close_time);

      const secondaryValid =
        !draft.split_enabled ||
        (isValidTime(draft.secondary.open_time) &&
          isValidTime(draft.secondary.close_time) &&
          timeToMinutes(draft.secondary.open_time) <
            timeToMinutes(draft.secondary.close_time));

      if (!primaryValid || !secondaryValid) {
        setErrorMessage("Invalid hours. Use HH:MM and start before end.");
        return;
      }

      const ranges: Array<{ start: number; end: number }> = [];
      if (draft.primary.is_active) {
        ranges.push({
          start: timeToMinutes(draft.primary.open_time),
          end: timeToMinutes(draft.primary.close_time),
        });
      }
      if (draft.split_enabled && draft.secondary.is_active) {
        ranges.push({
          start: timeToMinutes(draft.secondary.open_time),
          end: timeToMinutes(draft.secondary.close_time),
        });
      }

      if (ranges.length > 1) {
        const sorted = [...ranges].sort((a, b) => a.start - b.start);
        for (let i = 1; i < sorted.length; i += 1) {
          if (sorted[i].start < sorted[i - 1].end) {
            setErrorMessage("Shift ranges cannot overlap.");
            return;
          }
        }
      }

      const todayISO = getTodayISO();
      const bookedForDay = appointments.filter((item) => {
        if (item.status !== "booked") return false;
        if (item.date_iso < todayISO) return false;
        const weekdayOfAppointment = new Date(
          `${item.date_iso}T00:00:00`,
        ).getDay();
        return weekdayOfAppointment === draft.weekday;
      });

      if (bookedForDay.length > 0) {
        if (ranges.length === 0) {
          setErrorMessage(
            "Cannot deactivate this day with active appointments.",
          );
          return;
        }
        const invalid = bookedForDay.some(
          (item) => !isWithinRanges(item.slot_time, ranges),
        );
        if (invalid) {
          setErrorMessage(
            "Existing appointments fall outside the new hours. Adjust hours or reschedule.",
          );
          return;
        }
      }

      setErrorMessage("");
      setSuccessMessage("");
      try {
        if (draft.primary.id) {
          await updateShift({
            id: draft.primary.id,
            weekday: draft.weekday,
            open_time: draft.primary.open_time,
            close_time: draft.primary.close_time,
            is_active: draft.primary.is_active,
          });
        } else if (draft.primary.is_active) {
          await createShift({
            weekday: draft.weekday,
            open_time: draft.primary.open_time,
            close_time: draft.primary.close_time,
            is_active: draft.primary.is_active,
          });
        }

        if (draft.split_enabled) {
          if (draft.secondary.id) {
            await updateShift({
              id: draft.secondary.id,
              weekday: draft.weekday,
              open_time: draft.secondary.open_time,
              close_time: draft.secondary.close_time,
              is_active: draft.secondary.is_active,
            });
          } else if (draft.secondary.is_active) {
            await createShift({
              weekday: draft.weekday,
              open_time: draft.secondary.open_time,
              close_time: draft.secondary.close_time,
              is_active: draft.secondary.is_active,
            });
          }
        } else if (draft.secondary.id) {
          await deleteShift(draft.secondary.id);
        }
        setSuccessMessage("Business hours updated.");
        await loadDashboardData();
      } catch (error) {
        setErrorMessage((error as Error).message);
      }
    },
    [appointments, loadDashboardData, shiftDrafts],
  );

  const showSpinner = authState === "checking" || isLoading;

  return (
    <section className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      {showSpinner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-white border-t-transparent" />
        </div>
      )}

      {!showSpinner && (
        <div className="mx-auto w-full max-w-6xl">
          <header className="mb-6">
            <div className="mb-4">
              <a
                href="/login"
                className="inline-flex items-center gap-2 border border-[#3d3d3d] px-3 py-2 text-xs uppercase tracking-[0.12em] text-[#bdbdbd] transition hover:border-white hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </a>
            </div>
            <h1 className="font-playfair text-3xl text-white">DASHBOARD</h1>
            <p className="mt-2 text-sm text-[#a1a1a1]">
              Manage appointments, services, and business hours.
            </p>
          </header>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-[#2f2f2f] bg-[#0f0f0f] p-4">
              <div className="flex items-center gap-2 text-[#9d9d9d] text-xs uppercase tracking-[0.18em]">
                <BadgeDollarSign className="h-4 w-4" />
                Revenue
              </div>
              <div className="mt-2 text-2xl text-white font-semibold">
                ${totalIncome.toFixed(2)}
              </div>
            </div>
            <div className="border border-[#2f2f2f] bg-[#0f0f0f] p-4">
              <div className="flex items-center gap-2 text-[#9d9d9d] text-xs uppercase tracking-[0.18em]">
                <ClipboardList className="h-4 w-4" />
                Total Appointments
              </div>
              <div className="mt-2 text-2xl text-white font-semibold">
                {appointmentStats.total}
              </div>
            </div>
            <div className="border border-[#2f2f2f] bg-[#0f0f0f] p-4">
              <div className="flex items-center gap-2 text-[#9d9d9d] text-xs uppercase tracking-[0.18em]">
                <CalendarCheck className="h-4 w-4" />
                Completed
              </div>
              <div className="mt-2 text-2xl text-white font-semibold">
                {appointmentStats.completed}
              </div>
            </div>
            <div className="border border-[#2f2f2f] bg-[#0f0f0f] p-4">
              <div className="flex items-center gap-2 text-[#9d9d9d] text-xs uppercase tracking-[0.18em]">
                <CalendarClock className="h-4 w-4" />
                Pending
              </div>
              <div className="mt-2 text-2xl text-white font-semibold">
                {appointmentStats.booked}
              </div>
            </div>
          </div>

          <div className="mb-6 flex border border-[#3d3d3d] overflow-x-auto snap-x snap-mandatory">
            {[
              {
                key: "appointments",
                label: "Appointments",
                icon: CalendarClock,
              },
              { key: "services", label: "Services", icon: Scissors },
              { key: "business", label: "Business Hours", icon: Settings },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as AdminTabKey)}
                className={[
                  "min-w-50 md:min-w-0 md:flex-1 px-4 py-3 text-xs uppercase tracking-[0.18em] transition flex items-center justify-center gap-2 snap-start cursor-pointer",
                  activeTab === tab.key
                    ? "bg-white text-black font-semibold"
                    : "bg-transparent text-[#bdbdbd] hover:text-white",
                ].join(" ")}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {errorMessage && (
            <p className="mb-4 text-sm text-red-400">{errorMessage}</p>
          )}
          {successMessage && (
            <p className="mb-4 text-sm text-green-400">{successMessage}</p>
          )}

          {activeTab === "appointments" && (
            <div className="border border-[#3d3d3d] bg-[#101010] p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl text-white font-semibold flex items-center gap-2">
                  <CalendarClock className="h-5 w-5" />
                  Appointments
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as
                          | "all"
                          | "booked"
                          | "completed"
                          | "canceled",
                      )
                    }
                    className="outline-none border border-[#3d3d3d] bg-[#1a1a1a] px-3 py-2 text-xs uppercase tracking-[0.12em] text-white focus:border-white transition-colors duration-300 cursor-pointer"
                    aria-label="Filter appointments by status"
                  >
                    <option value="all">All</option>
                    <option value="booked">Booked</option>
                    <option value="completed">Completed</option>
                    <option value="canceled">Canceled</option>
                  </select>
                  <button
                    type="button"
                    onClick={loadDashboardData}
                    className="border border-[#3d3d3d] text-white px-3 py-2.5 text-xs uppercase tracking-[0.12em] transition hover:bg-white hover:text-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Refresh
                  </button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm text-left text-[#d1d1d1]">
                  <thead className="text-xs uppercase text-[#9d9d9d] border-b border-[#2f2f2f]">
                    <tr>
                      <th className="py-3 pr-4">Client</th>
                      <th className="py-3 pr-4">Service</th>
                      <th className="py-3 pr-4">Date</th>
                      <th className="py-3 pr-4">Time</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 w-35 min-w-35">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.map((appointment) => {
                      const service = servicesById.get(appointment.service_id);
                      const isBusy = busyAppointmentId === appointment.id;
                      return (
                        <tr
                          key={appointment.id}
                          className="border-b border-[#2a2a2a]"
                        >
                          <td className="py-3 pr-4">
                            <div className="text-white font-medium">
                              {appointment.customer_name}
                            </div>
                            <div className="text-xs text-[#9d9d9d]">
                              {appointment.customer_email}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            {service?.name ?? appointment.service_id}
                          </td>
                          <td className="py-3 pr-4">{appointment.date_iso}</td>
                          <td className="py-3 pr-4">
                            {String(appointment.slot_time).slice(0, 5)}
                          </td>
                          <td className="py-3 pr-4 capitalize">
                            {appointment.status}
                          </td>
                          <td className="py-3 w-35 min-w-35">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={
                                  appointment.status !== "booked" || isBusy
                                }
                                onClick={() =>
                                  handleCompleteAppointment(appointment)
                                }
                                className="border border-green-400/60 bg-green-500/10 px-3 py-1 text-xs uppercase tracking-wide text-green-200 transition hover:bg-green-500/30 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1 cursor-pointer"
                              >
                                <CalendarCheck className="h-3.5 w-3.5" />
                                Complete
                              </button>
                              <button
                                type="button"
                                disabled={
                                  appointment.status !== "booked" || isBusy
                                }
                                onClick={() =>
                                  handleCancelAppointment(appointment)
                                }
                                className="border border-red-400/60 bg-red-500/10 px-3 py-1 text-xs uppercase tracking-wide text-red-200 transition hover:bg-red-500/30 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1 cursor-pointer"
                              >
                                <CalendarX className="h-3.5 w-3.5" />
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredAppointments.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-4 text-center text-[#9d9d9d]"
                        >
                          No appointments found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "services" && (
            <div className="border border-[#3d3d3d] bg-[#101010] p-4 sm:p-6">
              <h2 className="text-xl text-white font-semibold flex items-center gap-2">
                <Scissors className="h-5 w-5" />
                Services
              </h2>

              <form
                className="mt-4 grid gap-3 md:grid-cols-4"
                onSubmit={handleCreateService}
              >
                <div className="space-y-1">
                  <label
                    htmlFor="service-name"
                    className="text-xs text-[#9d9d9d] block"
                  >
                    Service Name
                  </label>
                  <input
                    id="service-name"
                    type="text"
                    value={newService.name}
                    onChange={(event) =>
                      setNewService((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Name"
                    className="w-full outline-none border border-[#3d3d3d] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:border-white transition-color duration-300"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="service-duration"
                    className="text-xs text-[#9d9d9d] block"
                  >
                    Duration (min)
                  </label>
                  <input
                    id="service-duration"
                    type="number"
                    min={5}
                    value={newService.duration_min}
                    onChange={(event) =>
                      setNewService((prev) => ({
                        ...prev,
                        duration_min: Number(event.target.value),
                      }))
                    }
                    placeholder="Duration (min)"
                    className="w-full outline-none border border-[#3d3d3d] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:border-white transition-color duration-300"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="service-price"
                    className="text-xs text-[#9d9d9d] block"
                  >
                    Price
                  </label>
                  <input
                    id="service-price"
                    type="number"
                    min={0}
                    value={newService.price}
                    onChange={(event) =>
                      setNewService((prev) => ({
                        ...prev,
                        price: Number(event.target.value),
                      }))
                    }
                    placeholder="Price"
                    className="w-full outline-none border border-[#3d3d3d] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:border-white transition-color duration-300"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full border border-[#3d3d3d] bg-[#151515] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:border-white hover:text-white inline-flex items-center justify-center gap-2 self-end cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Create
                </button>
              </form>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm text-left text-[#d1d1d1]">
                  <thead className="text-xs uppercase text-[#9d9d9d] border-b border-[#2f2f2f]">
                    <tr>
                      <th className="py-3 pr-4">Name</th>
                      <th className="py-3 pr-4">Duration</th>
                      <th className="py-3 pr-4">Price</th>
                      <th className="py-3 pr-4">Active</th>
                      <th className="py-3 w-35 min-w-35">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((service) => (
                      <tr
                        key={service.id}
                        className="border-b border-[#2a2a2a]"
                      >
                        <td className="py-3 pr-4">{service.name}</td>
                        <td className="py-3 pr-4">{`${service.duration_min} min`}</td>
                        <td className="py-3 pr-4">{`$${service.price}`}</td>
                        <td className="py-3 pr-4">
                          {service.active ? "Yes" : "No"}
                        </td>
                        <td className="py-3 w-35 min-w-35">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(service)}
                              className="group inline-flex items-center gap-2 text-[#9d9d9d] transition hover:text-white cursor-pointer"
                              aria-label="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                              <span className="opacity-0 group-hover:opacity-100 transition text-[10px] uppercase tracking-[0.18em]">
                                Edit
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteService(service.id)}
                              className="group inline-flex items-center gap-2 text-[#9d9d9d] transition hover:text-red-400 cursor-pointer"
                              aria-label="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="opacity-0 group-hover:opacity-100 transition text-[10px] uppercase tracking-[0.18em]">
                                Delete
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {services.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-4 text-center text-[#9d9d9d]"
                        >
                          No services found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "business" && (
            <div className="border border-[#3d3d3d] bg-[#101010] p-4 sm:p-6">
              <h2 className="text-xl text-white font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Business Hours
              </h2>
              <p className="mt-2 text-sm text-[#9d9d9d]">
                Set working days and time ranges. You can enable a second range
                per day.
              </p>

              <div className="mt-4 space-y-3">
                {shiftDrafts.map((shift) => (
                  <div
                    key={shift.weekday}
                    className="border border-[#2f2f2f] bg-[#0f0f0f] p-3 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-white font-medium">
                        {WEEKDAYS[shift.weekday]}
                      </div>
                      <label className="flex items-center gap-2 text-sm text-[#d1d1d1]">
                        <input
                          type="checkbox"
                          checked={shift.split_enabled}
                          onChange={(event) =>
                            handleShiftChange(
                              shift.weekday,
                              "meta",
                              "split_enabled",
                              event.target.checked,
                            )
                          }
                        />
                        Split hours
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[160px_140px_140px_120px] items-center">
                      <div className="text-xs text-[#9d9d9d] uppercase tracking-[0.14em]">
                        Range 1
                      </div>
                      <input
                        type="time"
                        aria-label={`Opening time ${WEEKDAYS[shift.weekday]}`}
                        value={shift.primary.open_time}
                        onChange={(event) =>
                          handleShiftChange(
                            shift.weekday,
                            "primary",
                            "open_time",
                            event.target.value,
                          )
                        }
                        className="border border-[#3d3d3d] bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                      />
                      <input
                        type="time"
                        aria-label={`Closing time ${WEEKDAYS[shift.weekday]}`}
                        value={shift.primary.close_time}
                        onChange={(event) =>
                          handleShiftChange(
                            shift.weekday,
                            "primary",
                            "close_time",
                            event.target.value,
                          )
                        }
                        className="border border-[#3d3d3d] bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                      />
                      <label className="flex items-center gap-2 text-sm text-[#d1d1d1]">
                        <input
                          type="checkbox"
                          checked={shift.primary.is_active}
                          onChange={(event) =>
                            handleShiftChange(
                              shift.weekday,
                              "primary",
                              "is_active",
                              event.target.checked,
                            )
                          }
                        />
                        Active
                      </label>
                    </div>

                    {shift.split_enabled && (
                      <div className="grid gap-3 md:grid-cols-[160px_140px_140px_120px] items-center">
                        <div className="text-xs text-[#9d9d9d] uppercase tracking-[0.14em]">
                          Range 2
                        </div>
                        <input
                          type="time"
                          aria-label={`Opening time ${WEEKDAYS[shift.weekday]} (range 2)`}
                          value={shift.secondary.open_time}
                          onChange={(event) =>
                            handleShiftChange(
                              shift.weekday,
                              "secondary",
                              "open_time",
                              event.target.value,
                            )
                          }
                          className="border border-[#3d3d3d] bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                        />
                        <input
                          type="time"
                          aria-label={`Closing time ${WEEKDAYS[shift.weekday]} (range 2)`}
                          value={shift.secondary.close_time}
                          onChange={(event) =>
                            handleShiftChange(
                              shift.weekday,
                              "secondary",
                              "close_time",
                              event.target.value,
                            )
                          }
                          className="border border-[#3d3d3d] bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                        />
                        <label className="flex items-center gap-2 text-sm text-[#d1d1d1]">
                          <input
                            type="checkbox"
                            checked={shift.secondary.is_active}
                            onChange={(event) =>
                              handleShiftChange(
                                shift.weekday,
                                "secondary",
                                "is_active",
                                event.target.checked,
                              )
                            }
                          />
                          Active
                        </label>
                      </div>
                    )}

                    <div>
                      <button
                        type="button"
                        onClick={() => handleSaveShift(shift.weekday)}
                        className="border border-[#3d3d3d] bg-[#151515] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:border-white hover:text-white inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Save className="h-3.5 w-3.5" />
                        Save
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isServiceModalOpen && editingService && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
              <div className="w-full max-w-lg border border-[#3d3d3d] bg-[#101010] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl text-white font-semibold">
                      Edit Service
                    </h3>
                    <p className="mt-1 text-sm text-[#a1a1a1]">
                      Update service details.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-[#bdbdbd] hover:text-white"
                    aria-label="Close edit modal"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label
                      className="text-xs text-[#9d9d9d] block"
                      htmlFor="edit-service-name"
                    >
                      Name
                    </label>
                    <input
                      id="edit-service-name"
                      type="text"
                      value={editingService.name}
                      onChange={(event) =>
                        setEditingService((prev) =>
                          prev ? { ...prev, name: event.target.value } : prev,
                        )
                      }
                      className="mt-1 w-full outline-none border border-[#3d3d3d] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:border-white transition-color duration-300"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        className="text-xs text-[#9d9d9d] block"
                        htmlFor="edit-service-duration"
                      >
                        Duration (min)
                      </label>
                      <input
                        id="edit-service-duration"
                        type="number"
                        min={5}
                        value={editingService.duration_min}
                        onChange={(event) =>
                          setEditingService((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  duration_min: Number(event.target.value),
                                }
                              : prev,
                          )
                        }
                        className="mt-1 w-full outline-none border border-[#3d3d3d] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:border-white transition-color duration-300"
                      />
                    </div>
                    <div>
                      <label
                        className="text-xs text-[#9d9d9d] block"
                        htmlFor="edit-service-price"
                      >
                        Price
                      </label>
                      <input
                        id="edit-service-price"
                        type="number"
                        min={0}
                        value={editingService.price}
                        onChange={(event) =>
                          setEditingService((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  price: Number(event.target.value),
                                }
                              : prev,
                          )
                        }
                        className="mt-1 w-full outline-none border border-[#3d3d3d] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:border-white transition-color duration-300"
                      />
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-[#d1d1d1]">
                    <input
                      type="checkbox"
                      checked={editingService.active}
                      onChange={(event) =>
                        setEditingService((prev) =>
                          prev
                            ? { ...prev, active: event.target.checked }
                            : prev,
                        )
                      }
                    />
                    Active
                  </label>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="border border-[#3d3d3d] px-3 py-2 text-xs uppercase tracking-[0.12em] text-[#bdbdbd] hover:border-white hover:text-white cursor-pointer transition-colors duration-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="border border-[#3d3d3d] bg-[#151515] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:border-white hover:text-white inline-flex items-center gap-2 cursor-pointer duration-300"
                  >
                    <Save className="h-4 w-4" />
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
