import { useEffect, useState } from "react";
import { supabaseClient } from "../../lib/supabaseClient";
import type { AppointmentService } from "../../types/appointments";

export default function ServicesList() {
  const [services, setServices] = useState<AppointmentService[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadServices = async () => {
      const { data, error: queryError } = await supabaseClient
        .from("services")
        .select("id, name, duration_min, price")
        .eq("active", true)
        .order("name", { ascending: true });

      if (queryError) {
        setError(`Could not load services from backend: ${queryError.message}`);
        setLoading(false);
        return;
      }

      const normalized: AppointmentService[] = (data ?? []).map((service) => ({
        id: service.id,
        name: service.name,
        durationMin: service.duration_min,
        price: Number(service.price),
      }));
      setServices(normalized);
      setLoading(false);
    };

    loadServices();
  }, []);

  if (loading) {
    return <p className="text-[#9d9d9d]">Loading services...</p>;
  }

  if (error) {
    return <p className="text-red-400">{error}</p>;
  }

  if (services.length === 0) {
    return <p className="text-[#9d9d9d]">No active services configured yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
      {services.map((service) => (
        <article
          key={service.id}
          className="overflow-hidden border border-[#2f2f2f] bg-black/30 p-4 sm:p-5"
        >
          <h3 className="font-semibold text-xl sm:text-2xl text-white">
            {service.name}
          </h3>
          <div className="mt-4 space-y-2 text-sm sm:text-base">
            <p className="text-[#a0a0a0]">
              Duration: <span className="text-white">{service.durationMin} min</span>
            </p>
            <p className="text-[#a0a0a0]">
              Price: <span className="text-white">${service.price}</span>
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
