🏗 COMPLETE ZenithFlows SYSTEM – FULL PROJECT FLOW

I will explain everything in phases, step-by-step, technically.

🌍 PHASE 1 — PUBLIC WEBSITE (Marketing Layer)
🎯 Purpose

Allow institutes to:

Discover your product

Understand features

View plans

Register

🌐 Frontend Public Routes
/ (Landing Page)
/features
/pricing
/about
/contact
/login
/register

🔹 Landing Page

Shows:

Hero section

Key features

Pricing summary

“Start Free Trial” button

“View Plans” button

🔹 Pricing Page

Data loaded from:

GET /api/plans


Show dynamic plans from database.

When user clicks:

Choose Plan → Redirect to /register?plan_id=2

🧾 PHASE 2 — REGISTRATION FLOW
🎯 Goal

Institute registers and selects plan.

🔁 Complete Registration Flow
User clicks Choose Plan
      ↓
Register Page Opens
      ↓
Fill Form
      ↓
Backend Creates:
    - Institute
    - Admin User
    - Temporary Subscription (pending)
      ↓
Redirect to Payment

📝 Registration Form Fields
Institute Name
Email
Password
Phone
Address
Selected Plan ID

🗄 Database Changes
1️⃣ institutes

Create new record

status = "pending"

2️⃣ users

Create admin user

role = "admin"

3️⃣ subscriptions

Create record:

institute_id

plan_id

payment_status = "pending"

💳 PHASE 3 — PAYMENT FLOW

Using Razorpay.

🔁 Payment Flow
Frontend calls:
POST /api/payment/create-subscription
      ↓
Backend creates Razorpay subscription
      ↓
Frontend opens Razorpay checkout
      ↓
Payment success
      ↓
Webhook triggered
      ↓
Subscription updated to "paid"
      ↓
Institute status changed to "active"

🧠 Webhook Logic

When event = subscription.charged:

Update:

subscriptions.payment_status = "paid"
institutes.status = "active"
subscription_end = calculated date

🔐 PHASE 4 — LOGIN SYSTEM

After payment:

Institute visits:

/login

🔁 Login Flow
Enter Email + Password
      ↓
Backend verifies user
      ↓
Generate JWT
      ↓
Return token + role + institute_id
      ↓
Frontend stores token
      ↓
Redirect to dashboard

🧠 PHASE 5 — SUBSCRIPTION VALIDATION MIDDLEWARE

Every protected route must check:

1️⃣ JWT valid
2️⃣ Subscription active
3️⃣ Plan feature allowed

🔐 Middleware Execution Order
verifyToken
   ↓
checkSubscription
   ↓
checkPlanFeature
   ↓
Controller

🏢 PHASE 6 — INSTITUTE DASHBOARD STRUCTURE

After login:

/dashboard
    /students
    /faculty
    /classes
    /attendance
    /fees
    /exams
    /reports
    /settings

🔹 Based on Plan Features

Example Plan:

feature_attendance = true
feature_fees = false
feature_exams = false


Frontend:

Hide disabled modules

Backend:

if (!plan.feature_fees) {
   return res.status(403)
}

📊 PHASE 7 — MODULE EXECUTION FLOW

Example: Add Student

POST /api/students
    ↓
verifyToken
    ↓
checkSubscription
    ↓
checkStudentLimit
    ↓
StudentController.create
    ↓
Save with institute_id


Important:

Every table must contain:

institute_id


This makes it multi-tenant.

👑 PHASE 8 — SUPER ADMIN PANEL

Only role = super_admin

Routes:

/superadmin/dashboard
/superadmin/institutes
/superadmin/plans
/superadmin/subscriptions
/superadmin/revenue

Super Admin Can:

Create plans

Update plan price

Suspend institute

View revenue

See monthly analytics

🔄 PHASE 9 — SUBSCRIPTION LIFECYCLE

States:

Status	Meaning
pending	Registered but not paid
active	Paid and valid
expired	End date passed
suspended	Blocked manually
cancelled	User cancelled
🔁 Daily Cron Job

Every midnight:

Check end_date < today
      ↓
Set subscription.status = expired
      ↓
Set institute.status = expired

📄 PHASE 10 — INVOICE SYSTEM

When payment success:

Generate PDF
Save in uploads/invoices
Store path in subscription
Send email with invoice

📈 PHASE 11 — REVENUE SYSTEM

Revenue calculated from:

subscriptions.amount_paid
WHERE payment_status = "paid"


Super admin dashboard shows:

Total revenue

Monthly revenue

Active institutes

Expired institutes

🧠 PHASE 12 — SECURITY LAYER

Add:

JWT expiration

Rate limiting

Password hashing (bcrypt)

Input validation

CORS control

🌐 FINAL COMPLETE FLOW
Visitor opens website
      ↓
Views pricing
      ↓
Selects plan
      ↓
Registers
      ↓
Payment
      ↓
Subscription activated
      ↓
Login
      ↓
JWT generated
      ↓
Access dashboard
      ↓
Feature access based on plan
      ↓
Super admin monitors everything

🎯 FINAL ARCHITECTURE OVERVIEW
Frontend (React)
      ↓
Backend API (Node + Express)
      ↓
Middlewares
      ↓
Controllers
      ↓
Services
      ↓
Sequelize Models
      ↓
MySQL Database
      ↓
Razorpay Webhook

🏁 PROJECT STATUS SUMMARY

Your project must include:

✔ Public marketing pages
✔ Dynamic plans
✔ Registration
✔ Payment integration
✔ Subscription middleware
✔ Feature locking
✔ Multi-tenant design
✔ Super admin panel
✔ Revenue dashboard
✔ Invoice generation
✔ Email system
✔ Auto expiry