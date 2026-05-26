/**
 * AnnouncementBell — Phase 4
 * Colored bell icon with unread count badge. Polls every 60s.
 * Bell color changes based on highest priority unread announcement:
 *   urgent → red + pulse animation
 *   high   → orange
 *   normal → blue
 *   none   → gray (dimmed, no badge)
 */
import { useState, useEffect, useContext } from "react";
import { AnnouncementSidebarContext } from "../context/AnnouncementSidebarContext";
import announcementService from "../services/announcement.service";

// Priority → badge color mapping
const BELL_COLORS = {
    urgent: { bg: "#B71C1C", color: "#fff" },
    high:   { bg: "#E65100", color: "#fff" },
    normal: { bg: "#1565C0", color: "#fff" },
    null:   { bg: "transparent", color: "#9E9E9E" },
};

export default function AnnouncementBell({ size = "medium" }) {
    const [data, setData] = useState({ count: 0, highest_priority: null });
    const { toggleSidebar } = useContext(AnnouncementSidebarContext);

    const fetchCount = async () => {
        try {
            const res = await announcementService.getUnreadCount();
            setData(res);
        } catch (e) {
            /* silent fail — never break dashboard */
        }
    };

    useEffect(() => {
        fetchCount();
        const interval = setInterval(fetchCount, 60_000); // poll every 60s
        return () => clearInterval(interval);
    }, []);

    const style = BELL_COLORS[data.highest_priority] || BELL_COLORS.null;
    const iconSize = size === "large" ? "28px" : size === "small" ? "16px" : "22px";
    const isUrgent = data.highest_priority === "urgent";
    const isHigh = data.highest_priority === "high";

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                toggleSidebar();
            }}
            title={`${data.count} unread announcement${data.count !== 1 ? "s" : ""}`}
            style={{
                position: "relative",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px",
                borderRadius: "50%",
                transition: "background 0.2s",
            }}
        >
            {/* Bell icon */}
            <span
                style={{
                    fontSize: iconSize,
                    filter: data.count > 0 ? "none" : "grayscale(1) opacity(0.35)",
                    display: "inline-block",
                    animation: isUrgent ? "bellRing 0.8s infinite" : (isHigh ? "bellRing 0.8s 1" : "none"),
                    transformOrigin: "top center",
                }}
            >
                🔔
            </span>

            {/* Unread count badge */}
            {data.count > 0 && (
                <span
                    style={{
                        position: "absolute",
                        top: "-2px",
                        right: "-4px",
                        background: style.bg,
                        color: style.color,
                        fontSize: "10px",
                        fontWeight: "bold",
                        borderRadius: "50%",
                        minWidth: "17px",
                        height: "17px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 3px",
                        border: "2px solid #fff",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                        animation: isUrgent ? "pulse 1.5s infinite" : "none",
                        lineHeight: 1,
                    }}
                >
                    {data.count > 99 ? "99+" : data.count}
                </span>
            )}
        </div>
    );
}
