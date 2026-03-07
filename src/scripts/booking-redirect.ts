import { supabaseClient } from "../lib/supabaseClient";

const initBookingButtons = () => {
  const buttons = document.querySelectorAll(".auth-booking-btn");
  if (buttons.length === 0) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      if (session) {
        window.location.href = "/appointments";
      } else {
        window.location.href = "/login";
      }
    });
  });
};

initBookingButtons();
document.addEventListener("astro:page-load", initBookingButtons);
