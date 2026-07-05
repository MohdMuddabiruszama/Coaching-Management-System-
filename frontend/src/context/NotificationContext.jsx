import { createContext, useState, useEffect, useContext } from "react";
import { AuthContext } from "./AuthContext";
import { io } from "socket.io-client";
import toast from "react-hot-toast";

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const [socket, setSocket] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);

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
            // Display toast
            toast(notification.title + "\n" + (notification.body || ""), {
                icon: '🔔',
                style: {
                    borderRadius: '10px',
                    background: '#333',
                    color: '#fff',
                },
            });
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
