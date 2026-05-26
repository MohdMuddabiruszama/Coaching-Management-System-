import { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { toast } from "react-hot-toast";
import "./ChatApp.css";

/** Detect small/mobile screen */
const isMobileScreen = () => window.innerWidth < 768;

function ChatApp() {
    const { user } = useContext(AuthContext);
    const myUserId = Number(user?.id);
    const navigate = useNavigate();

    const [rooms, setRooms] = useState([]);
    const [enrolledSubjects, setEnrolledSubjects] = useState([]); // for students
    const [facultySubjects, setFacultySubjects] = useState([]);   // for faculty

    const [activeRoom, setActiveRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loadingData, setLoadingData] = useState(true);
    const [sending, setSending] = useState(false);
    const [showParticipants, setShowParticipants] = useState(true);
    const [chatUsage, setChatUsage] = useState(null); // { used, limit, unlimited, percent }

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createFormData, setCreateFormData] = useState({
        name: "",
        subject_id: "",
        audience: "Both"
    });

    // Admin/Manager Filters
    const [filters, setFilters] = useState({
        type: "",
        faculty_id: "",
        subject_id: "",
        class_id: "",
        parent_id: ""
    });
    const [filterData, setFilterData] = useState({
        faculties: [],
        subjects: [],
        classes: [],
        parents: []
    });

    const messagesEndRef = useRef(null);
    const pollRef = useRef(null);
    const activeRoomRef = useRef(null);

    // Initial load
    useEffect(() => {
        loadInitialData();
        fetchChatUsage();
        if (['admin', 'manager'].includes(user?.role)) {
            api.post("/admin/clear-unread-chats").catch(err => console.error(err));
        }
    }, [user?.role]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Poll messages
    useEffect(() => {
        activeRoomRef.current = activeRoom;
        if (pollRef.current) clearInterval(pollRef.current);

        if (activeRoom && activeRoom.id) { // Only poll if room actually exists in DB
            loadMessages(activeRoom.id);
            loadParticipants(activeRoom.id);
            // Mark as read when entering room
            markAsRead(activeRoom.id);

            pollRef.current = setInterval(() => {
                if (activeRoomRef.current && activeRoomRef.current.id) {
                    loadMessages(activeRoomRef.current.id);
                }
                fetchRooms(); // Keep room list (and badges) updated
            }, 5000);
        } else {
            // Even if no active room, poll rooms to see notifications
            pollRef.current = setInterval(() => {
                fetchRooms();
            }, 5000);
        }

        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [activeRoom?.id]);

    const loadInitialData = async () => {
        try {
            setLoadingData(true);
            await fetchRooms();

            // Get subjects based on role
            if (user?.role === "student") {
                const subRes = await api.get("/students/me");
                if (subRes.data.success) {
                    setEnrolledSubjects(subRes.data.data.Subjects || []);
                }
            } else if (user?.role === "admin" || user?.role === "manager" || user?.role === "owner") {
                // Fetch filter options
                const [facRes, subRes, clsRes, parRes] = await Promise.all([
                    api.get("/faculty"),
                    api.get("/subjects"),
                    api.get("/classes"),
                    api.get("/parents")
                ]);

                setFilterData({
                    faculties: facRes.data.success ? facRes.data.data : [],
                    subjects: subRes.data.success ? subRes.data.data : [],
                    classes: clsRes.data.success ? clsRes.data.data : [],
                    parents: parRes.data.success ? parRes.data.data : []
                });
            } else if (user?.role === "parent") {
                const parRes = await api.get("/parents/dashboard");
                if (parRes.data.success) {
                    const subjectsMap = new Map();
                    const stus = parRes.data.data.students || [];
                    stus.forEach(s => {
                        if (s.Subjects) {
                            s.Subjects.forEach(sub => subjectsMap.set(sub.id, sub));
                        }
                    });
                    setEnrolledSubjects(Array.from(subjectsMap.values()));
                }
            } else if (user?.role === "faculty") {
                const fsRes = await api.get("/subjects");
                if (fsRes.data.success) {
                    setFacultySubjects(fsRes.data.data || []);
                }
            }

        } catch (err) {
            console.error("Load data error:", err);
            toast.error("Failed to load chat data.");
        } finally {
            setLoadingData(false);
        }
    };

    const fetchRooms = async (currentFilters = filters) => {
        try {
            // Build query string
            const params = new URLSearchParams();
            Object.entries(currentFilters).forEach(([key, val]) => {
                if (val) params.append(key, val);
            });

            const res = await api.get(`/chat/rooms?${params.toString()}`);
            if (res.data.success) {
                setRooms(res.data.data || []);
            }
        } catch (err) {
            console.error("Fetch rooms error:", err);
        }
    };

    const handleFilterChange = (key, value) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        fetchRooms(newFilters);
    };

    const markAsRead = async (roomId) => {
        try {
            await api.post(`/chat/room/${roomId}/read`);
            // Update local state to immediately show as read
            setRooms(prev => prev.map(r => r.id === roomId ? { ...r, unread_count: 0 } : r));
        } catch (err) {
            console.error("Mark as read error:", err);
        }
    };

    const loadMessages = async (roomId) => {
        try {
            const res = await api.get(`/chat/room/${roomId}`);
            if (res.data.success) {
                setMessages(res.data.data || []);
            }
        } catch (err) {
            console.error("Load messages error:", err);
        }
    };

    const loadParticipants = async (roomId) => {
        try {
            const res = await api.get(`/chat/room/${roomId}/participants`);
            if (res.data.success) {
                setParticipants(res.data.data || []);
            }
        } catch (err) {
            console.error("Load participants error:", err);
        }
    };

    const fetchChatUsage = async () => {
        try {
            const res = await api.get("/chat/usage");
            if (res.data.success) {
                setChatUsage(res.data);
            }
        } catch (err) {
            console.error("Fetch usage error:", err);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        const text = newMessage.trim();
        if (!text || !activeRoom || sending) return;

        setSending(true);
        setNewMessage("");

        let targetRoomId = activeRoom.id;

        try {
            // For students sending message to a direct subject chat that doesn't exist yet
            if (!targetRoomId && activeRoom.type === "direct") {
                const createRes = await api.post("/chat/room/get-or-create", {
                    type: "direct",
                    subject_id: activeRoom.subject_id,
                    faculty_user_id: activeRoom.faculty_user_id
                });
                if (createRes.data.success) {
                    targetRoomId = createRes.data.room.id;
                    const fullRoom = { ...activeRoom, id: targetRoomId };
                    setActiveRoom(fullRoom);
                    // Refresh rooms so it appears in sidebar
                    const rRes = await api.get("/chat/rooms");
                    if (rRes.data.success) setRooms(rRes.data.data || []);
                } else {
                    throw new Error("Could not create direct chatroom");
                }
            }

            await api.post("/chat/send", { room_id: targetRoomId, message: text });
            await loadMessages(targetRoomId);
            await loadParticipants(targetRoomId);
            fetchChatUsage(); // Refresh usage after sending

            // Re-fetch rooms to update the message count and auto bump to the top
            const rRes = await api.get("/chat/rooms");
            if (rRes.data.success) {
                setRooms(rRes.data.data || []);
            }

        } catch (err) {
            const errCode = err.response?.data?.code;
            if (errCode === "CHAT_LIMIT_REACHED") {
                // Update usage state to trigger the overlay immediately
                const usage = err.response?.data?.usage;
                if (usage) {
                    setChatUsage({ used: usage.used, limit: usage.limit, unlimited: false, percent: 100 });
                }
                const isAdmin = ['admin', 'manager', 'owner'].includes(user?.role);
                toast.error(
                    isAdmin 
                        ? "💬 Chat message limit reached! Please upgrade your plan." 
                        : "💬 Messaging is currently disabled. Please contact your administrator.", 
                    { duration: 5000 }
                );
            } else {
                toast.error(err.response?.data?.message || err.message || "Failed to send message");
            }
            setNewMessage(text);
        } finally {
            setSending(false);
        }
    };

    const handleDeleteRoom = async (roomId, e) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to delete this room? This cannot be undone.")) return;
        try {
            const res = await api.delete(`/chat/room/${roomId}`);
            if (res.data.success) {
                toast.success("Room deleted");
                setRooms(prev => prev.filter(r => r.id !== roomId));
                if (activeRoom?.id === roomId) {
                    setActiveRoom(null);
                    setMessages([]);
                    setParticipants([]);
                }
            } else {
                toast.error(res.data.message || "Failed to delete room");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to delete room");
        }
    };

    const createRoom = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post("/chat/room/create", createFormData);
            if (res.data.success) {
                toast.success("Room created!");
                setShowCreateModal(false);
                setCreateFormData({ name: "", subject_id: "", audience: "Both" });

                // Reload rooms
                const rRes = await api.get("/chat/rooms");
                if (rRes.data.success) {
                    setRooms(rRes.data.data || []);
                    // set active to new room
                    const newRoom = rRes.data.data.find(r => r.id === res.data.room.id);
                    if (newRoom) selectRoom(newRoom);
                }
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to create room");
        }
    };

    const selectRoom = (room) => {
        setActiveRoom(room);
        setMessages([]);
        setParticipants([]);
        if (room.id) {
            markAsRead(room.id);
        }
        fetchRooms();
        // On mobile: hide participants panel by default
        if (isMobileScreen()) setShowParticipants(false);
    };

    /** Mobile: go back to room list */
    const handleMobileBack = () => {
        setActiveRoom(null);
        setMessages([]);
        setParticipants([]);
    };

    // ─── Direct Chats for Student ───
    const buildStudentSubjectItems = () => {
        const items = enrolledSubjects.map(sub => {
            const existingRoom = rooms.find(r => r.type === "direct" && r.subject_id === sub.id);
            if (existingRoom) {
                return existingRoom; // Use the actual DB room
            } else {
                return {
                    id: null,
                    type: "direct",
                    subject_id: sub.id,
                    name: `Direct Chat - ${sub.name}`,
                    message_count: 0,
                    unread_count: 0,
                    last_message_at: null
                };
            }
        });

        // Sort explicitly by last message time (descending), then fallback to creation order if none
        items.sort((a, b) => {
            const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            return timeB - timeA;
        });

        return items;
    };

    // ─── Helpers ─────────────────────────────────────────────────────────────
    const getRoomLabel = (room) => {
        if (room.name && room.type !== "direct") return room.name;
        if (room.type === "direct") {
            if (user?.role === "faculty" && room.ChatParticipants) {
                const studentP = room.ChatParticipants.find(p => p.role === "student" || p.User?.role === "student" || p.role === "parent" || p.User?.role === "parent");
                if (studentP && studentP.User) return `${studentP.User.name} - Direct Chat`;
            }
            return `Direct Chat - ${room.Subject?.name || "Subject"}`;
        }
        return room.Subject?.name || room.Class?.name || "Chat Room";
    };
    const getRoomSubLabel = (room) => {
        if (room.type === "direct") return "1-on-1 with Faculty";
        const parts = [];
        if (room.Subject && room.Class) parts.push(room.Class.name + (room.Class.section ? " · " + room.Class.section : ""));
        if (room.target_gender && room.target_gender !== "both") parts.push(`Audience: ${room.target_gender}`);
        return parts.join(" · ") || room.type;
    };
    const getRoomInitial = (room) => {
        if (room.type === "direct") return "D";
        return (getRoomLabel(room)[0] || "C").toUpperCase();
    };

    const isReadOnly = user?.role === "admin" || user?.role === "owner" || user?.role === "manager";

    const facultyParticipants = participants.filter(p => p.User?.role === "faculty");
    const studentParticipants = participants.filter(p => p.User?.role === "student");


    return (
        <div className={`chat-container${activeRoom ? ' room-open' : ''}`}>

            {/* ── Sidebar: Rooms ─────────────────────────────── */}
            <div className="chat-sidebar">
                <div className="chat-sidebar-header" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => navigate(-1)}>
                            ⬅ Back
                        </button>
                    </div>
                    <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>💬 Academic Chat</h3>
                            <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", margin: "4px 0 0" }}>
                                {user?.role === "faculty" ? "Manage your rooms" : (user?.role === "student" || user?.role === "parent") ? "Your chats" : "Monitor all chats"}
                            </p>
                        </div>
                        {user?.role === "faculty" && (
                            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setShowCreateModal(true)}>
                                + Create Room
                            </button>
                        )}
                    </div>

                    {/* Admin Filters UI */}
                    {(user?.role === "admin" || user?.role === "manager" || user?.role === "owner") && (
                        <div className="chat-filters">
                            <select
                                className="form-input"
                                style={{ fontSize: '0.75rem', padding: '4px' }}
                                value={filters.type}
                                onChange={(e) => handleFilterChange('type', e.target.value)}
                            >
                                <option value="">All Types</option>
                                <option value="group">Group Rooms</option>
                                <option value="direct">Direct Chats</option>
                            </select>
                            <select
                                className="form-input"
                                style={{ fontSize: '0.75rem', padding: '4px' }}
                                value={filters.class_id}
                                onChange={(e) => handleFilterChange('class_id', e.target.value)}
                            >
                                <option value="">All Classes</option>
                                {filterData.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select
                                className="form-input"
                                style={{ fontSize: '0.75rem', padding: '4px' }}
                                value={filters.faculty_id}
                                onChange={(e) => handleFilterChange('faculty_id', e.target.value)}
                            >
                                <option value="">All Faculty</option>
                                {filterData.faculties.map(f => <option key={f.id} value={f.id}>{f.User?.name || f.id}</option>)}
                            </select>
                            <select
                                className="form-input"
                                style={{ fontSize: '0.75rem', padding: '4px' }}
                                value={filters.subject_id}
                                onChange={(e) => handleFilterChange('subject_id', e.target.value)}
                            >
                                <option value="">All Subjects</option>
                                {filterData.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <select
                                className="form-input filter-full"
                                style={{ fontSize: '0.75rem', padding: '4px' }}
                                value={filters.parent_id}
                                onChange={(e) => handleFilterChange('parent_id', e.target.value)}
                            >
                                <option value="">Filter by Parent</option>
                                {filterData.parents.map(p => <option key={p.id} value={p.id}>{p.User?.name || p.name || 'Parent'}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {/* Usage Bar — shown ONLY for admin roles when limit applies */}
                {chatUsage && !chatUsage.unlimited && ['admin', 'manager', 'owner'].includes(user?.role) && (
                    <div className="chat-usage-bar-wrapper">
                        <div className="chat-usage-bar-label">
                            <span>💬 Messages this month</span>
                            <span>{chatUsage.used} / {chatUsage.limit}</span>
                        </div>
                        <div className="chat-usage-bar-track">
                            <div
                                className={`chat-usage-bar-fill${chatUsage.percent >= 100 ? ' danger' : chatUsage.percent >= 80 ? ' warning' : ''}`}
                                style={{ width: `${Math.min(100, chatUsage.percent || 0)}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="chat-room-list">
                    {loadingData ? (
                        <div style={{ padding: 20 }}><LoadingSpinner /></div>
                    ) : (
                        <>
                            {/* --- FOR STUDENTS AND PARENTS: Direct Chats --- */}
                            {(user?.role === "student" || user?.role === "parent") && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ padding: '8px 16px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                                        Direct Chats (1-on-1)
                                    </div>
                                    {buildStudentSubjectItems().map((room, idx) => (
                                        <div
                                            key={room.id || `pending-${idx}`}
                                            className={`chat-room-item ${activeRoom?.subject_id === room.subject_id && activeRoom?.type === 'direct' ? "active" : ""}`}
                                            onClick={() => selectRoom(room)}
                                        >
                                            <div className="room-avatar" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>D</div>
                                            <div className="room-details">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <h4 className="room-name">{room.name || `Direct Chat - ${enrolledSubjects.find(s => s.id === room.subject_id)?.name || "Subject"}`}</h4>
                                                    {room.unread_count > 0 && (
                                                        <span className="msg-count-badge">{room.unread_count}</span>
                                                    )}
                                                </div>
                                                <p className="room-subtitle">Personal chat with faculty</p>
                                            </div>
                                        </div>
                                    ))}
                                    {enrolledSubjects.length === 0 && (
                                        <div style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>You are not enrolled in any subjects.</div>
                                    )}
                                </div>
                            )}

                            {/* --- Group Rooms List --- */}
                            <div style={{ padding: '8px 16px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                                {(user?.role === "student" || user?.role === "parent") ? "Group Rooms" : "All Rooms"}
                            </div>
                            {rooms.filter(r => (user?.role === "student" || user?.role === "parent") ? r.type !== "direct" : true).map(room => (
                                <div
                                    key={room.id}
                                    className={`chat-room-item ${activeRoom?.id === room.id ? "active" : ""}`}
                                    onClick={() => selectRoom(room)}
                                    style={{ position: 'relative' }}
                                >
                                    <div className="room-avatar">{getRoomInitial(room)}</div>
                                    <div className="room-details">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h4 className="room-name">{getRoomLabel(room)}</h4>
                                            {room.unread_count > 0 && (
                                                <span className="msg-count-badge">{room.unread_count}</span>
                                            )}
                                        </div>
                                        <p className="room-subtitle">{getRoomSubLabel(room)}</p>
                                    </div>
                                    {(user?.role === "faculty" && room.faculty_id && room.type !== "direct") && (
                                        <button
                                            className="btn btn-secondary"
                                            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: '2px 8px', fontSize: '0.8rem', background: 'transparent', border: 'none', color: 'var(--danger)' }}
                                            onClick={(e) => handleDeleteRoom(room.id, e)}
                                            title="Delete Room"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            ))}

                            {rooms.length === 0 && (user?.role !== "student" && user?.role !== "parent") && (
                                <div className="chat-no-rooms">
                                    <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>💬</div>
                                    <p>No rooms available.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── Main Chat Area ─────────────────────────────── */}
            <div className="chat-main">
                {activeRoom ? (
                    <>
                        <div className="chat-header">
                            {/* Mobile back button — goes back to room list */}
                            <button
                                className="chat-mobile-back"
                                onClick={handleMobileBack}
                                style={{ display: 'none' }}  /* shown via CSS @media */
                                aria-label="Back to rooms"
                            >
                                ← Back
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {getRoomLabel(activeRoom)}
                                </h3>
                                <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                                    {getRoomSubLabel(activeRoom)}
                                    <span className={`badge badge-${activeRoom.type === 'direct' ? 'primary' : 'info'}`} style={{ marginLeft: 8, fontSize: "0.7rem" }}>
                                        {activeRoom.type}
                                    </span>
                                </p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                {isReadOnly && (
                                    <span className="monitor-badge">👁️ Monitor Mode</span>
                                )}
                                {/* Toggle Participants Button — hidden on mobile */}
                                {activeRoom.type !== "direct" && user?.role !== "student" && user?.role !== "parent" && (
                                    <button
                                        className="btn btn-secondary"
                                        style={{ padding: "6px 12px", fontSize: "0.82rem" }}
                                        onClick={() => setShowParticipants(!showParticipants)}
                                    >
                                        👥
                                    </button>
                                )}
                            </div>
                        </div>

                        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                            <div className="chat-messages" style={{ flex: 1 }}>
                                {!activeRoom.id ? (
                                    <div className="no-messages">
                                        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>👋</div>
                                        <p>Say hello to start the chat!</p>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="no-messages">
                                        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>💬</div>
                                        <p>No messages yet. Be the first to say something!</p>
                                    </div>
                                ) : (
                                    messages.map((msg, idx) => {
                                        const isMe = Number(msg.sender_id) === myUserId;
                                        const senderName = msg.sender?.display_name || msg.sender?.name || `User #${msg.sender_id}`;
                                        const msgTime = new Date(msg.created_at).toLocaleTimeString([], {
                                            hour: "2-digit", minute: "2-digit"
                                        });

                                        return (
                                            <div key={msg.id || idx} className={`chat-message ${isMe ? "sent" : "received"}`}>
                                                {!isMe && !msg.sender?.is_hidden_student && (
                                                    <div className="msg-sender">
                                                        {senderName}
                                                        <span className={`role-badge role-${msg.sender_role}`}>{msg.sender_role}</span>
                                                    </div>
                                                )}
                                                <div className="msg-bubble">{msg.message}</div>
                                                <div className="msg-time">{msgTime}</div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Participants Panel */}
                            {showParticipants && activeRoom.id && (
                                <div className="chat-participants-panel">
                                    <div className="participants-header">
                                        <span>👥 Room Members</span>
                                        <button className="close-participants" onClick={() => setShowParticipants(false)}>✕</button>
                                    </div>

                                    {facultyParticipants.length > 0 && (
                                        <div className="participants-section">
                                            <div className="participants-section-title">👨‍🏫 Faculty ({facultyParticipants.length})</div>
                                            {facultyParticipants.map(p => (
                                                <div key={p.id} className="participant-item">
                                                    <div className="participant-avatar faculty-avatar">{(p.User?.name || "?")[0].toUpperCase()}</div>
                                                    <div className="participant-name">
                                                        {p.User?.name || "Unknown"}
                                                        {Number(p.user_id) === myUserId && <span style={{ fontSize: "0.7rem", color: "#6366f1", marginLeft: 4 }}>(you)</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {studentParticipants.length > 0 && (
                                        <div className="participants-section">
                                            <div className="participants-section-title">👩‍🎓 Students ({studentParticipants.length})</div>
                                            {(user?.role !== "student" && user?.role !== "parent") && studentParticipants.map(p => (
                                                <div key={p.id} className="participant-item">
                                                    <div className="participant-avatar student-avatar">{(p.User?.name || "?")[0].toUpperCase()}</div>
                                                    <div className="participant-name">
                                                        {p.User?.name || "Unknown"}
                                                        {Number(p.user_id) === myUserId && <span style={{ fontSize: "0.7rem", color: "#10b981", marginLeft: 4 }}>(you)</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        {isReadOnly ? (
                            <div className="chat-monitor-banner">👁️ You are viewing this chat as Admin — read only</div>
                        ) : chatUsage && !chatUsage.unlimited && chatUsage.percent >= 100 ? (
                            ['admin', 'manager', 'owner'].includes(user?.role) ? (
                                <div className="chat-limit-overlay">
                                    <div className="chat-limit-icon">🔒</div>
                                    <h3 className="chat-limit-title">Monthly Message Limit Reached</h3>
                                    <p className="chat-limit-subtitle">
                                        Your institute has used all <strong>{chatUsage.limit} messages</strong> for this month.
                                        Resets on the 1st of next month.
                                    </p>
                                    <div className="chat-limit-progress">
                                        <div className="chat-limit-progress-header">
                                            <span>Usage</span>
                                            <span>{chatUsage.used} / {chatUsage.limit}</span>
                                        </div>
                                        <div className="chat-limit-progress-bar">
                                            <div className="chat-limit-progress-fill" />
                                        </div>
                                    </div>
                                    <div className="chat-limit-cta">⬆️ Contact Admin to Upgrade</div>
                                    <p className="chat-limit-reset">Limit resets on the 1st of each month</p>
                                </div>
                            ) : (
                                <div className="chat-limit-overlay" style={{ background: "var(--bg-secondary)", padding: "1.5rem" }}>
                                    <div className="chat-limit-icon" style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔒</div>
                                    <h3 className="chat-limit-title" style={{ fontSize: "1.2rem", color: "var(--text-primary)" }}>Messaging Disabled</h3>
                                    <p className="chat-limit-subtitle" style={{ fontSize: "0.9rem", color: "var(--text-secondary)", margin: 0 }}>
                                        Messaging is currently disabled. Please contact your institute administrator.
                                    </p>
                                </div>
                            )
                        ) : (
                            <form className="chat-input-area" onSubmit={sendMessage}>
                                <input
                                    type="text"
                                    className="chat-input"
                                    placeholder="Type a message… (Enter to send)"
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    disabled={sending}
                                    autoFocus
                                />
                                <button type="submit" className="btn btn-primary chat-send-btn" disabled={!newMessage.trim() || sending}>
                                    {sending ? "⏳" : "Send ➤"}
                                </button>
                            </form>
                        )}
                    </>
                ) : (
                    <div className="chat-empty-state">
                        <div className="chat-empty-icon">💬</div>
                        <h2>Select a chat room</h2>
                        <p>Select a room or direct chat from the list to start messaging.</p>
                    </div>
                )}
            </div>

            {/* Create Room Modal */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: 450 }}>
                        <h2>Create Group Room</h2>
                        <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>Create a designated discussion room for your students.</p>
                        <form onSubmit={createRoom}>
                            <div className="form-group">
                                <label className="form-label">Room Name</label>
                                <input
                                    className="form-input"
                                    required
                                    placeholder="e.g. Algebra Q&A"
                                    value={createFormData.name}
                                    onChange={e => setCreateFormData({ ...createFormData, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Associated Subject</label>
                                <select
                                    className="form-input"
                                    required
                                    value={createFormData.subject_id}
                                    onChange={e => setCreateFormData({ ...createFormData, subject_id: e.target.value })}
                                >
                                    <option value="">-- Select Subject --</option>
                                    {facultySubjects.map(s => <option key={s.id} value={s.id}>{s.name} {s.Class?.name ? `(${s.Class.name})` : ""}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Target Audience</label>
                                <select
                                    className="form-input"
                                    required
                                    value={createFormData.audience}
                                    onChange={e => setCreateFormData({ ...createFormData, audience: e.target.value })}
                                >
                                    <option value="Both">Both (Boys & Girls)</option>
                                    <option value="Boys">Boys Only</option>
                                    <option value="Girls">Girls Only</option>
                                </select>
                                <small style={{ color: "var(--text-secondary)" }}>Only students of this gender will see and join this room. Message senders are kept anonymous (e.g. "Male Student").</small>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create Room</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatApp;
