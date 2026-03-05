import { supabaseClient } from "../lib/supabaseClient";

const initAuthNav = () => {
  const loginDesktop = document.getElementById("auth-login-link-desktop");
  const loginMobile = document.getElementById("auth-login-link-mobile");
  const logoutDesktop = document.getElementById("auth-logout-btn-desktop");
  const logoutMobile = document.getElementById("auth-logout-btn-mobile");

  if (
    !loginDesktop ||
    !loginMobile ||
    !logoutDesktop ||
    !logoutMobile ||
    document.body.dataset.authNavReady === "true"
  ) {
    return;
  }

  document.body.dataset.authNavReady = "true";

  const setAuthUi = (isAuthenticated: boolean) => {
    loginDesktop.classList.toggle("hidden", isAuthenticated);
    loginMobile.classList.toggle("hidden", isAuthenticated);
    logoutDesktop.classList.toggle("hidden", !isAuthenticated);
    logoutMobile.classList.toggle("hidden", !isAuthenticated);
  };

  const syncState = async () => {
    const { data } = await supabaseClient.auth.getSession();
    setAuthUi(Boolean(data.session));
  };

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    setAuthUi(false);
    if (window.location.pathname === "/appointments") {
      window.location.assign("/login");
    }
  };

  logoutDesktop.addEventListener("click", handleLogout);
  logoutMobile.addEventListener("click", handleLogout);

  syncState();

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setAuthUi(Boolean(session));
  });
};

initAuthNav();
document.addEventListener("astro:page-load", initAuthNav);
