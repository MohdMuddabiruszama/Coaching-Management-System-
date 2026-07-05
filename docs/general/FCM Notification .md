Institute Management System
Notification System
Complete Implementation Guide


ZenithFlows · Node.js + React + Capacitor + MySQL + FCM + WebSocket
Faculty · Student · Parent · Admin Dashboards

 Chapter 1: Overview & Delivery Channels
The notification system for the ZenithFlows Institute Management System (IMS) is a fully real-time, multi-channel, role-aware notification engine. It is built on top of the existing Node.js/Express backend, React frontend, and Capacitor mobile app. Every notification is always scoped by institute_id ensuring complete multi-tenant isolation.
1.1 Delivery Channels
Channel	When Used	Use Case
Push (FCM)	App closed / background	Absent alert, fee due, new result — highest urgency
WebSocket (Socket.io)	App open (foreground)	Real-time in-app toasts, chat messages, live updates
Email (Nodemailer)	Digest / formal alerts	Fee invoices, result reports, weekly digest summaries
WhatsApp API (future)	Critical parent alerts	Absent child, fee overdue — planned future scope

1.2 Multi-Tenant Isolation
CRITICAL: Every notification record includes institute_id as a foreign key. The NotificationService always filters by institute_id. A parent from Institute A will never receive or see notifications from Institute B.

1.3 Role-Based Notification Matrix
Faculty receives:
•	Assignment submitted by student (in-app + WS)
•	New chat message from parent (Push + WS)
•	Timetable change alert (Push + WS)
•	Leave request from student (in-app)
•	Exam schedule published (Push)
•	Admin / institute announcement (Push + WS + Email)
•	Substitute class assigned (Push + WS)
•	Homework not submitted reminder (in-app)
Student receives:
•	Attendance marked absent (Push + WS) — HIGH priority
•	New marks/results published (Push + WS)
•	New homework assigned (Push + WS)
•	New assignment posted (Push + WS)
•	Assignment graded (Push + WS)
•	Fee due reminder (Push + Email) — HIGH priority
•	Timetable updated (Push + WS)
•	Study material uploaded (WS + in-app)
•	Exam scheduled (Push + WS + Email)
•	Admin/institute announcement (Push + WS + Email)
•	Leave approved / rejected (Push + WS)
Parent receives:
•	Child marked absent — INSTANT (Push) — HIGHEST priority
•	Fee overdue alert (Push + Email)
•	New result/marks published (Push + WS)
•	Attendance below 75% warning (Push + Email)
•	New message from teacher (Push + WS)
•	Institute announcement (Push + WS)
•	Fee payment confirmed (Push + Email)
•	PTM appointment reminder (Push + Email)
•	Leave request status update (Push + WS)
Admin receives:
•	Fee collection summary (WS + Email)
•	Low attendance alert — class-wide (WS + Email)
•	New student / faculty registered (in-app)
•	Razorpay payment_failed webhook (Push + Email) — HIGH priority
•	Biometric sync failure (WS + Email)
•	Subscription renewal alert from super admin (Email)

 Chapter 2: Complete Notification Types Reference
All 18 notification types, their triggers, recipients, channels, and priority levels.

Notification Type	Trigger	Recipients	Channel	Priority
Attendance marked	Faculty saves attendance	Student + Parent	Push + WS	HIGH
Marks published	Faculty publishes marks	Student + Parent	Push + WS	MEDIUM
Assignment posted	Faculty creates	Students in class	Push + WS	MEDIUM
Assignment submitted	Student submits	Faculty	WS + in-app	LOW
Assignment graded	Faculty grades	Student	Push + WS	MEDIUM
Homework assigned	Faculty posts homework	Students in class	Push + WS	MEDIUM
Fee due reminder	CRON — 3 days before due	Student + Parent	Push + Email	HIGH
Payment received	Razorpay webhook	Student + Parent + Admin	Push + Email	MEDIUM
Payment failed	Razorpay webhook	Student + Parent + Admin	Push + Email	HIGH
Chat message	User sends message	Recipient user	WS → Push if offline	HIGH
Announcement	Admin posts	All in institute	Push + WS + Email	MEDIUM
Timetable updated	Admin edits timetable	Faculty + Students	Push + WS	MEDIUM
Exam scheduled	Admin creates exam	Students + Faculty	Push + WS + Email	MEDIUM
Study material uploaded	Faculty uploads file	Students in class	WS + in-app	LOW
Leave approved/rejected	Admin acts on leave	Requesting student	Push + WS	MEDIUM
Low attendance alert	CRON — attendance < 75%	Student + Parent	Push + Email	HIGH
Biometric sync error	Hardware API failure	Admin	WS + Email	HIGH
App system update	Admin triggers update	All users	Push + in-app banner	LOW

