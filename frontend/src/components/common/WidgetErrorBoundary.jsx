/**
 * ✅ PHASE 7: Widget-Level Error Boundary
 * ─────────────────────────────────────────────────────────────────────────────
 * Use this to wrap INDIVIDUAL dashboard widgets/sections (not the whole app —
 * MobileErrorBoundary already handles the whole app).
 *
 * When one widget crashes (e.g., the attendance chart has bad data):
 *   - Only THAT widget shows a fallback UI
 *   - The rest of the dashboard keeps working normally
 *   - The user can dismiss the error and the widget tries to re-render
 *
 * Usage:
 *   import WidgetErrorBoundary from '../common/WidgetErrorBoundary';
 *
 *   <WidgetErrorBoundary title="Attendance Summary">
 *     <AttendanceWidget />
 *   </WidgetErrorBoundary>
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Component } from "react";

class WidgetErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        // Report to Sentry (it's initialized globally)
        try {
            // Dynamically import Sentry to avoid bundle bloat if not used
            import("@sentry/react").then(({ captureException }) => {
                captureException(error, {
                    extra: {
                        widgetTitle:     this.props.title || "Unknown Widget",
                        componentStack:  info.componentStack,
                    },
                });
            }).catch(() => {});
        } catch {
            // Sentry not available — log to console
            console.error(`[WidgetErrorBoundary:${this.props.title}]`, error.message, info.componentStack);
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        const title   = this.props.title || "This section";
        const isDev   = import.meta.env?.DEV;
        const errMsg  = this.state.error?.message || "Unknown error";

        // Compact inline fallback — not a full-screen overlay
        return (
            <div
                style={{
                    padding:      "16px",
                    borderRadius: "8px",
                    border:       "1px solid #fee2e2",
                    background:   "#fff5f5",
                    textAlign:    "center",
                    color:        "#dc2626",
                    fontSize:     "14px",
                    margin:       "8px 0",
                }}
                role="alert"
            >
                <div style={{ fontSize: "20px", marginBottom: "6px" }}>⚠️</div>
                <p style={{ margin: "0 0 4px", fontWeight: 600 }}>
                    {title} failed to load
                </p>
                <p style={{ margin: "0 0 10px", color: "#6b7280", fontSize: "12px" }}>
                    {isDev ? errMsg : "The rest of the page is still working."}
                </p>
                <button
                    onClick={this.handleReset}
                    style={{
                        padding:      "6px 16px",
                        background:   "#dc2626",
                        color:        "#fff",
                        border:       "none",
                        borderRadius: "6px",
                        cursor:       "pointer",
                        fontSize:     "13px",
                    }}
                >
                    Try Again
                </button>
            </div>
        );
    }
}

export default WidgetErrorBoundary;
