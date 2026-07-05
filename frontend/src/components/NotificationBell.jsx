import { useContext } from "react";
import { NotificationContext } from "../context/NotificationContext";
import { useNavigate } from "react-router-dom";

export default function NotificationBell({ size = "medium", path = "/notifications" }) {
    const { unreadCount } = useContext(NotificationContext);
    const navigate = useNavigate();

    const iconSize = size === "large" ? "28px" : size === "small" ? "16px" : "22px";

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                navigate(path);
            }}
            title={`${unreadCount} unread notifications`}
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
            <span
                style={{
                    fontSize: iconSize,
                    filter: unreadCount > 0 ? "none" : "grayscale(1) opacity(0.35)",
                    display: "inline-block",
                    transformOrigin: "top center",
                }}
            >
                🔔
            </span>

            {unreadCount > 0 && (
                <span
                    style={{
                        position: "absolute",
                        top: "-2px",
                        right: "-4px",
                        background: "#B71C1C",
                        color: "#fff",
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
                        lineHeight: 1,
                    }}
                >
                    {unreadCount > 99 ? "99+" : unreadCount}
                </span>
            )}
        </div>
    );
}