2.1 User Notification Preferences
•	Per-type toggle — each user can mute specific notification types (e.g. study material uploads) without affecting urgent alerts.
•	Quiet hours — user sets a Do Not Disturb window (e.g. 10pm–7am). Non-urgent notifications are queued and delivered in the morning.
•	Email digest — user chooses daily or weekly email digest instead of individual push notifications for low-priority types.

 Chapter 3: System Architecture
3.1 Real-Time Delivery Pipeline
Event triggers in backend  →  NotificationService  →  Save to DB  →  Emit via WS  →  Send FCM push
App opens  →  WS connect with JWT  →  Join user room  →  Receive live events

3.2 Backend Components
NotificationService (Central Hub)
The single most important design decision is the NotificationService — one service called by every module. No notification logic is duplicated across controllers.
•	File: services/notificationService.js
•	Single exported function: createAndSend(type, userId, title, body, data)
•	Internally handles: DB insert → WS emit → FCM send → preference check
•	Called by: attendance, marks, fees, assignments, chat, homework, timetable, exam, leave modules

Socket.io Server
•	Install: npm install socket.io
•	JWT authentication middleware runs on every WS connection handshake
•	Each authenticated user joins a private room: socket.join(`user_${userId}`)
•	Scales to multiple Node.js instances via Redis adapter (socket.io-adapter-redis)
•	Emitting to a user: io.to(`user_${userId}`).emit('notification', payload)

CRON Jobs (node-cron)
•	Daily 9:00 AM — fee due reminder: scan fees table for dues within 3 days
•	Daily 8:00 PM — low attendance alert: scan attendance, find students below 75%
•	Daily 7:00 AM — flush DND queue: deliver notifications held during quiet hours
•	Weekly Sunday 8:00 AM — send email digest to users who opted in

Bull Queue (for bulk operations)
Required for announcements to 500+ students. Chunked FCM multicast (500 per batch). Prevents HTTP timeout on large institutes. Redis-backed.
•	Install: npm install bull
•	Queue: announcement-queue — processes in background
•	Each job receives: { instituteId, type, title, body, recipientIds[] }
•	Worker splits recipientIds into chunks of 500, sends FCM multicast per chunk

3.3 Frontend Architecture
Web (React) — NotificationContext
•	Uses socket.io-client connected on user login
•	On 'notification' WS event: update React Query cache + show toast
•	Badge count maintained in Zustand state, incremented by WS events
•	On reconnect (tab focus / network return): refetch unread count from API

Mobile (Capacitor) — Push Notifications
•	Install: npm install @capacitor/push-notifications
•	On app start: request permission → get FCM token → POST /api/device/register
•	PushNotifications.addListener handles: foreground, background, and tap events
•	Tap event reads data.route from FCM payload and navigates to correct screen
•	iOS requires APNs certificate configured in Firebase project
•	Android requires google-services.json in android/app/ directory

Chat Notification — Special Handling
•	Message sent → check if recipient WS room is occupied (user online)
•	If ONLINE: deliver via WebSocket only — no FCM needed
•	If OFFLINE: send WebSocket (queued) + FCM push — 'New message from Mr. Sharma'
•	On chat screen open: emit 'messages_read' WS event → clears badge count

 Chapter 4: Database Design
4.1 Core Tables
Table: notifications
Column	Type	Description
id	INT PK AUTO_INCREMENT	Primary key
institute_id	INT FK NOT NULL	Multi-tenant isolation — always required
user_id	INT FK NOT NULL	Recipient user
type	VARCHAR(60)	e.g. ATTENDANCE_ABSENT, MARKS_PUBLISHED, FEE_DUE
title	VARCHAR(200)	Short notification title
body	TEXT	Full notification message body
data_json	JSON	Extra context: { route, entityId, entityType }
is_read	BOOLEAN DEFAULT FALSE	Read/unread state
archived_at	DATETIME NULL	Soft-delete: auto-set after 90 days
created_at	DATETIME	Timestamp of creation

