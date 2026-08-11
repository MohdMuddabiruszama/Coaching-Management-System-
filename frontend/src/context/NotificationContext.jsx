import { createContext, useState, useEffect, useContext } from "react";
import { AuthContext } from "./AuthContext";
import { io } from "socket.io-client";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const [socket, setSocket] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        const token = sessionStorage.getItem("token");
        if (!token) return;

        // Initialize WebSocket connection
        // Assuming backend is at VITE_API_URL or defaults to same domain if not provided
        const apiUrl = import.meta.env.VITE_API_URL || "";
        // Remove /api from URL for socket.io root connection
        const backendUrl = apiUrl.replace(/\/api\/?$/, "") || window.location.origin;

        const newSocket = io(backendUrl, {
            auth: { token },
            transports: ["websocket", "polling"],
        });

        newSocket.on("connect", () => {
            console.log("WebSocket connected for notifications.");
            // Fetch initial unread count right after connecting
            fetchUnreadCount();
        });

        newSocket.on("notification", (notification) => {
            const { type, title, body, data_json } = notification;
            
            let emoji = '🔔';
            let color = '#6366f1';
            let route = data_json?.route;

            if (type === "chat_message") {
                emoji = '💬';
                color = '#6366f1';
            } else if (type === "study_material") {
                emoji = '📄';
                color = '#3b82f6';
            } else if (type === "assignment_new") {
                emoji = '📝';
                color = '#f59e0b';
            } else if (type === "assignment_submission") {
                emoji = '✅';
                color = '#10b981';
            } else if (type === "attendance" || type === "biometric_gate_punch") {
                const isIn = data_json?.punch_type === 'in' || data_json?.scan_type === 'in' || title?.includes('Entered') || title?.includes('Attended');
                emoji = isIn ? '✅' : '🚪';
                color = isIn ? '#10b981' : '#ef4444';
            }

            // Beautiful custom notification toast - Premium Glassmorphic Mobile UI using Standard CSS
            toast.custom((t) => (
                <div
                    onClick={() => {
                        toast.dismiss(t.id);
                        if (route) {
                            navigate(route);
                        }
                    }}
                    className={`nc-toast-popup ${t.visible ? 'nc-toast-enter' : 'nc-toast-leave'}`}
                >
                    <div className="nc-toast-indicator" style={{ backgroundColor: color }}></div>
                    <div className="nc-toast-content">
                        <div className="nc-toast-icon-wrapper">
                            <div 
                                className="nc-toast-icon" 
                                style={{ background: `linear-gradient(135deg, ${color}20, ${color}40)` }}
                            >
                                {emoji}
                            </div>
                        </div>
                        <div className="nc-toast-text">
                            <p className="nc-toast-title">
                                {title}
                            </p>
                            <p className="nc-toast-desc">
                                {body}
                            </p>
                        </div>
                    </div>
                    <div className="nc-toast-close-wrapper">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toast.dismiss(t.id);
                            }}
                            className="nc-toast-close-btn"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            ), { duration: 5000 });

            // Increment unread count globally
            setUnreadCount((prev) => prev + 1);
        });

        newSocket.on("connect_error", (err) => {
            console.warn("WebSocket connect error:", err.message);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [user]);

    const fetchUnreadCount = async () => {
        try {
            const token = sessionStorage.getItem("token");
            if (!token) return;
            const apiUrl = import.meta.env.VITE_API_URL || "/api";
            const response = await fetch(`${apiUrl}/notifications/unread-count`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setUnreadCount(data.count);
            }
        } catch (error) {
            console.error("Error fetching unread count:", error);
        }
    };

    const decrementUnreadCount = (count = 1) => {
        setUnreadCount((prev) => Math.max(0, prev - count));
    };

    return (
        <NotificationContext.Provider value={{ socket, unreadCount, fetchUnreadCount, decrementUnreadCount }}>
            {children}
        </NotificationContext.Provider>
    );
};
