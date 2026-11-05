# ALRM — Absenteeism, Late Report, and Excuse Letter Management System

A web-based Absence/Tardiness Monitoring and Approval System for **La Verdad Christian College, Inc.**, replacing the current manual, form-by-form routing done through Google Forms, spreadsheets, and Viber.

> ALRM does not change *who* decides on attendance validity — Instructors and Program Heads keep that authority. ALRM's job is to **route requests automatically, track status in real time, and flag bottlenecks** before they turn into overlooked cases or compliance violations.

---

## 📋 Table of Contents
- [ALRM — Absenteeism, Late Report, and Excuse Letter Management System](#alrm--absenteeism-late-report-and-excuse-letter-management-system)
  - [📋 Table of Contents](#-table-of-contents)
  - [Overview](#overview)
    - [Email Domains](#email-domains)
  - [Tech Stack](#tech-stack)
  - [Deployment Architecture](#deployment-architecture)
  - [User Roles](#user-roles)
  - [Getting Started](#getting-started)
    - [Backend (Laravel)](#backend-laravel)
    - [Frontend (React)](#frontend-react)
  - [Project Structure](#project-structure)
  - [Implementation Phases (To-Do)](#implementation-phases-to-do)
    - [Phase 1 — Backend Foundation](#phase-1--backend-foundation)
    - [Phase 2 — Frontend Core](#phase-2--frontend-core)
    - [Phase 3 — Notifications \& Reporting](#phase-3--notifications--reporting)
    - [Phase 4 — Polish \& Deploy](#phase-4--polish--deploy)
    - [Phase 5 — Optional Enhancements (post-presentation)](#phase-5--optional-enhancements-post-presentation)
  - [Environment Variables](#environment-variables)

---

## Overview

| | |
|---|---|
| **Problem** | Manual, one-by-one routing (College Secretary → Instructor via Viber) causes delays, no visibility into who's responded, and no early warning as a student's absence/late count climbs. |
| **Solution** | Auto-route excuse/late requests to the correct instructor based on schedule, give every role a real-time dashboard, and auto-flag stale requests for follow-up. |
| **Core policy logic** | 3 lates = 1 absence · alerts fire at 2 absences (warning) and 3 absences (IR/minor offense) |

### Email Domains

| User type | Domain | Role |
|---|---|---|
| Student | `@student.laverdad.edu.ph` | `student` |
| Faculty / Staff | `@laverdad.edu.ph` | `instructor` by default; Admin can assign `program_head` / `administrator` |

Login uses Google SSO. Verified accounts in either official institutional domain are automatically `approved`, including returning institutional accounts still marked `pending`. New students receive the `student` role and new staff receive `instructor`; pre-registered roles are preserved, and Admin can reassign staff roles. Deactivated accounts stay blocked.

Verified Google accounts outside both exact domains enter as `pending` with the default `student` role. They can complete OTP verification, but role routes remain blocked until an Administrator reviews and approves them. Admin can assign the appropriate role while the external account is pending. Google OAuth audience settings must allow external users for this flow to reach ALRM; an Internal-only Google app blocks them before the callback.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | **React JS** |
| Backend / API | **Laravel** |
| Database | **MySQL** |
| Styling | Tailwind CSS *(or your chosen UI library)* |
| Frontend hosting | Vercel |
| Backend hosting | Render |
| Database hosting | Railway / Aiven / Clever Cloud *(free MySQL — Render free tier has no persistent disk)* |

> Stack is **fixed** per the course's Technical Requirements Guide: React JS + Laravel, frontend and backend must be separate deployed applications communicating over REST.

---

## Deployment Architecture

```mermaid
flowchart TB
    classDef frontend fill:#6366f1,stroke:#4338ca,color:#fff
    classDef backend fill:#0ea5e9,stroke:#0284c7,color:#fff
    classDef external fill:#f59e0b,stroke:#d97706,color:#fff

    subgraph FE["Frontend — Vercel (React JS)"]
        Student["Student Portal"]
        Instructor["Instructor Dashboard"]
        ProgHead["Program Head Dashboard"]
        Admin["Admin Dashboard"]
    end

    subgraph BE["Backend — Laravel REST API (Render)"]
        route["API Router"]
        authCtrl["Auth Controller"]
        reqCtrl["Request Controller"]
        notifCtrl["Notification Controller"]
        job["Scheduled Job — flagging + threshold checks"]
    end

    subgraph DB["Database"]
        mysql["MySQL — Railway / Aiven / Clever Cloud"]
    end

    Student & Instructor & ProgHead & Admin -->|HTTP / JSON| route
    route --> authCtrl
    route --> reqCtrl
    route --> notifCtrl
    job --> notifCtrl

    authCtrl & reqCtrl & notifCtrl & job -->|MySQL| mysql

    class Student,Instructor,ProgHead,Admin frontend
    class route,authCtrl,reqCtrl,notifCtrl,job backend
    class mysql external
```

**Request flow (happy path):**
`Student submits request` → `Laravel auto-resolves instructor via class schedule` → `Instructor approves/notes/invalids` → `Dashboard updates in real time` → `If unanswered past deadline → auto-flagged to Program Head` → `Email + in-app notification fires at every step`

---

## User Roles

| Role | Can do |
|---|---|
| **Student** | Log in (Using LVCC Email) · submit excuse/late requests · upload evidence · track own status & threshold history |
| **Instructor** | Review requests for own classes · approve / note / invalid · manually log attendance · view class-level dashboard |
| **Program Head** | View program-wide (all instructors/sections) · monitor flagged students · receive auto-escalated requests |
| **Administrator** | College-wide visibility · assign staff roles (Instructor/Program Head/Admin) · manage programs/subjects/schedules · export reports |

---

## Getting Started

### Backend (Laravel)
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
# set DB_* values in .env
php artisan migrate --seed
php artisan serve
```

### Frontend (React)
```bash
cd frontend
npm install
# set VITE_API_URL (or REACT_APP_API_URL) to point to your Laravel API
npm run dev
```

---

## Project Structure

```
alrm/
├── backend/                 # Laravel API
│   ├── app/Http/Controllers/
│   ├── app/Models/
│   ├── database/migrations/
│   ├── database/seeders/
│   └── routes/api.php
└── frontend/                # React JS
    ├── src/pages/
    │   ├── student/
    │   ├── instructor/
    │   ├── program-head/
    │   └── admin/
    ├── src/components/
    └── src/api/
```

---

## Implementation Phases (To-Do)

### Phase 1 — Backend Foundation
- [ ] Migrations: `user`, `programs`, `classes`, `enrollments`, `attendance_tracker`, `requests`, `followup_flags`, `notifications`, `audit_log`
- [ ] Eloquent models + relationships
- [ ] Role-based auth (Google SSO + email domain validation + staff-only role assignment + middleware guards)
- [ ] Auto-routing logic: excuse request → correct instructor via schedule lookup
- [ ] Threshold engine: 3 lates → 1 absence, 2/3-absence count triggers
- [ ] Scheduled job for follow-up flagging (unanswered requests past deadline)
- [ ] Seed database with **real** LVCC programs/subjects/accounts — no placeholder/test data

### Phase 2 — Frontend Core
- [ ] Login using SSO via Google Workspace (`@student.laverdad.edu.ph`)
- [ ] Student: submit request form, request history, threshold tracker
- [ ] Instructor: pending requests list, decision actions, class dashboard
- [ ] Program Head: aggregated program dashboard, flagged-students view
- [ ] Admin: staff role-assignment queue (staff-only — students never appear here), CRUD for programs/subjects/schedules, dashboard

### Phase 3 — Notifications & Reporting
- [ ] Email notifications (e.g., new request)
- [ ] In-app notification bell/list
- [ ] Exportable reports (PDF/Excel) for accreditation
- [ ] Audit trail viewer (admin-facing)

### Phase 4 — Polish & Deploy
- [ ] Form validation + error states (frontend & backend)
- [ ] Loading/empty states across all dashboards
- [ ] Deploy backend → Render, frontend → Vercel, DB → Railway/Aiven/Clever Cloud
- [ ] End-to-end test on deployed URLs with real seeded data
- [ ] Mobile browser test (student flow)
- [ ] Confirm login/test credentials are ready for evaluators

### Phase 5 — Optional Enhancements (post-presentation)
- [ ] SMS/Viber as an additional notification channel
- [ ] Full multi-role account support (`user_roles` pivot table, any role combination) — the common Instructor+Program Head case is already handled via a `program_head_id` secondary check, so this is only for other combinations
- [ ] Term-over-term analytics/trend charts

---

## Environment Variables

**Backend (`.env`)**
```
DB_CONNECTION=mysql
DB_HOST=
DB_PORT=
DB_DATABASE=alrm
DB_USERNAME=
DB_PASSWORD=
MAIL_MAILER=smtp
MAIL_HOST=
MAIL_USERNAME=
MAIL_PASSWORD=
```

**Frontend (`.env`)**
```
VITE_API_URL=https://your-laravel-api.onrender.com/api
```