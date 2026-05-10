/**
 * MobileErrorBoundary — Global React error catcher for ZF Solution
 *
 * Catches any unhandled React render/lifecycle errors and displays a
 * professional crash screen with a reload button instead of a blank/white screen.
 *
 * Usage: Wrap the entire App tree in <MobileErrorBoundary> (see App.jsx).
 * Sentry/Crashlytics integration point: replace the console.error with your SDK call.
 */

import { Component } from "react";
import "./MobileErrorBoundary.css";

class MobileErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // ── Structured crash log (replace with Sentry.captureException in production) ──
    console.error("[MobileErrorBoundary] Unhandled React error:", {
      message:    error?.message,
      stack:      error?.stack,
      component:  errorInfo?.componentStack,
      timestamp:  new Date().toISOString(),
      appVersion: import.meta.env.VITE_APP_VERSION || "unknown",
      variant:    import.meta.env.VITE_APP_VARIANT  || "web",
    });

    // Dispatch custom event — can be caught by analytics or native bridge
    try {
      window.dispatchEvent(
        new CustomEvent("app_crash", {
          detail: { message: error?.message, stack: error?.stack },
        })
      );
    } catch {
      // Ignore dispatch failure during crash
    }
  }

  handleReload = () => {
    // Clear React state first, then reload the full WebView
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleReportBug = () => {
    // Copy error details to clipboard for manual reporting
    const report = [
      `App Version: ${import.meta.env.VITE_APP_VERSION || "unknown"}`,
      `Variant: ${import.meta.env.VITE_APP_VARIANT || "web"}`,
      `Error: ${this.state.error?.message}`,
      `Time: ${new Date().toISOString()}`,
    ].join("\n");

    try {
      navigator.clipboard.writeText(report);
    } catch {
      // clipboard not available (Android WebView restriction)
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDev  = import.meta.env.DEV;
    const errMsg = this.state.error?.message || "Unknown error";

    return (
      <div className="meb-overlay" role="alert" aria-live="assertive">
        <div className="meb-card">
          {/* Icon */}
          <div className="meb-icon-wrap">
            <div className="meb-icon">⚠️</div>
            <div className="meb-ring" />
          </div>

          {/* Title */}
          <h1 className="meb-title">Something Went Wrong</h1>
          <p className="meb-subtitle">
            The application ran into an unexpected error. Your data is safe.
          </p>

          {/* Dev-only error details */}
          {isDev && (
            <div className="meb-devbox">
              <code className="meb-errmsg">{errMsg}</code>
            </div>
          )}

          {/* Actions */}
          <div className="meb-actions">
            <button
              className="meb-btn meb-btn-primary"
              onClick={this.handleReload}
              id="error-boundary-reload-btn"
            >
              🔄 Reload App
            </button>
            <button
              className="meb-btn meb-btn-secondary"
              onClick={this.handleReportBug}
              id="error-boundary-report-btn"
            >
              📋 Copy Error Info
            </button>
          </div>

          {/* Footer */}
          <p className="meb-footer">
            If this keeps happening, please contact your administrator.
          </p>
        </div>
      </div>
    );
  }
}

export default MobileErrorBoundary;
