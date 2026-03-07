import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  // X-Frame-Options - Previene clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // X-Content-Type-Options - Previene MIME-sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // X-XSS-Protection - Protección XSS legacy
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Referrer-Policy - Controla qué información de referencia se envía
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions-Policy - Restringe acceso a APIs sensibles
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=()",
  );

  // Strict-Transport-Security - Fuerza HTTPS
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );

  // Content-Security-Policy - Previene XSS e inyección de contenido
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://*.supabase.co",
      "font-src 'self' data:",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );

  return response;
});
