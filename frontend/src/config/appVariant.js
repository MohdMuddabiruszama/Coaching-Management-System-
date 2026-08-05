/**
 * Build target: web (full site) vs native shell (student | parent | faculty).
 * Set at build time: VITE_APP_VARIANT=student|parent|faculty (omit or web = full app).
 */
const raw = (import.meta.env.VITE_APP_VARIANT || "web").toLowerCase();

export const APP_VARIANT = ["student", "parent", "faculty", "manager", "universal"].includes(raw) ? raw : "web";

export const isWebApp = APP_VARIANT === "web";

export const isMobileApp = !isWebApp;

/** Role enforced by the native app build (faculty = teacher app in product docs). */
export const MOBILE_ALLOWED_ROLE =
  APP_VARIANT === "student"
    ? "student"
    : APP_VARIANT === "parent"
      ? "parent"
      : APP_VARIANT === "faculty"
        ? "faculty"
        : APP_VARIANT === "manager"
          ? "manager"
          : null;
