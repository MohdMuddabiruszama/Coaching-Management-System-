import { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { toast } from "react-hot-toast";
import EmojiPicker from "emoji-picker-react";
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
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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
    const [showFilters, setShowFilters] = useState(false);
    const [filterData, setFilterData] = useState({
        faculties: [],
        subjects: [],
        classes: [],
        parents: []
    });

    const messagesEndRef = useRef(null);
    const pollRef = useRef(null);
    const activeRoomRef = useRef(null);
    const pollingRef = useRef(false); // For deduplication
    
    // Pagination states
    const [hasMore, setHasMore] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const oldestMessageIdRef = useRef(null);

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

    // Poll messages (with deduplication and visibility check)
    useEffect(() => {
        activeRoomRef.current = activeRoom;
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }

        const pollTick = async () => {
            if (pollingRef.current) return; // Deduplication: Skip if previous poll still running
            pollingRef.current = true;
            try {
                const promises = [fetchRooms()];
                if (activeRoomRef.current?.id) {
                    // Only load the latest messages on poll, don't use the 'before' cursor
                    promises.push(loadMessages(activeRoomRef.current.id, false, true));
                }
                await Promise.all(promises);
            } catch (err) {
                console.error("Poll error:", err);
            } finally {
                pollingRef.current = false;
            }
        };

        const handleVisibility = () => {
            if (document.hidden && pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            } else if (!document.hidden) {
                pollRef.current = setInterval(pollTick, 10000); // 10s interval
                pollTick(); // Immediate refresh when visible
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);

        if (activeRoom && activeRoom.id) {
            // Initial load for new room
            loadMessages(activeRoom.id, false);
            loadParticipants(activeRoom.id);
            markAsRead(activeRoom.id);
            
            pollRef.current = setInterval(pollTick, 10000);
        } else {
            pollRef.current = setInterval(pollTick, 10000);
        }

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
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

    const loadMessages = async (roomId, append = false, isPoll = false) => {
        try {
            if (append) setLoadingOlder(true);
            
            let url = `/chat/room/${roomId}`;
            const params = new URLSearchParams();
            params.append('limit', '50');
            
            // If appending older messages, use the oldestMessageIdRef
            if (append && oldestMessageIdRef.current) {
                params.append('before', oldestMessageIdRef.current);
            }
            
            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const res = await api.get(url);
            if (res.data.success) {
                const fetchedMessages = res.data.data || [];
                
                if (append) {
                    setMessages(prev => [...fetchedMessages, ...prev]);
                } else if (!isPoll) {
                    // Full refresh (e.g. room select)
                    setMessages(fetchedMessages);
                } else {
                    // Polling: we only want to append NEW messages to the end
                    // Easiest is just replace the whole array since limit=50 gets the latest 50
                    setMessages(fetchedMessages); 
                }

                setHasMore(res.data.hasMore || false);
                oldestMessageIdRef.current = res.data.oldestId || null;
            }
        } catch (err) {
            console.error("Load messages error:", err);
        } finally {
            if (append) setLoadingOlder(false);
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
            // Only reload messages. loadParticipants and fetchChatUsage are redundant here.
            await loadMessages(targetRoomId);

            // Fire and forget fetchRooms to update badges
            fetchRooms();

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
        setHasMore(false);
        oldestMessageIdRef.current = null;
        if (room.id) {
            markAsRead(room.id);
        }
        // On mobile: hide participants panel by default
        if (isMobileScreen()) setShowParticipants(false);
    };

    /** Mobile: go back to room list */
    const handleMobileBack = () => {
        setActiveRoom(null);
        setMessages([]);
        setParticipants([]);
    };

    // ─── Direct Chats for Student / Parent ───
    const buildStudentSubjectItems = () => {
        const rawItems = enrolledSubjects.map(sub => {
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

        // Sort by last message time (descending)
        rawItems.sort((a, b) => {
            const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            return timeB - timeA;
        });

        // ── Deduplicate by display name ──
        // Parents with multiple children enrolled in the same subject with the
        // same faculty would otherwise see repeated entries. We keep only the
        // first occurrence (which has the highest priority after sorting).
        const seenNames = new Set();
        const uniqueItems = [];
        for (const item of rawItems) {
            const displayName = getRoomLabel(item);
            if (!seenNames.has(displayName)) {
                seenNames.add(displayName);
                uniqueItems.push(item);
            }
        }

        return uniqueItems;
    };

    // ─── Helpers ─────────────────────────────────────────────────────────────
    const getRoomLabel = (room) => {
        if (room.name && room.type !== "direct") return room.name;
        if (room.type === "direct") {
            if (user?.role === "faculty" && room.ChatParticipants) {
                const studentP = room.ChatParticipants.find(p => p.role === "student" || p.User?.role === "student" || p.role === "parent" || p.User?.role === "parent");
                if (studentP && studentP.User) return `${studentP.User.name} - Direct Chat`;
            }
            if (user?.role === "student" || user?.role === "parent") {
                const subject = enrolledSubjects.find(s => s.id === room.subject_id);
                const facultyName = subject?.Faculty?.User?.name;
                const subjectName = subject?.name || room.Subject?.name || "Subject";
                return facultyName ? `${facultyName} - ${subjectName}` : `Direct Chat - ${subjectName}`;
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
    const parentParticipants = participants.filter(p => p.User?.role === "parent");


    return (
        <div className={`chat-container${activeRoom ? ' room-open' : ''}`}>

            {/* ── Sidebar: Rooms ─────────────────────────────── */}
            <div className="chat-sidebar">
                <div className="chat-sidebar-header">
                    {!isReadOnly && (
                        <button className="chat-back-btn" onClick={() => navigate(-1)}>
                            ← Back
                        </button>
                    )}
                    <h3>
                        <span style={{ fontSize: '1.4rem' }}>💬</span> Academic Chat
                    </h3>
                    <p>Connect with your faculty and classmates</p>
                </div>

                {/* Admin Filters UI */}
                {(user?.role === "admin" || user?.role === "manager" || user?.role === "owner") && (
                    <div className="chat-filters-card">
                        <h4 
                            onClick={() => setShowFilters(!showFilters)}
                            style={{ margin: showFilters ? '0 0 12px 0' : '0', fontSize: 14, color: '#111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        >
                            Filters <span style={{ color: '#6b7280' }}>{showFilters ? '▴' : '▾'}</span>
                        </h4>
                        {showFilters && (
                            <div className="chat-filters">
                                <select className="form-input" value={filters.type} onChange={(e) => handleFilterChange('type', e.target.value)}>
                                    <option value="">All Types</option>
                                    <option value="group">Group Rooms</option>
                                    <option value="direct">Direct Chats</option>
                                </select>
                                <select className="form-input" value={filters.class_id} onChange={(e) => handleFilterChange('class_id', e.target.value)}>
                                    <option value="">All Classes</option>
                                    {filterData.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <select className="form-input" value={filters.faculty_id} onChange={(e) => handleFilterChange('faculty_id', e.target.value)}>
                                    <option value="">All Faculty</option>
                                    {filterData.faculties.map(f => <option key={f.id} value={f.id}>{f.User?.name || f.id}</option>)}
                                </select>
                                <select className="form-input" value={filters.subject_id} onChange={(e) => handleFilterChange('subject_id', e.target.value)}>
                                    <option value="">All Subjects</option>
                                    {filterData.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <select className="form-input" value={filters.parent_id} onChange={(e) => handleFilterChange('parent_id', e.target.value)}>
                                    <option value="">Filter by Parent</option>
                                    {filterData.parents.map(p => <option key={p.id} value={p.id}>{p.User?.name || p.name || 'Parent'}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                )}

                <div className="chat-room-list-container">
                    {loadingData ? (
                        <div style={{ padding: 20 }}><LoadingSpinner /></div>
                    ) : (
                        <div className="chat-room-list">
                            <div className="chat-list-section-header">
                                <span>Chats</span>
                            </div>
                            
                            {(user?.role === "student" || user?.role === "parent") && buildStudentSubjectItems().map((room, idx) => {
                                const displayName = getRoomLabel(room);
                                const isActive = activeRoom?.subject_id === room.subject_id && activeRoom?.type === 'direct';
                                const timeStr = room.last_message_at ? new Date(room.last_message_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                                
                                // Color logic based on index or name
                                const colors = ['purple', 'blue', 'green', 'orange'];
                                const colorClass = colors[idx % colors.length];

                                return (
                                <div
                                    key={room.id || `pending-${idx}`}
                                    className={`chat-room-item ${isActive ? "active" : ""}`}
                                    onClick={() => selectRoom(room)}
                                >
                                    <div className={`room-avatar ${colorClass}`}>
                                        {displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="room-details">
                                        <div className="room-details-top">
                                            <h4 className="room-name">{displayName}</h4>
                                            <span className="room-time">{timeStr}</span>
                                        </div>
                                        <div className="room-details-bottom">
                                            <p className="room-subtitle">
                                                {room.last_message_text ? room.last_message_text : "1-on-1 with Faculty"}
                                            </p>
                                            {room.unread_count > 0 && (
                                                <span className="msg-count-badge red">{room.unread_count}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )})}

                            <div className="section-label">
                                GROUP ROOMS
                            </div>
                            
                            {rooms.filter(r => (user?.role === "student" || user?.role === "parent") ? r.type !== "direct" : true).map((room, idx) => {
                                const timeStr = room.last_message_at ? (() => {
                                    const d = new Date(room.last_message_at);
                                    const now = new Date();
                                    if(d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                    now.setDate(now.getDate() - 1);
                                    if(d.toDateString() === now.toDateString()) return 'Yesterday';
                                    return Math.floor((new Date() - d) / (1000*60*60*24)) + ' days ago';
                                })() : '';

                                const colors = ['blue', 'purple', 'green', 'orange'];
                                const colorClass = colors[idx % colors.length];

                                return (
                                <div
                                    key={room.id}
                                    className={`chat-room-item ${activeRoom?.id === room.id ? "active" : ""}`}
                                    onClick={() => selectRoom(room)}
                                >
                                    <div className={`room-avatar ${colorClass}`}>
                                        {getRoomInitial(room)}
                                    </div>
                                    <div className="room-details">
                                        <div className="room-details-top">
                                            <h4 className="room-name">{getRoomLabel(room)}</h4>
                                            <span className="room-time">{timeStr}</span>
                                        </div>
                                        <div className="room-details-bottom">
                                            <p className="room-subtitle">
                                                {room.last_message_text ? room.last_message_text : getRoomSubLabel(room)}
                                            </p>
                                            {room.unread_count > 0 && (
                                                <span className="msg-count-badge green">{room.unread_count}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )})}

                            {rooms.length === 0 && (user?.role !== "student" && user?.role !== "parent") && (
                                <div className="chat-no-rooms">
                                    <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>💬</div>
                                    <p>No rooms available.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Main Chat Area ─────────────────────────────── */}
            <div className="chat-main">
                {activeRoom ? (
                    <>
                        <div className="chat-header">
                            <button
                                className="chat-mobile-back"
                                onClick={handleMobileBack}
                                style={{ display: 'none' }} 
                            >
                                ← Back
                            </button>
                            <div className="chat-header-info">
                                <h3>{getRoomLabel(activeRoom)}</h3>
                                <span className="chat-header-pill">
                                    {activeRoom.type === 'direct' ? 'Direct Chat' : 'Group Chat'}
                                </span>
                            </div>
                            <div className="chat-header-actions" style={{ marginRight: isReadOnly ? '260px' : '0' }}>
                                <div className="chat-header-icon" onClick={() => setShowParticipants(!showParticipants)}>ⓘ</div>
                            </div>
                        </div>

                        {/* ── Safety Monitoring Notice Banner ── */}
                        {!isReadOnly && (
                            <div className="chat-monitoring-info-banner">
                                <div className="chat-monitoring-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                    </svg>
                                </div>
                                <span>For your safety and academic integrity, all chats are monitored by the administration.</span>
                            </div>
                        )}

                        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                            <div className="chat-messages">
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
                                    <>
                                        {hasMore && (
                                            <div style={{ textAlign: "center", padding: "10px" }}>
                                                <button 
                                                    onClick={() => loadMessages(activeRoom.id, true)}
                                                    disabled={loadingOlder}
                                                    style={{
                                                        background: "#ffffff", border: "1px solid #e5e7eb", padding: "6px 16px",
                                                        borderRadius: "16px", cursor: "pointer", color: "#6b7280", fontSize: "0.85rem",
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    {loadingOlder ? "Loading..." : "Load older messages"}
                                                </button>
                                            </div>
                                        )}
                                        
                                        {messages.map((msg, idx) => {
                                        const isMe = Number(msg.sender_id) === myUserId;
                                        const senderName = msg.sender?.display_name || msg.sender?.name || `User #${msg.sender_id}`;
                                        const msgTime = new Date(msg.created_at).toLocaleTimeString([], {
                                            hour: "2-digit", minute: "2-digit"
                                        });
                                        const msgDate = new Date(msg.created_at).toDateString();
                                        const showDate = idx === 0 || new Date(messages[idx - 1].created_at).toDateString() !== msgDate;

                                        let isRead = false;
                                        if (isMe && participants && participants.length > 0) {
                                            const otherParticipants = participants.filter(p => Number(p.user_id) !== myUserId);
                                            // Check if faculty read it, otherwise check if any participant read it
                                            const facultyParticipants = otherParticipants.filter(p => p.role === "faculty");
                                            const targetParticipants = facultyParticipants.length > 0 ? facultyParticipants : otherParticipants;
                                            
                                            isRead = targetParticipants.some(p => {
                                                if (!p.last_read_at) return false;
                                                return new Date(p.last_read_at) >= new Date(msg.created_at);
                                            });
                                        }

                                        return (
                                            <div key={msg.id || idx}>
                                                {showDate && (
                                                    <div className="date-divider">
                                                        <span>{msgDate === new Date().toDateString() ? 'Today' : msgDate}</span>
                                                    </div>
                                                )}
                                                <div className={`chat-message-container ${isMe ? "sent" : "received"}`}>
                                                    {!isMe && (
                                                        <div className="chat-message-avatar">
                                                            {senderName.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="chat-message-content" style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                                        {isReadOnly && !isMe && (
                                                            <span style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '2px', marginLeft: '4px', fontWeight: 600 }}>{senderName}</span>
                                                        )}
                                                        <div className="msg-bubble">
                                                            {msg.message}
                                                        </div>
                                                        <div className="msg-footer">
                                                            <span>{msgTime}</span>
                                                            {isMe && <span className={`read-receipts ${isRead ? 'read' : 'delivered'}`}>✔✔</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    </>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Participants Panel */}
                            {showParticipants && activeRoom.id && (
                                <div className="chat-participants-panel">
                                    <div className="participants-header">
                                        <h3>Participants ({participants.length})</h3>
                                        <button className="close-participants" onClick={() => setShowParticipants(false)}>✕</button>
                                    </div>
                                    <div className="participants-content">
                                        {facultyParticipants.length > 0 && (
                                            <div>
                                                <div className="participants-section-title">
                                                    <span>🏛️</span> FACULTY ({facultyParticipants.length})
                                                </div>
                                                {facultyParticipants.map(p => (
                                                    <div key={p.id} className="participant-item">
                                                        <div className="participant-avatar">
                                                            {(p.User?.name || "?")[0].toUpperCase()}
                                                        </div>
                                                        <div className="participant-info">
                                                            <div className="participant-name">
                                                                {p.User?.name || "Unknown"} {Number(p.user_id) === myUserId && "(you)"}
                                                            </div>
                                                            <div className="participant-role">Faculty</div>
                                                        </div>
                                                        <div className="status-dot online"></div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {studentParticipants.length > 0 && (
                                            <div style={{ marginTop: 24 }}>
                                                <div className="participants-section-title">
                                                    <span>🎓</span> STUDENTS ({studentParticipants.length})
                                                </div>
                                                {(user?.role !== "student" && user?.role !== "parent") && studentParticipants.map(p => (
                                                    <div key={p.id} className="participant-item">
                                                        <div className="participant-avatar student">
                                                            {(p.User?.name || "?")[0].toUpperCase()}
                                                        </div>
                                                        <div className="participant-info">
                                                            <div className="participant-name">
                                                                {p.User?.name || "Unknown"} {Number(p.user_id) === myUserId && "(you)"}
                                                            </div>
                                                            <div className="participant-role">Student</div>
                                                        </div>
                                                        <div className="status-dot offline"></div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {parentParticipants.length > 0 && (
                                            <div style={{ marginTop: 24 }}>
                                                <div className="participants-section-title">
                                                    <span>👨‍👩‍👧</span> PARENTS ({parentParticipants.length})
                                                </div>
                                                {parentParticipants.map(p => (
                                                    <div key={p.id} className="participant-item">
                                                        <div className="participant-avatar parent" style={{ background: '#fef3c7', color: '#92400e' }}>
                                                            {(p.User?.name || "?")[0].toUpperCase()}
                                                        </div>
                                                        <div className="participant-info">
                                                            <div className="participant-name">
                                                                {p.User?.name || "Unknown"} {Number(p.user_id) === myUserId && "(you)"}
                                                            </div>
                                                            <div className="participant-role">Parent</div>
                                                        </div>
                                                        <div className="status-dot offline"></div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        {isReadOnly ? (
                            <div className="chat-monitor-banner" style={{ background: '#fef3c7', color: '#92400e', fontSize: 12, fontWeight: 600, padding: '12px', textAlign: 'center' }}>
                                👁️ You are viewing this chat as Admin — read only
                            </div>
                        ) : (
                            <form className="chat-input-area" onSubmit={sendMessage} style={{ position: 'relative' }}>
                                {showEmojiPicker && (
                                    <div style={{ position: 'absolute', bottom: '100%', right: '20px', zIndex: 100 }}>
                                        <EmojiPicker 
                                            onEmojiClick={(emojiData) => {
                                                setNewMessage(prev => prev + emojiData.emoji);
                                                setShowEmojiPicker(false);
                                            }}
                                            width={300}
                                            height={400}
                                        />
                                    </div>
                                )}
                                <div className="chat-input-wrapper">
                                    <textarea
                                        className="chat-input"
                                        placeholder="Type your message..."
                                        value={newMessage}
                                        onChange={e => {
                                            setNewMessage(e.target.value);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = (e.target.scrollHeight < 100 ? e.target.scrollHeight : 100) + 'px';
                                        }}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                if (newMessage.trim() && !sending) {
                                                    sendMessage(e);
                                                }
                                            }
                                        }}
                                        disabled={sending}
                                        autoFocus
                                        rows={1}
                                        style={{ resize: 'none', minHeight: '24px', maxHeight: '100px', overflowY: 'auto' }}
                                    />
                                    <div className="chat-input-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <span onClick={() => setNewMessage(prev => prev + '\n')} title="Next line" style={{ cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↵</span>
                                        <span onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Add Emoji" style={{ cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>😀</span>
                                        <span style={{ fontSize: '0.8rem' }}>{newMessage.length} / 2000</span>
                                    </div>
                                    <button type="submit" className="chat-send-btn" disabled={!newMessage.trim() || sending}>
                                        {sending ? "⏳" : "➤"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </>
                ) : (
                    <div className="chat-empty-state">
                        <div style={{ fontSize: "3rem", opacity: 0.5, marginBottom: 16 }}>💬</div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>Select a chat room</h2>
                        <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>Select a room or direct chat from the list to start messaging.</p>
                    </div>
                )}
            </div>

            {/* Create Room Modal */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: 450 }}>
                        <h2>Create Group Room</h2>
                        <p style={{ color: "#6b7280", marginBottom: 16 }}>Create a designated discussion room for your students.</p>
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
                            </div>
                            <div className="modal-actions" style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                                <button type="button" style={{ background: '#f3f4f6', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }} onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button type="submit" style={{ background: '#7e22ce', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Create Room</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatApp;