Table: device_tokens
Column	Type	Description
id	INT PK AUTO_INCREMENT	Primary key
user_id	INT FK NOT NULL	Owner of the device
fcm_token	TEXT NOT NULL	Firebase Cloud Messaging token
platform	ENUM('android','ios','web')	Device platform
is_active	BOOLEAN DEFAULT TRUE	Set to false on FCM token invalidation
last_seen	DATETIME	Updated on every app open — used to clean stale tokens

Table: notification_prefs
Column	Type	Description
user_id	INT FK	User whose preference this is
type	VARCHAR(60)	Notification type enum value
push_enabled	BOOLEAN DEFAULT TRUE	Allow push for this type
email_enabled	BOOLEAN DEFAULT FALSE	Allow email for this type
quiet_start	TIME NULL	DND window start e.g. 22:00:00
quiet_end	TIME NULL	DND window end e.g. 07:00:00

Table: chat_messages
Column	Type	Description
id	INT PK AUTO_INCREMENT	Primary key
institute_id	INT FK NOT NULL	Multi-tenant isolation
from_user_id	INT FK	Sender
to_user_id	INT FK	Recipient
message	TEXT	Chat message content
is_read	BOOLEAN DEFAULT FALSE	Read status
created_at	DATETIME	Message timestamp

4.2 Critical Database Indexes
Table	Index Columns	Why This Index Matters
notifications	(user_id, is_read, created_at DESC)	Load user's unread count + latest notifications in one query
notifications	(institute_id, type, created_at)	Admin analytics — bulk type queries per institute
device_tokens	(user_id, is_active)	Find all active FCM tokens for a user instantly
chat_messages	(to_user_id, is_read)	Unread chat badge count query
notification_prefs	(user_id, type)	Check user preference before sending every notification

Auto-archive policy: notifications older than 90 days are soft-deleted (archived_at set). This keeps the notifications table lean and fast. Users can still access archived notifications on a dedicated archive screen.

4.3 REST API Endpoints
Method	Endpoint	Purpose
GET	/api/notifications?page=1&limit=20	Paginated list — cursor-based (not offset) for performance
GET	/api/notifications/unread-count	Badge count only — ultra-lightweight single integer response
PATCH	/api/notifications/mark-read	Bulk mark read — body: { ids: [...] } or { all: true }
DELETE	/api/notifications/:id	Soft delete — sets archived_at, does not hard delete
POST	/api/device/register	Save FCM token after app launch. Updates if token changes.
GET	/api/notification-prefs	Load all notification preferences for the current user
PUT	/api/notification-prefs	Bulk save preferences — one request for all type settings

 Chapter 5: Implementation Phases
Five sequential phases, each delivering working value. Each phase builds on the previous.

Phase 1  Database + NotificationService Foundation   (Week 1)
Backend Tasks
•	Create 4 tables: notifications, device_tokens, notification_prefs, chat_messages
•	Add all critical indexes listed in Chapter 4
•	Create services/notificationService.js — single function createAndSend(type, userId, title, body, data)
•	Implement all 7 REST API endpoints from Chapter 4.3
•	Secure all endpoints with existing JWT authentication middleware
After Phase 1: notifications are saved to DB and retrievable via REST API. No real-time delivery yet, but the complete data model is in place.

Phase 2  WebSocket Real-Time (In-App)   (Week 1–2)
Backend Tasks
•	npm install socket.io
•	Add JWT auth middleware on Socket.io connection handshake
•	Each authenticated user joins room: socket.join(`user_${userId}`)
•	In NotificationService: after DB insert, call io.to(`user_${userId}`).emit('notification', payload)
•	Expose io instance from server.js so NotificationService can use it
Frontend Tasks
•	npm install socket.io-client
•	Create NotificationContext.jsx — connects on login, disconnects on logout
•	On 'notification' WS event: update React Query cache + trigger toast
•	Build notification bell UI — badge, dropdown list, mark all read
After Phase 2: all users get real-time in-app notifications while the browser or app is open. Zero polling, instant delivery via WebSocket.

