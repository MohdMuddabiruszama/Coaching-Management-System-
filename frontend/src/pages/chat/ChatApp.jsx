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
    
    // Student Search States
    const [studentSearchQuery, setStudentSearchQuery] = useState("");
    const [studentSearchResults, setStudentSearchResults] = useState([]);
    const [isSearchingStudents, setIsSearchingStudents] = useState(false);
    const searchTimeoutRef = useRef(null);

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
        if (e && e.stopPropagation) e.stopPropagation();
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
    // Start a direct chat
    const startDirectChat = async (target_user_id) => {
        try {
            const createRes = await api.post("/chat/room/get-or-create", { type: "direct", target_user_id });
            if (createRes.data.success) {
                const newRoom = createRes.data.room;
                
                // Clear search
                setStudentSearchQuery("");
                setStudentSearchResults([]);

                // Add to rooms if not exists
                setRooms(prev => {
                    const exists = prev.find(r => r.id === newRoom.id);
                    if (exists) return prev;
                    return [newRoom, ...prev];
                });
                selectRoom(newRoom);
            }
        } catch (err) {
            toast.error("Could not start direct chat");
        }
    };

    const handleStudentSearch = (e) => {
        const query = e.target.value;
        setStudentSearchQuery(query);

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (!query.trim()) {
            setStudentSearchResults([]);
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            setIsSearchingStudents(true);
            try {
                const res = await api.get(`/students/lookup?search=${encodeURIComponent(query)}&limit=5`);
                if (res.data.success) {
                    setStudentSearchResults(res.data.data || []);
                }
            } catch (err) {
                console.error("Student search error", err);
            } finally {
                setIsSearchingStudents(false);
            }
        }, 300);
    };

    const handleRoomScroll = (e) => {
        setActiveRoom(null);
        setMessages([]);
        setParticipants([]);
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

    const handleDeleteMessage = async (messageId) => {
        if (!window.confirm("Are you sure you want to delete this message?")) return;
        try {
            const res = await api.delete(`/chat/message/${messageId}`);
            if (res.data.success) {
                toast.success("Message deleted");
                setMessages(prev => prev.filter(m => m.id !== messageId));
            }
        } catch (err) {
            console.error("Delete message error:", err);
            toast.error(err.response?.data?.message || "Failed to delete message.");
        }
    };

    // ─── Helpers ─────────────────────────────────────────────────────────────
    const getRoomLabel = (room) => {
        if (room.name && room.type !== "direct") return room.name;
        if (room.type === "direct") {
            if (user?.role === "faculty" && room.ChatParticipants) {
                const studentP = room.ChatParticipants.find(p => p.role === "student" || p.User?.role === "student" || p.role === "parent" || p.User?.role === "parent");
                if (studentP && studentP.User) return studentP.User.name;
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

    const isParticipantOnline = (p) => {
        if (Number(p.user_id) === myUserId) return true;
        if (!p.last_read_at) return false;
        const diffInMs = new Date() - new Date(p.last_read_at);
        return diffInMs < 120000;
    };

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
                    
                    {/* Action Buttons */}
                    {(user?.role === "faculty" || user?.role === "admin" || user?.role === "owner" || user?.role === "manager") && (
                        <button 
                            className="create-room-btn"
                            onClick={() => setShowCreateModal(true)}
                            style={{ 
                                marginTop: '16px', 
                                width: '100%', 
                                background: 'linear-gradient(135deg, #7e22ce 0%, #6b21a8 100%)', 
                                color: '#fff', 
                                border: 'none', 
                                padding: '12px', 
                                borderRadius: '10px', 
                                fontSize: '0.95rem', 
                                fontWeight: 600, 
                                cursor: 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '8px',
                                boxShadow: '0 4px 12px rgba(126, 34, 206, 0.25)',
                                transition: 'transform 0.2s, box-shadow 0.2s'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(126, 34, 206, 0.35)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(126, 34, 206, 0.25)'; }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Create New Room
                        </button>
                    )}

                    {chatUsage && (user?.role === "admin" || user?.role === "owner" || user?.role === "manager") && (
                        <div style={{ marginTop: '15px', padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#8b5cf6' }}>
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                    </svg>
                                    Message Usage
                                </span>
                                <span>{chatUsage.unlimited ? 'Unlimited' : `${chatUsage.used.toLocaleString()} / ${chatUsage.limit.toLocaleString()}`}</span>
                            </div>
                            {!chatUsage.unlimited && (
                                <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: `${chatUsage.percent}%`, 
                                        background: chatUsage.percent > 90 ? '#ef4444' : chatUsage.percent > 75 ? '#f59e0b' : '#8b5cf6',
                                        transition: 'width 0.3s ease' 
                                    }}></div>
                                </div>
                            )}
                        </div>
                    )}
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

                            {/* Faculty Student Search Bar */}
                            {(user?.role === "faculty" || user?.role === "admin" || user?.role === "owner" || user?.role === "manager") && (
                                <div style={{ position: 'relative', margin: '0 12px 12px 12px' }}>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type="text" 
                                            placeholder="Search student to chat..." 
                                            value={studentSearchQuery}
                                            onChange={handleStudentSearch}
                                            style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none' }}
                                        />
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 12, top: 11 }}>
                                            <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                        </svg>
                                        {isSearchingStudents && (
                                            <div style={{ position: 'absolute', right: 12, top: 11 }}>
                                                <div className="search-spinner" style={{ width: 14, height: 14, border: '2px solid #e2e8f0', borderTopColor: '#7e22ce', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Search Results Dropdown */}
                                    {studentSearchQuery.trim() && studentSearchResults.length > 0 && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                            {studentSearchResults.map(student => (
                                                <div 
                                                    key={student.id} 
                                                    onClick={() => startDirectChat(student.User?.id)}
                                                    style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: '#fff' }}
                                                    onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                                                    onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                                                >
                                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e8dbfa', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.8rem' }}>
                                                        {student.User?.name?.charAt(0).toUpperCase() || 'S'}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{student.User?.name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{student.Classes?.[0]?.name || 'Student'} • Roll: {student.roll_number}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {studentSearchQuery.trim() && studentSearchResults.length === 0 && !isSearchingStudents && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', border: '1px solid #e2e8f0' }}>
                                            No students found
                                        </div>
                                    )}
                                </div>
                            )}
                            
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

                            {rooms.filter(r => r.type === "direct").length > 0 && (
                                <>
                                    <div className="section-label">
                                        DIRECT CHATS
                                    </div>
                                    {rooms.filter(r => r.type === "direct").map((room, idx) => {
                                        const timeStr = room.last_message_at ? (() => {
                                            const d = new Date(room.last_message_at);
                                            const now = new Date();
                                            if(d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                            now.setDate(now.getDate() - 1);
                                            if(d.toDateString() === now.toDateString()) return 'Yesterday';
                                            return Math.floor((new Date() - d) / (1000*60*60*24)) + ' days ago';
                                        })() : '';

                                        const colors = ['purple', 'blue', 'green', 'orange'];
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
                                </>
                            )}

                            {user?.role !== "parent" && (
                                <>
                                    <div className="section-label">
                                        GROUP ROOMS
                                    </div>
                                    
                                    {rooms.filter(r => r.type !== "direct").map((room, idx) => {
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
                                </>
                            )}

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
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"></line>
                                    <polyline points="12 19 5 12 12 5"></polyline>
                                </svg>
                            </button>
                            <div className="chat-header-info">
                                <div className="room-avatar purple" style={{ width: 40, height: 40, fontSize: '1rem', margin: 0 }}>
                                    {getRoomInitial(activeRoom)}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                    <h3>{getRoomLabel(activeRoom)}</h3>
                                    {(() => {
                                        if (activeRoom.type === "direct") {
                                            const otherP = participants.find(p => Number(p.user_id) !== myUserId);
                                            const isOnline = otherP ? isParticipantOnline(otherP) : false;
                                            return (
                                                <span style={{ fontSize: '0.8rem', color: isOnline ? '#10b981' : '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? '#10b981' : '#cbd5e1', display: 'inline-block' }}></span> {isOnline ? "Online" : "Offline"}
                                                </span>
                                            );
                                        } else {
                                            const onlineCount = participants.filter(p => Number(p.user_id) !== myUserId && isParticipantOnline(p)).length;
                                            return (
                                                <span style={{ fontSize: '0.8rem', color: onlineCount > 0 ? '#10b981' : '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: onlineCount > 0 ? '#10b981' : '#cbd5e1', display: 'inline-block' }}></span> {onlineCount > 0 ? `${onlineCount} Online` : "Group Chat"}
                                                </span>
                                            );
                                        }
                                    })()}
                                </div>
                                {isReadOnly && (
                                    <div 
                                        className="chat-header-icon" 
                                        onClick={() => setShowParticipants(!showParticipants)}
                                        style={{ 
                                            marginLeft: '8px', 
                                            width: '32px', 
                                            height: '32px', 
                                            background: showParticipants ? '#f3e8ff' : '#ffffff', 
                                            color: showParticipants ? '#7e22ce' : '#6b7280', 
                                            borderColor: showParticipants ? '#d8b4fe' : '#e5e7eb' 
                                        }}
                                        title="View Participants"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <line x1="12" y1="16" x2="12" y2="12"></line>
                                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                        </svg>
                                    </div>
                                )}
                                {isReadOnly && (
                                    <button 
                                        onClick={() => handleDeleteRoom(activeRoom.id)}
                                        style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                                        title="Delete this entire room"
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        Delete Room
                                    </button>
                                )}
                            </div>
                            <div className="chat-header-actions">
                                {!isReadOnly && (
                                    <div 
                                        className="chat-header-icon" 
                                        onClick={() => setShowParticipants(!showParticipants)}
                                        style={{ 
                                            background: showParticipants ? '#f3e8ff' : '#ffffff', 
                                            color: showParticipants ? '#7e22ce' : '#6b7280', 
                                            borderColor: showParticipants ? '#d8b4fe' : '#e5e7eb' 
                                        }}
                                        title="View Participants"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <line x1="12" y1="16" x2="12" y2="12"></line>
                                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Safety Monitoring Notice Banner ── */}
                        {!isReadOnly && (
                            <div className="chat-monitoring-info-banner">
                                <div className="chat-monitoring-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                                                            {isReadOnly && (
                                                                <button onClick={() => handleDeleteMessage(msg.id)} style={{background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', marginLeft: '8px', padding: 0}} title="Delete Message">🗑️</button>
                                                            )}
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
                                                        <div className={`status-dot ${isParticipantOnline(p) ? 'online' : 'offline'}`}></div>
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
                                                        <div className={`status-dot ${isParticipantOnline(p) ? 'online' : 'offline'}`}></div>
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
                                                        <div className={`status-dot ${isParticipantOnline(p) ? 'online' : 'offline'}`}></div>
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
                                    <input
                                        type="text"
                                        className="chat-input"
                                        placeholder="Type your message..."
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (newMessage.trim() && !sending) {
                                                    sendMessage(e);
                                                }
                                            }
                                        }}
                                        disabled={sending}
                                        autoFocus
                                    />
                                    <div className="chat-input-bottom-row">
                                        <div className="chat-input-icons-left">
                                            <span onClick={() => {}} title="Attach" className="chat-icon-btn">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                                                </svg>
                                            </span>
                                            <span onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Add Emoji" className="chat-icon-btn">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                                                </svg>
                                            </span>
                                        </div>
                                        <div className="chat-input-actions-right">
                                            <span className="chat-char-count">{newMessage.length} / 2000</span>
                                            <button type="submit" className="chat-send-btn" disabled={!newMessage.trim() || sending}>
                                                {sending ? "⏳" : (
                                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translate(-1px, 1px)' }}>
                                                        <line x1="22" y1="2" x2="11" y2="13"></line>
                                                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>
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
