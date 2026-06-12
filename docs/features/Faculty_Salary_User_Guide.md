# Faculty Salary Management — Complete User Guide

Welcome to the Faculty Salary Management guide. This document explains how to use the payroll system from basic configuration to advanced reporting, ensuring a smooth monthly salary cycle for your institute.

---

## 1. Basic Level: Setting Up Faculty Salary Profiles

Before you process any salaries, you need to configure the baseline salary settings for each faculty member. You only need to do this **once** per faculty member.

**Where to go:**
`Admin Dashboard` > `Faculty Salary Settings`

**How to Add/Update Setup:**
1. Select a **Faculty Member** from the list.
2. Enter their **Basic Salary** (e.g., ₹25,000).
3. Add any fixed monthly **Allowances** (e.g., ₹500).
4. Define the **Salary Due Day** (e.g., the 5th of every month).
5. Set the **Default Working Days** (usually 26 days).
6. Save the settings. 

> [!TIP]
> Setting this up allows the system to automatically generate pending salaries on the 1st of every month without manual intervention!

---

## 2. Intermediate Level: Monthly Salary Generation

There are two ways salary records are created:

### A. Automatic Generation (Recommended)
You don't need to do anything! On the **1st of every month at 00:01 AM**, the system runs an automatic background job. It reads the settings you configured in Step 1 and creates a **Pending** salary record for all active faculty members.

### B. Manual Generation
If you hired a faculty member mid-month or need to create an off-cycle salary:
**Where to go:** `Admin Dashboard` > `Faculty Salary Management` > `Add Salary`
1. Select the Faculty and the Month/Year.
2. Enter the working days and present days.
3. The system will **automatically calculate the Pro-Rata salary** if present days are less than working days.
4. Add any one-off deductions or advance paid.
5. Save the record. It will appear as **Pending**.

---

## 3. Advanced Level: Paying Salaries & Adjustments

When the payment due date arrives, it's time to mark the salaries as paid.

**Where to go:**
`Admin Dashboard` > `Faculty Salary Management`

**How to Process Payments:**
1. Filter the list by **Status: Pending**.
2. If a faculty member took unpaid leaves, click **Edit** to adjust their `Present Days` or add `Deductions`. The Net Salary will automatically recalculate.
3. Click the **Pay** button.
4. Enter the **Payment Method** (Cash, UPI, Bank Transfer).
5. Enter the **Transaction Reference** (optional).
6. Confirm payment. The status will securely lock to **Paid** and cannot be modified further.

---

## 4. Generating Salary Slips

Once a salary is marked as Paid, a legally compliant PDF Salary Slip is instantly available.

**Where to go:** `Admin Dashboard` > `Faculty Salary Management`
- Locate any **Paid** salary record.
- Click **Download Slip**.
- The generated PDF will flawlessly display Pro-Rata basic salary, allowances, deductions, and the final Net Salary box.

---

## 5. Dashboards and Visibility

The Faculty Salary feature is deeply integrated into the system, offering different views based on user roles.

### Admin & Manager Dashboards
- **Main Salary Dashboard:** Displays a complete list of all salaries with advanced filters (by Month, Faculty, Status).
- **Salary Reports / Analytics:** Shows aggregated data for a selected month, including:
  - Total Payroll Amount
  - Total Amount Paid vs. Pending
  - Number of Overdue Payments (if today's date has passed the Salary Due Day)

### Faculty Dashboard
- **My Slips Portal:** Faculty members have their own secure page.
- **Visibility:** They can **only** see their own salary records, and **only** those that are marked as `Paid`.
- **Self-Service:** Faculty can independently download their PDF salary slips without needing to contact the admin.

> [!IMPORTANT]  
> Managers require the specific `salary.read` and `salary.write` RBAC (Role-Based Access Control) permissions to view or process salaries in the Admin dashboard.