Phase 3  FCM Push Notifications (Mobile + Web)   (Week 2–3)
Firebase Setup
•	Create Firebase project at console.firebase.google.com
•	Download google-services.json → place in android/app/
•	Download GoogleService-Info.plist → place in ios/App/App/
•	Enable Cloud Messaging in Firebase project settings
Backend Tasks
•	npm install firebase-admin
•	Initialize Firebase Admin SDK with service account credentials
•	In NotificationService: after WS emit, fetch active device_tokens for user_id
•	Call admin.messaging().sendEachForMulticast({ tokens, notification, data })
•	On FCM error code 'registration-token-not-registered': set token is_active = false
Mobile Tasks
•	npm install @capacitor/push-notifications
•	Request push permission on first app launch
•	Register FCM token: PushNotifications.register()
•	Save token: POST /api/device/register with fcm_token and platform
•	Handle tap: PushNotifications.addListener('pushNotificationActionPerformed', navigate to data.route)
IMPORTANT: Test FCM on real physical devices only. iOS simulators and Android emulators do not reliably receive push notifications.

Phase 4  Module Integration — Wire All Triggers   (Week 3–4)
Add NotificationService call to each existing module
Module	What to add
Attendance	After bulk save: loop absent students, call NotificationService for student + linked parent. One call per student, not per class.
Marks/Results	When faculty publishes: notify all students in class + their parents. Use Bull queue if class > 50 students.
Fee / Razorpay	Razorpay webhook → payment_success and payment_failed events → NotificationService. Daily CRON for overdue.
Assignment	On create: notify all class students. On submission: notify faculty. On grade: notify submitting student.
Homework	On create: notify all students in class with due date in notification body.
Announcement	Admin posts → Bull queue job → chunked FCM multicast (500 recipients per batch). Prevents API timeout.
Chat	Message sent → check WS room → if online: WS only. If offline: WS + FCM push.
Timetable	On update: find affected faculty and students, send Push + WS with changed period details.
Exam	On schedule creation: notify all students in class + assigned faculty via Push + WS + Email.
Leave	On admin approve/reject: notify requesting student with reason via Push + WS.

Phase 5  CRON Jobs, Preferences UI & Email Digests   (Week 4–5)
CRON Jobs (node-cron)
•	Daily 9:00 AM — fee due reminder: SELECT fees WHERE due_date = TODAY + 3 AND paid = false
•	Daily 8:00 PM — low attendance: SELECT students WHERE attendance_percent < 75
•	Daily 7:00 AM — DND queue flush: deliver held notifications where quiet_end has passed
•	Weekly Sunday 8:00 AM — email digest: aggregate unread notifications, send formatted HTML email
Notification Preferences Screen (all 3 dashboards)
•	Per-type toggle: show each notification type with on/off switch
•	Quiet hours: time picker for DND start and end (stored in notification_prefs)
•	Email digest: choose None, Daily, or Weekly frequency
•	Preferences saved via single PUT /api/notification-prefs — bulk update, one API call
Email Templates (Nodemailer)
•	Fee reminder email: student name, amount due, due date, payment link
•	Result published email: subject-wise marks table, total, grade
•	Weekly digest email: summary of all unread notifications grouped by type
•	Use Handlebars (.hbs) for HTML template rendering

 Chapter 6: Performance & Optimization
6.1 Performance Targets
Metric	Target	How Achieved
WebSocket delivery time	< 50ms	Direct socket emit, no polling, no intermediate queue for 1-to-1
FCM push delivery	< 2 seconds	Google FCM SLA. Backend sends within 100ms of event.
API calls on app open	1 call	Unread count only. List loaded lazily when bell clicked.
Mark-read response	0ms perceived	Optimistic update — UI instant, API call fires in background
Bulk announcement (500)	< 3 seconds	Bull queue + FCM multicast 500/batch, non-blocking

6.2 Minimum API Calls Strategy
•	WS events update React Query cache directly — no extra API call to refresh notification list
•	Badge count maintained in Zustand client state, incremented by WS events, only fetched on page load
•	Cursor-based pagination (not offset) — fetch 20 at a time, infinite scroll loads next 20 on demand
•	FCM data payload kept small (< 1KB) — only id, type, route in payload. Full details from cache.
•	Mark all read uses single PATCH { all: true } — not N individual PATCH calls
•	Preferences saved as one bulk PUT — not one request per notification type

6.3 Responsive UI — All Screen Sizes
Screen Size	Notification UI Behavior
Mobile app (Capacitor)	Bottom sheet notification panel. Swipe down to dismiss. Native push via FCM. Safe area inset padding.
Tablet (web)	Side panel notification drawer — 320px wide. Opens on bell click. Does not overlay main content.
Laptop / PC (web)	Top-right dropdown panel + toast notifications top-right corner. Browser push via Firebase Web SDK.

