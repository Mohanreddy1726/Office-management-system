# OfficeFlow — Production Office Management & HRMS

**OfficeFlow** is an enterprise-grade Office Management System (OMS) and HRMS built for modern office operations with **Next.js**, **Node.js**, and **MongoDB**.

Tailored specifically for Indian small-to-midsize businesses, this deployment operates in **Single Office Mode (Headquarters)** while maintaining a database schema that is 100% future-proof for multi-branch expansion without migrations.

---

## 🛠️ Technology Stack

* **Framework:** Next.js 14 (App Router) + React 18 + TypeScript
* **Styling & UI:** Tailwind CSS, Radix UI primitives, Lucide Icons, Sonner Toasts
* **Backend Runtime:** Node.js Route Handlers & Server Components
* **Database & ODM:** MongoDB with Mongoose (Indexed Schemas, Data Validation)
* **Authentication:** Stateless JWT stored in secure `HttpOnly` cookies (`jose`, `bcryptjs`)
* **Indian Statutory Compliance:** INR Currency (₹), April FY cycle, GSTIN, EPF 12%, Professional Tax (PT), and TDS deductions

---

## 🚀 Getting Started

### 1. Environment Configuration
Verify your `.env.local` settings:
```env
# MongoDB Connection String (Local MongoDB or MongoDB Atlas)
MONGODB_URI=mongodb://localhost:27017/officeflow

# JWT Authentication Secret
JWT_SECRET=super_secret_officeflow_production_key_change_me_in_prod_998877

# Application Metadata
NEXT_PUBLIC_APP_NAME=OfficeFlow
NEXT_PUBLIC_COMPANY_NAME=Acme Technologies India Pvt Ltd
DEFAULT_BRANCH=Headquarters
NODE_ENV=development
```

### 2. Populate Demo Data (Optional)
Run the automated seed script to populate realistic accounts, employees, attendance records, biometric devices, assets, and announcements:
```bash
npm run seed
```

*(You can also click **"Reset Database to Fresh Demo State"** anytime inside the `/admin` portal!)*

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Production Build
```bash
npm run build
npm start
```

---

## 👥 Default Demo Accounts

All pre-seeded demo accounts use password: `password123`

| Role | Name | Email | Focus Area |
| :--- | :--- | :--- | :--- |
| **Super Admin** | Vikram Desai | `vikram.desai@officeflow.example` | System administration, company settings, database reset |
| **HR Admin** | Ananya Sharma | `ananya.sharma@officeflow.example` | Employee directory, leave approvals, payroll runs, documents |
| **Manager** | Rahul Verma | `rahul.verma@officeflow.example` | Team attendance regularization approvals, team leaves |
| **Employee** | Karthik Reddy | `karthik.reddy@officeflow.example` | Self-service clock in/out, view payslips, apply for leave |

*(Note: The login page includes a **One-Click Demo Access** panel so you can log in as any role with a single click).*

---

## 📦 Functional Modules

1. **Dashboard (`/dashboard`):** Real-time office attendance health, KPI cards, pending approval queues, announcements, and a **Live Self-Service Punch In/Out Clock**.
2. **Employees (`/employees`):** Searchable directory with department filters, status badges (*Active, Probation, Notice, Inactive*), CTC, and a modal to onboard new employees.
3. **Attendance (`/attendance`):** Daily register, punch in/out timestamps, 4-stage confirmation pipeline (*Awaiting Employee $\rightarrow$ Awaiting Manager $\rightarrow$ Awaiting HR $\rightarrow$ Confirmed*), and attendance regularization requests.
4. **Biometric Integration (`/biometric`):** Hardware punch terminals status (*Online/Offline*, IP address) and Biometric ID $\leftrightarrow$ Employee profile mappings.
5. **Leave Management (`/leave`):** Casual Leave (CL), Sick Leave (SL), and Earned Leave (EL) balances, leave application form, and multi-tier manager/HR approval pipeline.
6. **Payroll Processing (`/payroll`):** Monthly Payroll Runs with automated Indian statutory deductions (EPF 12%, PT ₹200, TDS), net disbursement calculation, and official printable payslip view.
7. **Document Repository (`/documents`):** Employee KYC vault (Aadhaar, PAN, certificates, offer letters) with HR verification and rejection workflows.
8. **Assets & Hardware (`/assets`):** Office hardware registry (Laptops, Monitors, Peripherals), serial number tracking, employee allocations, and returns.
9. **Mail & Courier Log (`/mail`):** Inward and Outward postal courier dispatch registry with auto-generated reference IDs (`IN-2026-0001`, `OUT-2026-0001`) and carrier tracking.
10. **Notifications (`/notifications`):** Company-wide announcements and alerts publishing.
11. **Audit Logs (`/audit-logs`):** Immutable compliance ledger capturing all system mutations with user, timestamp, module, and outcome.
12. **Administration (`/admin`):** Corporate entity setup, GSTIN registration, and one-click database demo restore.
