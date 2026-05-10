/**
 * Main Application Component
 * Handles routing, authentication, and global state management
 */

import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import MobileShell from "mobile-shell";
import WebAppRoutes from "./routes/WebAppRoutes";
import NetworkStatus from "./components/NetworkStatus";
import MobileErrorBoundary from "./components/MobileErrorBoundary";
import "./styles/global.css";
import "./styles/responsive.css";       // Always-on responsive design (media queries)
import "./themes/pro/pro-theme.css";   // Pro theme — activated by html.theme-pro
import "./styles/public-theme-overrides.css"; // Public theme fixes
import { Toaster } from "react-hot-toast";
import MobileAppInit from "./components/MobileAppInit";
import SplashOverlay from "./components/SplashOverlay";

import { BrandingProvider } from "./context/BrandingContext";

/** Build-time constant so Vite drops WebAppRoutes for native shells (student/parent/faculty). */
const isMobileShell = Boolean(
  import.meta.env.VITE_APP_VARIANT &&
    String(import.meta.env.VITE_APP_VARIANT).toLowerCase() !== "web"
);

/** App type from env: 'student' | 'parent' | 'faculty' | 'web' */
const APP_TYPE = String(import.meta.env.VITE_APP_VARIANT || "web").toLowerCase();

function App() {
    return (
        // MobileErrorBoundary catches any unhandled React crash — shows recovery screen
        <MobileErrorBoundary>
            <BrowserRouter>
                {/* BrandingProvider wraps AuthProvider so branding is persistent */}
                <BrandingProvider>
                    <AuthProvider>
                        {/* ThemeProvider must be INSIDE AuthProvider so it can read user */}
                        <ThemeProvider>
                            {/* Animated splash — native→web seamless handoff */}
                            <SplashOverlay />
                            {/* Phase 7: Unified mobile init — CSS, push (no-op on web) */}
                            <MobileAppInit />
                            <NetworkStatus />
                            <Toaster position="top-right" />
                            {isMobileShell ? <MobileShell /> : <WebAppRoutes />}
                        </ThemeProvider>
                    </AuthProvider>
                </BrandingProvider>
            </BrowserRouter>
        </MobileErrorBoundary>
    );
}

export default App;
