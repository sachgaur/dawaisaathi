# DawaiSathi — Project Presentation

> *"Your family's medicine companion, powered by AI"*

---

## 1. Problem Statement

Managing medicines for a family is hard.

- Prescriptions pile up on paper.
- Family members forget when and what to take.
- There is no shared view of everyone's medicine schedule.
- Medicines expire or run out without anyone noticing.

**DawaiSathi solves this for the entire family, from a single phone.**

---

## 2. What is DawaiSathi?

DawaiSathi is an **AI-powered family medicine management app** that:

- Scans prescription papers using your phone camera
- Automatically extracts medicine names using Google Gemini AI
- Stores medicines in a personal cabinet with a daily schedule
- Shares management across family members

---

## 3. Core Features

### AI Prescription Scanner
- Open the scanner and point your camera at a prescription paper
- Gemini Vision AI reads and extracts all medicine names from the image
- Supports multiple medicines from a single prescription
- Flash toggle for low-light environments

### Medicine Cabinet
- Every medicine is stored with its name, schedule time slots (Morning, Afternoon, Evening, Night), and an optional photo
- Cabinet is organized by time of day for easy daily reference
- Tap any photo in the cabinet to view it full-screen
- Medicines can be permanently deleted with all future reminders

### Daily Schedule
- Each medicine can be assigned to one or multiple time slots per day
- The schedule repeats every day
- The cabinet always shows today's full schedule at a glance

### Family Mode
- Create or join a family group using a family member's email
- Each family member has their own personal cabinet
- Switch between family member views from any screen
- Add medicines to any family member's cabinet after scanning

### Inbox and Requests
- Family join requests appear in the inbox for approval
- One-tap accept to add someone to your family

### Google Authentication
- Sign in with Google — no passwords to remember
- JWT-based session management for security

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Vanilla CSS (mobile-first, glassmorphism) |
| **Backend** | Python Flask |
| **Database** | SQLite (dev) / PostgreSQL (prod ready) |
| **AI / Vision** | Google Gemini 2.0 Flash |
| **Authentication** | Google OAuth 2.0 + JWT |
| **Camera** | react-webcam (hardware camera access) |

---

## 5. Architecture Overview

```
+-----------------------------+
|       React Frontend        |
|  (Vite, TypeScript, CSS)    |
|                             |
|  Pages: Cabinet, Scanner,   |
|  Family, Inbox, Approval    |
+-------------|---------------+
              |  REST API (JWT auth)
              v
+-----------------------------+
|      Flask Backend          |
|                             |
|  Routes: auth, medicine,    |
|  family, cabinet            |
+------|----------------------+
       |
  +----|------+
  |           |
  v           v
SQLite DB   Google Gemini API
(users,     (prescription
 meds,       extraction)
 family)
```

---

## 6. User Flow

```
1. User opens app > Google Sign In
2. Lands on Cabinet (today's schedule)
3. Taps Scan > Camera opens full-screen
4. Points at prescription > Taps capture
5. Gemini extracts medicine names
6. User reviews/edits each medicine + assigns time slots
7. Taps "Add to Cabinet" > Medicine saved
8. Cabinet shows all medicines for today by time slot
9. Family member can be switched > their cabinet loads
```

---

## 7. Key Design Decisions

### Mobile-First
The app is designed like a native mobile app — full-screen layout, bottom navigation, native camera access, no sidebars.

### No App Store Required
It is a Progressive Web App (PWA) — users can add it to their home screen directly from the browser.

### AI-First Scanning
Instead of typing medicine names manually, the AI reads the prescription. This is critical for users who may not be tech-savvy or struggle to type medical names correctly.

### Family-Centric
The family model treats medicine management as a shared responsibility — parents can manage children's medicines, adult children can manage elderly parents' medicines, all in one app.

---

## 8. What's Next (Future Scope)

- **Push notifications** — remind at each time slot (Morning, Evening, etc.)
- **Refill alerts** — track quantity and alert when running low
- **Medicine expiry tracking**
- **Prescription history** — archive scanned images permanently
- **Cloud database** — PostgreSQL on production
- **Regional language support** — Hindi, Bengali, Tamil prescription reading

---

## 9. Demo

**Live URL (dev tunnel):** `https://qflq30jf-5173.inc1.devtunnels.ms`

**GitHub:** `https://github.com/Project-eigen/version_1`

---

*Built for Project Eigen*
