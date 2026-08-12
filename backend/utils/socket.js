const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io;

module.exports = {
    init: (httpServer) => {
        // Match CORS allowed origins loosely or strictly depending on needs
        io = new Server(httpServer, {
            cors: {
                origin: "*", // For ease of setup; in prod, match app.js logic if needed
                methods: ["GET", "POST"]
            }
        });

        // Middleware for JWT Authentication
        io.use((socket, next) => {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error("Authentication error: No token provided"));
            }
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                socket.user = decoded;
                next();
            } catch (err) {
                return next(new Error("Authentication error: Invalid token"));
            }
        });

        io.on("connection", (socket) => {
            console.log(`🔌 [Socket.io] User ${socket.user.id} connected (Socket ID: ${socket.id})`);
            
            // Join a private room for targeted user notifications
            socket.join(`user_${socket.user.id}`);

            // Also join a room for the entire institute (for bulk announcements)
            if (socket.user.institute_id) {
                socket.join(`institute_${socket.user.institute_id}`);
            }

            // Optional: Handle joining chat rooms explicitly if needed
            socket.on("join_chat_room", (roomId) => {
                socket.join(`chat_room_${roomId}`);
            });

            // Super Admin room for real-time dashboard updates
            socket.on("join_superadmin", () => {
                // You can add role check here if needed, e.g. if(socket.user.role === 'super_admin')
                socket.join("superadmin");
            });

            socket.on("leave_superadmin", () => {
                socket.leave("superadmin");
            });

            socket.on("leave_chat_room", (roomId) => {
                socket.leave(`chat_room_${roomId}`);
            });

            socket.on("disconnect", () => {
                console.log(`🔌 [Socket.io] User ${socket.user.id} disconnected`);
            });
        });

        return io;
    },
    getIo: () => {
        return io || null;
    },
    // Alias used by biometric webhook controller
    getIO: () => {
        return io || null;
    },
    /**
     * Emit an event to all connected clients of a specific institute.
     * Used by biometric webhook to push real-time punch events to the admin UI.
     * @param {number|string} institute_id
     * @param {string} event
     * @param {object} payload
     */
    emitToInstitute: (institute_id, event, payload) => {
        if (io) {
            io.to(`institute_${institute_id}`).emit(event, payload);
        }
    },
};
