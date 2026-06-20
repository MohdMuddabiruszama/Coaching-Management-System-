/**
 * useMobileInit — Phase 1: Mobile CSS loader + touch/UX settings.
 *
 * NOTE: Splash screen hide is handled entirely by <SplashOverlay />.
 * This hook only loads CSS and sets HTML-level touch properties.
 * Safe on web — both constants evaluate to false on non-mobile builds.
 */

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

const IS_NATIVE = Capacitor.isNativePlatform();
const APP_TYPE  = String(import.meta.env.VITE_APP_VARIANT || "web").toLowerCase();
const IS_MOBILE_VARIANT =
    Boolean(import.meta.env.VITE_APP_VARIANT) && APP_TYPE !== "web";

export function useMobileInit() {
    useEffect(() => {
        if (!IS_NATIVE && !IS_MOBILE_VARIANT) return;

        /* Load mobile base + variant-specific CSS */
        import("../styles/mobile-base.css").catch(() => {});

        if (APP_TYPE === "student") {
            import("../styles/student-mobile.css").catch(() => {});
        } else if (APP_TYPE === "parent") {
            import("../styles/parent-mobile.css").catch(() => {});
        } else if (APP_TYPE === "faculty") {
            import("../styles/faculty-mobile.css").catch(() => {});
        } else if (APP_TYPE === "universal") {
            // Universal build supports all three roles — load all variant CSS.
            // Each is caught individually so a missing file doesn't break the others.
            import("../styles/student-mobile.css").catch(() => {});
            import("../styles/parent-mobile.css").catch(() => {});
            import("../styles/faculty-mobile.css").catch(() => {});
        }

        /* HTML-level flags & touch settings */
        const html = document.documentElement;
        html.classList.add("mobile-app");
        html.classList.add(`app-${APP_TYPE}`);
        html.style.touchAction      = "manipulation";  // prevent double-tap zoom
        html.style.webkitUserSelect = "none";           // no text selection
        html.style.userSelect       = "none";

        return () => {
            html.classList.remove("mobile-app", `app-${APP_TYPE}`);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