6.4 Fast CRUD Operations
•	Optimistic mark-read: UI marks notification read instantly on click. API call fires async in background. Silent retry on failure.
•	Bulk delete: clear all or clear older than 30 days — single PATCH with WHERE clause, not N individual DELETEs.
•	Offline resilience: on network reconnect, Socket.io auto-reconnects and re-joins user room. React Query refetches unread count.
•	Database connection pooling: Sequelize pool configured (max: 10, min: 2) to handle concurrent notification bursts.

6.5 Scalability Considerations
•	Redis adapter for Socket.io: when running multiple Node.js instances (load balanced), Redis pub/sub ensures WS events reach the correct instance where the user is connected.
•	FCM multicast batching: FCM sendEachForMulticast accepts max 500 tokens per call. Bull queue handles splitting automatically.
•	Database archiving: automatic 90-day soft delete via scheduled CRON keeps notifications table under 1 million rows per institute.
•	Token cleanup: weekly CRON removes device_tokens where is_active = false or last_seen > 90 days ago.

 Chapter 7: Capacitor Mobile App — Notification Specifics
7.1 UI Isolation
The mobile notification UI is completely isolated from the website UI. All mobile notification components live in src/mobile/components/notifications/ and use CSS Modules. Website UI changes never affect mobile.

7.2 Three Dashboard Notification Panels
Faculty Dashboard
•	Bottom tab bar — bell icon with badge count in tab bar
•	Notification types shown: assignment submissions, parent messages, timetable changes, admin announcements
•	Quick action from notification: tap attendance absent alert → opens attendance correction screen

Student Dashboard
•	Bell icon in top header with animated badge
•	Notification types shown: marks published, assignment posted, homework, fee due, exam schedule
•	Quick action: tap marks notification → opens result detail screen
•	Low attendance warning shown as persistent banner on home screen if below 75%

Parent Dashboard
•	Prominent notification center — parents are the most notification-sensitive role
•	Absent child notification shown as high-visibility alert card at top of home screen
•	Fee overdue shown as red banner with Pay Now button
•	Multi-child support: notifications labeled with child name if parent has 2+ children

7.3 Notification Tap Navigation
Notification Type	Navigate To
Attendance absent	/student/attendance or /parent/child/:id/attendance
Marks published	/student/results/:examId or /parent/child/:id/results
Assignment posted	/student/assignments/:id
Fee due	/student/fees or /parent/fees
Chat message	/chat/:conversationId
Announcement	/announcements/:id
Assignment graded	/student/assignments/:id/submission

 Chapter 8: Security
•	JWT auth on every WS connection handshake — unauthenticated connections rejected immediately
•	institute_id always verified in NotificationService — prevents cross-tenant notification leaks
•	FCM tokens stored per user — a faculty member cannot receive student notifications
•	Role check in NotificationService — type-to-role validation ensures ATTENDANCE_ABSENT only goes to students and parents
•	Rate limiting on /api/notifications endpoints — prevents notification spam via API
•	FCM token rotation — when Firebase returns invalid-registration-token, mark is_active = false immediately
•	HTTPS only for all API communication — FCM tokens and JWT never sent over plain HTTP
•	Notification content sanitized before storage — XSS prevention for title and body fields

 Chapter 9: Technology Stack Summary
Technology	Package / Version	Role in Notification System
Socket.io	npm: socket.io	WebSocket server — real-time in-app delivery
socket.io-client	npm: socket.io-client	React frontend WebSocket connection
Firebase Admin SDK	npm: firebase-admin	Send FCM push notifications from Node.js backend
@capacitor/push-notifications	Capacitor plugin	Receive FCM push on Android + iOS
Bull	npm: bull	Redis-backed queue for bulk announcements
node-cron	npm: node-cron	Scheduled fee reminders and attendance alerts
Nodemailer	npm: nodemailer	Email delivery for digests and fee reminders
Handlebars	npm: handlebars	HTML email templates
React Query	npm: @tanstack/react-query	Frontend cache — updated by WS events
Zustand	npm: zustand	Badge count + notification UI state
MySQL + Sequelize	Existing in project	Persistent notification storage

ZenithFlows · Institute Management System · Notification System Implementation Guide
