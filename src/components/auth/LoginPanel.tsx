import { useMemo, useState, type FormEvent } from "react";
import { isAdminUser } from "../../lib/adminApi";
import { supabaseClient } from "../../lib/supabaseClient";

const EMAIL_MAX_LENGTH = 254;

const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>\"'&]/g, "")
    .trim();
};

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default function LoginPanel() {
  const [activeTab, setActiveTab] = useState<"user" | "admin">("user");
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  const emailRedirectTo = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return `${window.location.origin}/appointments`;
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const sanitizedEmail = sanitizeInput(email);

    if (!sanitizedEmail) {
      setErrorMessage("Email is required.");
      return;
    }

    if (sanitizedEmail.length > EMAIL_MAX_LENGTH) {
      setErrorMessage(`Email must be less than ${EMAIL_MAX_LENGTH} characters.`);
      return;
    }

    const normalizedEmail = sanitizedEmail.toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabaseClient.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo,
        },
      });
      setIsSending(false);

      if (error) {
        setErrorMessage(error.message || "Could not send login link.");
        return;
      }

      setSuccessMessage(
        "Magic link sent. Check your email and open the link to continue.",
      );
      setEmail("");
    } catch (err) {
      setIsSending(false);
      setErrorMessage("An unexpected error occurred. Please try again.");
    }
  };

  const handleAdminSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdminError("");

    const sanitizedEmail = sanitizeInput(adminEmail).toLowerCase();
    if (!sanitizedEmail) {
      setAdminError("Email is required.");
      return;
    }

    if (!isValidEmail(sanitizedEmail)) {
      setAdminError("Please enter a valid email address.");
      return;
    }

    if (!adminPassword.trim()) {
      setAdminError("Password is required.");
      return;
    }

    setIsAdminLoading(true);
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: sanitizedEmail,
        password: adminPassword,
      });

      if (error || !data.user) {
        setAdminError(error?.message || "Could not sign in.");
        setIsAdminLoading(false);
        return;
      }

      const isAdmin = await isAdminUser(data.user.id);
      if (!isAdmin) {
        await supabaseClient.auth.signOut();
        setAdminError("Access denied. This account is not an admin.");
        setIsAdminLoading(false);
        return;
      }

      window.location.assign("/dashboard");
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message ?? "")
          : "";
      setAdminError(message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const showSpinner = isSending || isAdminLoading;

  return (
    <section className="min-h-screen px-4 py-20 sm:px-6 lg:px-8 flex items-center justify-center">
      {showSpinner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-white border-t-transparent" />
        </div>
      )}
      <div className="w-full max-w-md border border-[#3d3d3d] bg-[#101010] p-5 sm:p-7">
        <h1 className="font-playfair text-3xl text-white">Login</h1>
        <p className="mt-2 text-sm text-[#a1a1a1]">
          {activeTab === "user"
            ? "Sign in with a magic link sent to your email."
            : "Admin access with email and password."}
        </p>

        <div className="mt-4 flex border border-[#3d3d3d]">
          <button
            type="button"
            onClick={() => setActiveTab("user")}
            className={[
              "flex-1 px-3 py-2 text-xs uppercase tracking-[0.18em] transition",
              activeTab === "user"
                ? "bg-white text-black font-semibold"
                : "bg-transparent text-[#bdbdbd] hover:text-white",
            ].join(" ")}
          >
            Usuario
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("admin")}
            className={[
              "flex-1 px-3 py-2 text-xs uppercase tracking-[0.18em] transition",
              activeTab === "admin"
                ? "bg-white text-black font-semibold"
                : "bg-transparent text-[#bdbdbd] hover:text-white",
            ].join(" ")}
          >
            Admin
          </button>
        </div>

        {activeTab === "user" ? (
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-sm text-[#8f8f8f]"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                maxLength={EMAIL_MAX_LENGTH}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full border border-[#3d3d3d] bg-[#1a1a1a] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white"
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full cursor-pointer border border-white bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-black transition hover:bg-transparent hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? "Sending..." : "Send Magic Link"}
            </button>
          </form>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={handleAdminSubmit}>
            <div>
              <label
                htmlFor="admin-email"
                className="mb-1.5 block text-sm text-[#8f8f8f]"
              >
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                maxLength={EMAIL_MAX_LENGTH}
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                placeholder="admin@barberia.com"
                className="w-full border border-[#3d3d3d] bg-[#1a1a1a] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="mb-1.5 block text-sm text-[#8f8f8f]"
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full border border-[#3d3d3d] bg-[#1a1a1a] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white"
              />
            </div>

            <button
              type="submit"
              disabled={isAdminLoading}
              className="w-full cursor-pointer border border-white bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-black transition hover:bg-transparent hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAdminLoading ? "Signing in..." : "Sign In as Admin"}
            </button>
          </form>
        )}

        {activeTab === "user" && errorMessage && (
          <p className="mt-4 text-sm text-red-400">{errorMessage}</p>
        )}
        {activeTab === "user" && successMessage && (
          <p className="mt-4 text-sm text-green-400">{successMessage}</p>
        )}
        {activeTab === "admin" && adminError && (
          <p className="mt-4 text-sm text-red-400">{adminError}</p>
        )}

        <a
          href="/"
          className="mt-5 inline-block text-xs uppercase tracking-[0.1em] text-[#bdbdbd] transition hover:text-white"
        >
          Back to Home
        </a>
      </div>
    </section>
  );
}
