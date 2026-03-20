# DawaiSathi — agents.md
# Technical Blueprint for Coding Agent — MVP Build

---

## 0. Context & Constraints

You are building **DawaiSathi** (दवाई साथी), a medication reminder web app for Indian households where multiple family caregivers manage medicine for a patient (typically elderly). The primary users have low digital literacy. They cannot read medicine labels. They rely on photos and colours, not text.

**You are building for a solopreneur.** Every architectural decision must optimise for:
- One person can build, deploy, and maintain it
- Minimal infrastructure cost (target: $0 at MVP, <$20/mo at 1000 users)
- No complex DevOps — single deploy target
- Progressive enhancement — works on ₹8,000 Android phones on Jio 4G

**Non-negotiable product constraints:**
- Must work as a PWA (installable from browser, no app store needed)
- Must work offline for viewing the schedule and marking doses
- Must support Hindi and English from day one (i18n-ready for more)
- All critical UI must be visual/icon-driven, not text-dependent
- Must support multiple family members sharing one patient's schedule

---

## 1. Tech Stack (Final — Do Not Deviate)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend** | Next.js 14+ (App Router) with TypeScript | SSR for first load speed on slow connections. App Router for layouts. |
| **UI Framework** | Tailwind CSS + Radix UI primitives | Utility-first for speed. Radix for accessible modals/dialogs without design overhead. |
| **PWA** | next-pwa (Serwist) | Service worker generation, offline caching, install prompt. |
| **State (client)** | Zustand + IndexedDB (via idb) | Zustand for UI state. IndexedDB for offline dose log and schedule cache. |
| **Backend** | Next.js API Routes (Route Handlers) | Co-located with frontend. No separate server to manage. |
| **Database** | Supabase (Postgres + Auth + Storage) | Free tier: 500MB DB, 1GB storage, 50K MAU auth. Handles photos, users, RLS. |
| **Auth** | Supabase Auth (OTP via SMS / Magic Link) | Indian users don't have email habits. SMS OTP is the primary flow. Magic link as fallback. |
| **File Storage** | Supabase Storage (S3-compatible) | Prescription photos and medicine strip photos. |
| **OCR / AI** | Google Cloud Vision API (prescription OCR) | Best Devanagari + handwriting OCR. Free tier: 1000 units/month. |
| **Notifications** | Web Push (via web-push npm) + Supabase Edge Functions for scheduling | No Firebase dependency. Edge Functions run cron for reminder timing. |
| **i18n** | next-intl | Lightweight, App Router compatible, supports Hindi script natively. |
| **Deployment** | Vercel (free tier) | Zero-config Next.js deploys. Free: 100GB bandwidth, serverless functions. |
| **Monorepo** | Single Next.js project (no monorepo) | Solopreneur. One repo, one deploy. Don't over-engineer. |

---

## 2. Project Structure

```
dawaisathi/
├── public/
│   ├── manifest.json            # PWA manifest
│   ├── icons/                   # App icons (192, 512, maskable)
│   ├── sw.js                    # Generated service worker
│   └── locales/
│       ├── en.json
│       └── hi.json
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout (i18n provider, auth provider, theme)
│   │   ├── page.tsx             # Landing / login
│   │   ├── [locale]/
│   │   │   ├── layout.tsx       # Locale-wrapped layout
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx     # Main schedule board (THE primary screen)
│   │   │   ├── setup/
│   │   │   │   ├── prescription/
│   │   │   │   │   └── page.tsx # Upload & process prescription photo
│   │   │   │   ├── medicines/
│   │   │   │   │   └── page.tsx # Photo each medicine strip + link to schedule
│   │   │   │   └── schedule/
│   │   │   │       └── page.tsx # Set timing (morning/afternoon/evening/night)
│   │   │   ├── history/
│   │   │   │   └── page.tsx     # Dose log with who gave what when
│   │   │   ├── family/
│   │   │   │   └── page.tsx     # Family member management + invite codes
│   │   │   └── settings/
│   │   │       └── page.tsx     # Language, notifications, patient profile
│   │   └── api/
│   │       ├── ocr/
│   │       │   └── route.ts     # Prescription OCR processing
│   │       ├── invite/
│   │       │   └── route.ts     # Generate/validate family invite codes
│   │       └── push/
│   │           └── route.ts     # Push subscription management
│   ├── components/
│   │   ├── ui/                  # Radix-based primitives (Button, Dialog, Toast, etc.)
│   │   ├── schedule/
│   │   │   ├── TimeSlotCard.tsx       # Morning/Afternoon/Evening/Night card
│   │   │   ├── MedicineChip.tsx       # Photo + dose count chip inside a time slot
│   │   │   ├── DoseCheckButton.tsx    # Big tap target to mark dose as given
│   │   │   └── ScheduleBoard.tsx      # Full day view — the hero component
│   │   ├── setup/
│   │   │   ├── CameraCapture.tsx      # Camera/gallery photo capture
│   │   │   ├── PrescriptionReview.tsx # OCR result editor — extracted medicines list
│   │   │   ├── MedicinePhotoLink.tsx  # Link a photo to a medicine entry
│   │   │   └── ScheduleWizard.tsx     # Step-by-step timing setup
│   │   ├── family/
│   │   │   ├── InviteCode.tsx         # Show/share 6-digit invite code
│   │   │   └── MemberList.tsx         # Family members with roles
│   │   └── shared/
│   │       ├── BottomNav.tsx          # Mobile bottom navigation (3-4 tabs)
│   │       ├── LangSwitcher.tsx       # Hi / En toggle
│   │       ├── OfflineBanner.tsx      # "You're offline — schedule still works"
│   │       └── PhotoThumbnail.tsx     # Lazy-loaded medicine photo with fallback
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts        # Browser Supabase client
│   │   │   ├── server.ts        # Server-side Supabase client
│   │   │   └── middleware.ts    # Auth middleware for protected routes
│   │   ├── ocr/
│   │   │   └── process.ts       # Google Vision API call + response parser
│   │   ├── offline/
│   │   │   ├── store.ts         # Zustand store definitions
│   │   │   ├── sync.ts          # IndexedDB ↔ Supabase sync logic
│   │   │   └── db.ts            # IndexedDB schema (idb wrapper)
│   │   ├── push/
│   │   │   └── subscribe.ts     # Push notification subscription logic
│   │   ├── i18n/
│   │   │   └── config.ts        # next-intl configuration
│   │   └── utils/
│   │       ├── time-slots.ts    # Morning/Afternoon/Evening/Night definitions
│   │       ├── invite-code.ts   # 6-digit code generation/validation
│   │       └── image.ts         # Client-side image compression before upload
│   ├── hooks/
│   │   ├── useSchedule.ts       # Fetch + cache today's schedule
│   │   ├── useOfflineSync.ts    # Background sync when online
│   │   ├── useDoseLog.ts        # Mark dose + optimistic update
│   │   └── useFamily.ts         # Family member context
│   └── types/
│       └── index.ts             # All TypeScript types (see Section 4)
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   ├── seed.sql                 # Demo data for development
│   └── functions/
│       └── send-reminders/
│           └── index.ts         # Edge Function: cron job for push notifications
├── .env.local.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 3. Database Schema (Supabase / Postgres)

Use Supabase migrations. Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- PATIENTS
-- A patient is the person receiving medicine.
-- One patient can have many caregivers (family members).
-- ============================================================
create table patients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  age integer,
  photo_url text,                          -- optional patient photo
  notes text,                              -- allergies, conditions, etc.
  invite_code char(6) unique not null,     -- 6-digit family join code
  created_at timestamptz default now(),
  created_by uuid references auth.users(id) not null
);

-- ============================================================
-- CAREGIVERS (family members linked to a patient)
-- ============================================================
create table caregivers (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  role text default 'member' check (role in ('admin', 'member')),
  display_name text not null,              -- "Bhabhi", "Raju", etc.
  created_at timestamptz default now(),
  unique(patient_id, user_id)
);

-- ============================================================
-- PRESCRIPTIONS
-- A photo of the doctor's prescription + OCR results.
-- ============================================================
create table prescriptions (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete cascade not null,
  photo_url text not null,                 -- Supabase Storage URL
  ocr_raw_text text,                       -- Raw OCR output
  doctor_name text,
  prescribed_date date,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id) not null
);

-- ============================================================
-- MEDICINES
-- Each medicine entry, linked to a prescription.
-- Has its own photo (the strip/bottle photo).
-- ============================================================
create table medicines (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete cascade not null,
  prescription_id uuid references prescriptions(id) on delete set null,
  name text not null,                      -- "Amlodipine 5mg" or even "गोल सफ़ेद गोली"
  photo_url text,                          -- Photo of the actual medicine strip
  colour_label text,                       -- User-assigned: "the big white one"
  dosage_unit text default 'tablet',       -- tablet, ml, drops, puff
  instructions text,                       -- "take with water", "after food"
  is_active boolean default true,
  created_at timestamptz default now(),
  sort_order integer default 0
);

-- ============================================================
-- SCHEDULE ENTRIES
-- Which medicine, what time slot, how many.
-- This is the core of the visual schedule board.
-- ============================================================
create type time_slot as enum ('morning', 'afternoon', 'evening', 'night');

create table schedule_entries (
  id uuid primary key default uuid_generate_v4(),
  medicine_id uuid references medicines(id) on delete cascade not null,
  patient_id uuid references patients(id) on delete cascade not null,
  time_slot time_slot not null,
  dose_count numeric(4,1) not null,        -- 1, 0.5, 2, etc.
  reminder_time time,                      -- Optional exact time for push notification
  start_date date default current_date,
  end_date date,                           -- null = ongoing
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(medicine_id, time_slot)           -- one entry per medicine per slot
);

-- ============================================================
-- DOSE LOG
-- The audit trail: who gave what, when.
-- This is what gets synced from offline.
-- ============================================================
create table dose_logs (
  id uuid primary key default uuid_generate_v4(),
  schedule_entry_id uuid references schedule_entries(id) on delete cascade not null,
  patient_id uuid references patients(id) on delete cascade not null,
  given_by uuid references auth.users(id),
  given_by_name text,                      -- Denormalized for display
  given_at timestamptz not null,
  status text default 'given' check (status in ('given', 'skipped', 'missed')),
  notes text,
  synced boolean default true,             -- false = created offline, pending sync
  created_at timestamptz default now()
);

-- ============================================================
-- PUSH SUBSCRIPTIONS
-- Web Push endpoints per user per device.
-- ============================================================
create table push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Users can only access data for patients they are caregivers of.
-- ============================================================
alter table patients enable row level security;
alter table caregivers enable row level security;
alter table prescriptions enable row level security;
alter table medicines enable row level security;
alter table schedule_entries enable row level security;
alter table dose_logs enable row level security;
alter table push_subscriptions enable row level security;

-- Helper function: get patient IDs the current user has access to
create or replace function my_patient_ids()
returns setof uuid as $$
  select patient_id from caregivers where user_id = auth.uid()
$$ language sql security definer stable;

-- Patients: read if caregiver, create if authenticated
create policy "Caregivers can view their patients"
  on patients for select using (id in (select my_patient_ids()));
create policy "Authenticated users can create patients"
  on patients for insert with check (auth.uid() = created_by);
create policy "Admins can update patients"
  on patients for update using (
    id in (select patient_id from caregivers where user_id = auth.uid() and role = 'admin')
  );

-- Caregivers: read/write if caregiver of same patient
create policy "Caregivers can view co-caregivers"
  on caregivers for select using (patient_id in (select my_patient_ids()));
create policy "Can join as caregiver"
  on caregivers for insert with check (user_id = auth.uid());

-- Apply similar pattern to all other tables
create policy "Caregivers can view prescriptions"
  on prescriptions for select using (patient_id in (select my_patient_ids()));
create policy "Caregivers can create prescriptions"
  on prescriptions for insert with check (patient_id in (select my_patient_ids()));

create policy "Caregivers can view medicines"
  on medicines for select using (patient_id in (select my_patient_ids()));
create policy "Caregivers can manage medicines"
  on medicines for insert with check (patient_id in (select my_patient_ids()));
create policy "Caregivers can update medicines"
  on medicines for update using (patient_id in (select my_patient_ids()));

create policy "Caregivers can view schedule"
  on schedule_entries for select using (patient_id in (select my_patient_ids()));
create policy "Caregivers can manage schedule"
  on schedule_entries for insert with check (patient_id in (select my_patient_ids()));
create policy "Caregivers can update schedule"
  on schedule_entries for update using (patient_id in (select my_patient_ids()));

create policy "Caregivers can view dose logs"
  on dose_logs for select using (patient_id in (select my_patient_ids()));
create policy "Caregivers can log doses"
  on dose_logs for insert with check (patient_id in (select my_patient_ids()));

create policy "Users manage own push subscriptions"
  on push_subscriptions for all using (user_id = auth.uid());

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_caregivers_user on caregivers(user_id);
create index idx_caregivers_patient on caregivers(patient_id);
create index idx_medicines_patient on medicines(patient_id);
create index idx_schedule_patient_active on schedule_entries(patient_id) where is_active = true;
create index idx_dose_logs_schedule_date on dose_logs(schedule_entry_id, given_at);
create index idx_patients_invite on patients(invite_code);
```

---

## 4. TypeScript Types

Create `src/types/index.ts` with types mirroring the DB schema. Use Supabase's generated types as the source of truth:

```bash
npx supabase gen types typescript --local > src/types/supabase.ts
```

Additionally, define app-level types:

```typescript
export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';
export type DoseStatus = 'given' | 'skipped' | 'missed';
export type CaregiverRole = 'admin' | 'member';

export interface ScheduleView {
  timeSlot: TimeSlot;
  label: string;          // "सुबह" / "Morning"
  icon: string;           // Emoji: 🌅 🌤️ 🌇 🌙
  colour: string;         // Tailwind class: bg-amber-100, bg-blue-100, etc.
  reminderTime: string;   // "08:00"
  medicines: MedicineWithDose[];
}

export interface MedicineWithDose {
  medicineId: string;
  name: string;
  photoUrl: string | null;
  colourLabel: string | null;
  doseCount: number;
  dosageUnit: string;
  instructions: string | null;
  scheduleEntryId: string;
  todayStatus: DoseStatus | null;  // null = not yet logged
  givenByName: string | null;
  givenAt: string | null;
}

export interface OfflineDoseEntry {
  id: string;             // Client-generated UUID
  scheduleEntryId: string;
  patientId: string;
  givenByName: string;
  givenAt: string;        // ISO timestamp
  status: DoseStatus;
  synced: boolean;
}
```

---

## 5. Core Screens — Detailed Specifications

### 5.1 Dashboard / Schedule Board (`/dashboard`) — THE HERO SCREEN

This is the screen 90% of users will see 90% of the time. It must be **perfect**.

**Layout:**
- Top: Patient name + small photo (if available) + date (today in Hindi/English)
- Body: 4 vertically stacked **TimeSlotCards** — Morning (🌅 amber), Afternoon (🌤️ blue), Evening (🌇 orange), Night (🌙 indigo)
- Each TimeSlotCard contains **MedicineChips** — horizontal scrollable row
- Each MedicineChip shows: medicine photo thumbnail (large, ~80x80px), dose count in BIG text ("2 गोली"), a prominent check button
- Bottom: Fixed BottomNav with 3 tabs: Schedule (home), History, Settings

**Interaction:**
- Tap the check button → opens confirmation sheet (bottom drawer):
  - Shows medicine photo large
  - "Mark [dose count] [medicine name] as given?"
  - Two buttons: "✅ Given" (green, large) and "⏭️ Skip" (grey, small)
  - On confirm: optimistic UI update, write to IndexedDB, sync to Supabase if online
- Already-given medicines show with a green checkmark overlay and greyed photo
- Skipped shows with a yellow skip icon
- Missed (past time slot, not marked) shows with a red alert pulse

**Colour coding is critical.** Each time slot has a distinct background colour. Medicine chips should be white cards floating on the coloured slot. The check button must be minimum 48x48px (Google's touch target guideline).

**Offline behaviour:**
- Schedule is cached in IndexedDB on every successful fetch
- If offline, render from IndexedDB cache
- Dose marking works offline — stored in IndexedDB with `synced: false`
- When back online, `useOfflineSync` hook pushes pending entries to Supabase
- Show `OfflineBanner` when navigator.onLine is false

### 5.2 Prescription Upload (`/setup/prescription`)

**Flow:**
1. Camera opens (prefer rear camera) via `<input type="file" accept="image/*" capture="environment">`
2. User photographs the prescription
3. Client-side compression (max 1200px wide, 80% JPEG quality) via canvas API
4. Upload to Supabase Storage → get URL
5. Send URL to `/api/ocr` route → Google Cloud Vision API
6. Display extracted text with editable fields:
   - List of detected medicine names (editable text inputs)
   - For each: suggested dosage, timing (if detected)
   - "Add another medicine" button for ones OCR missed
7. User confirms → creates `prescription` + `medicines` rows

**OCR API route (`/api/ocr/route.ts`):**
```typescript
// POST: { imageUrl: string }
// 1. Fetch image from Supabase Storage URL
// 2. Send to Google Cloud Vision API (DOCUMENT_TEXT_DETECTION)
// 3. Parse response — extract lines that look like medicine entries
// 4. Return: { rawText: string, medicines: { name: string, dosage?: string, timing?: string }[] }
```

**Important:** OCR will be imperfect for handwritten Hindi prescriptions. The UI must make manual correction easy and fast. Pre-fill what OCR finds, but make every field editable. Add a "I'll type it manually" bypass button at the top.

### 5.3 Medicine Photo Linking (`/setup/medicines`)

**Flow:**
1. Shows list of medicines from the prescription (or manually added)
2. Each medicine has a "📸 Take Photo" button
3. User photographs the actual medicine strip/bottle
4. Photo is compressed, uploaded, linked to the medicine record
5. User can optionally add a "colour label" — a plain-language identifier like "badi wali goli" (the big pill) or "pink syrup"
6. Prominent "Next: Set Schedule →" button when at least one medicine has a photo

### 5.4 Schedule Setup (`/setup/schedule`)

**Flow:**
1. Shows each medicine (photo + name) in a card
2. For each medicine, user taps which time slots apply (toggle buttons: Morning / Afternoon / Evening / Night)
3. For each active slot, user sets dose count (stepper: −/+ with 0.5 increments)
4. Optional: set exact reminder time per slot (default: 8:00, 13:00, 18:00, 22:00)
5. "Save & Go to Dashboard →"

**This should feel like a setup wizard — 3 steps (prescription → photos → schedule) with a progress bar at the top.** After setup, the user lands on the Dashboard and should never need the setup flow again unless adding a new prescription.

### 5.5 Family Sharing (`/family`)

**Invite flow:**
1. Admin (person who created the patient) sees a 6-digit invite code on the Family screen
2. They share this code via WhatsApp/SMS/verbally (add a "Share via WhatsApp" button using `https://wa.me/?text=...`)
3. New family member: opens app → logs in → enters invite code → becomes a caregiver with `member` role
4. Members can view schedule and mark doses. Only admins can edit medicines/schedule.

### 5.6 Dose History (`/history`)

- Reverse-chronological list of all dose logs
- Each entry: medicine photo (small), medicine name, dose count, "Given by [name]", timestamp
- Filter by: date range, medicine, caregiver
- Colour-coded: green = given, yellow = skipped, red = missed
- "Missed" is calculated: if a schedule entry's time slot has passed and no log exists, it's missed

---

## 6. Offline-First Architecture

### IndexedDB Schema (via `idb`):

```typescript
// src/lib/offline/db.ts
import { openDB } from 'idb';

const DB_NAME = 'dawaisathi';
const DB_VERSION = 1;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Cache of today's schedule (refreshed on each online fetch)
      db.createObjectStore('schedule', { keyPath: 'scheduleEntryId' });
      
      // Pending dose logs (created offline, not yet synced)
      db.createObjectStore('pendingDoses', { keyPath: 'id' });
      
      // Medicine photos (blob cache for offline viewing)
      db.createObjectStore('medicinePhotos', { keyPath: 'medicineId' });
    }
  });
}
```

### Sync Strategy:

1. **On app load (online):** Fetch today's full schedule view from Supabase → write to IndexedDB `schedule` store → render from store
2. **On dose mark (any connectivity):** Write to IndexedDB `pendingDoses` → attempt Supabase insert → on success, mark `synced: true` and remove from pending
3. **On reconnect:** `useOfflineSync` hook listens to `window.addEventListener('online', ...)` → flushes all `pendingDoses` with `synced: false` to Supabase → removes from IndexedDB on success
4. **Medicine photos:** On first load, cache medicine photo blobs in IndexedDB. On Dashboard render, serve from cache first, falling back to network URL.

---

## 7. Push Notification Flow

### Setup:
1. On Dashboard first load, prompt for notification permission
2. If granted, generate VAPID subscription via `pushManager.subscribe()`
3. POST subscription to `/api/push` → stores in `push_subscriptions` table

### Reminder Delivery:
1. Supabase Edge Function `send-reminders` runs on cron (every 5 minutes)
2. Queries: `schedule_entries WHERE reminder_time BETWEEN now() AND now() + 5min AND is_active = true`
3. For each, check if a `dose_log` exists for today + that schedule entry
4. If no log: fetch all push subscriptions for caregivers of that patient
5. Send Web Push to all caregivers: "⏰ Time for [patient name]'s [time slot] medicine"

### Escalation:
- If 30 minutes past reminder_time and still no dose log → send escalation push: "⚠️ [patient name]'s [medicine name] has not been marked as given"
- This is the killer feature. This catches the missed doses that lead to deterioration.

---

## 8. Image Handling

All images go through client-side compression before upload:

```typescript
// src/lib/utils/image.ts
export async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', quality);
    };
    img.src = URL.createObjectURL(file);
  });
}
```

**Target:** Prescription photos < 200KB, medicine photos < 100KB. This is critical for Jio 4G upload speeds and Supabase storage limits.

---

## 9. i18n Strategy

Use `next-intl` with JSON message files. **Every user-facing string must be in the message files — no hardcoded English in components.**

```json
// public/locales/hi.json (excerpt)
{
  "dashboard": {
    "title": "आज की दवाइयाँ",
    "morning": "सुबह",
    "afternoon": "दोपहर",
    "evening": "शाम",
    "night": "रात",
    "markGiven": "दवाई दी",
    "markSkipped": "छोड़ी",
    "givenBy": "{name} ने दी",
    "tablets": "{count} गोली",
    "offlineNotice": "आप ऑफ़लाइन हैं — दवाई की जानकारी अभी भी दिख रही है"
  },
  "setup": {
    "step1": "पर्ची की फ़ोटो लें",
    "step2": "दवाई की फ़ोटो लें",
    "step3": "समय तय करें"
  }
}
```

---

## 10. Design System

### Colour Tokens (Tailwind):

```javascript
// tailwind.config.ts — extend theme
colours: {
  morning:   { bg: '#FFF8E1', accent: '#F9A825', text: '#5D4037' },  // Warm amber
  afternoon: { bg: '#E3F2FD', accent: '#1976D2', text: '#0D47A1' },  // Clear blue
  evening:   { bg: '#FFF3E0', accent: '#E65100', text: '#BF360C' },  // Sunset orange
  night:     { bg: '#E8EAF6', accent: '#283593', text: '#1A237E' },  // Deep indigo
  given:     '#4CAF50',  // Green
  skipped:   '#FFC107',  // Amber
  missed:    '#F44336',  // Red
  primary:   '#1B5E7B',  // Teal — app brand colour
}
```

### Touch Targets:
- Minimum 48x48px for all interactive elements
- Medicine check buttons: 56x56px minimum
- Bottom nav icons: 44x44px with labels

### Typography:
- Use system font stack for maximum compatibility on Indian Android phones
- Hindi text: ensure `lang="hi"` attribute for proper rendering
- Dose counts: 24px bold minimum — must be readable at arm's length

---

## 11. Environment Variables

```bash
# .env.local.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # Server-side only

GOOGLE_CLOUD_VISION_API_KEY=your-api-key          # Server-side only

NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key           # Server-side only
VAPID_SUBJECT=mailto:your-email@example.com
```

---

## 12. Build Order (for the coding agent)

Execute in this exact sequence. Do not skip ahead. Each step should result in a working, testable state.

### Phase 1: Skeleton (Day 1)
1. `npx create-next-app@latest dawaisathi --typescript --tailwind --app --src-dir`
2. Install dependencies: `npm install @supabase/supabase-js @supabase/ssr zustand idb next-intl @radix-ui/react-dialog @radix-ui/react-toast web-push`
3. Set up Tailwind config with colour tokens from Section 10
4. Create project structure (all folders and placeholder files)
5. Set up `next-intl` with en.json and hi.json (just dashboard strings)
6. Create root layout with providers (Supabase auth, i18n, Zustand)
7. Create BottomNav component
8. Create a static Dashboard page with hardcoded 4 TimeSlotCards — **no data, just the visual layout**
9. **TEST:** App runs, shows 4 coloured time slot cards, bottom nav works, language switch works

### Phase 2: Database & Auth (Day 2)
10. Set up Supabase project (or use local via `supabase init` + `supabase start`)
11. Run migration from Section 3
12. Configure Supabase Auth (enable Phone OTP provider)
13. Build login page: phone number input → OTP verification → redirect to dashboard
14. Build auth middleware (protect all routes except login)
15. Build "Create Patient" flow: name + invite code generation → insert into `patients` + `caregivers` (as admin)
16. **TEST:** Can sign in via OTP, create a patient, see empty dashboard

### Phase 3: Setup Wizard (Day 3-4)
17. Build CameraCapture component (`<input type="file" accept="image/*" capture="environment">`)
18. Build image compression utility
19. Build Supabase Storage upload function
20. Build prescription upload page: capture → compress → upload → store in DB
21. Build `/api/ocr` route with Google Cloud Vision integration
22. Build PrescriptionReview component: show OCR results in editable fields, allow manual add
23. Build medicine photo linking page: show each medicine, let user photograph each strip
24. Build schedule setup page: for each medicine, pick time slots + dose counts
25. **TEST:** Full setup wizard works end-to-end. Medicines created with photos and schedule.

### Phase 4: Live Dashboard (Day 5)
26. Build `useSchedule` hook: fetch today's schedule joined with dose logs
27. Build MedicineChip component with photo, dose count, status indicator
28. Build DoseCheckButton with confirmation drawer
29. Build `useDoseLog` hook: mark dose → write to DB → optimistic update
30. Wire Dashboard to live data
31. **TEST:** Dashboard shows real medicines with photos. Can mark doses. Refreshes correctly.

### Phase 5: Offline & PWA (Day 6)
32. Set up `next-pwa` with Serwist
33. Create PWA manifest with icons
34. Build IndexedDB schema and helper functions
35. Build offline cache: on schedule fetch, write to IndexedDB
36. Build offline dose logging: write to `pendingDoses` in IndexedDB
37. Build `useOfflineSync` hook: flush pending on reconnect
38. Build OfflineBanner component
39. **TEST:** Turn off network. Dashboard still shows. Can mark doses. Turn on network — doses sync.

### Phase 6: Family Sharing (Day 7)
40. Build invite code display + WhatsApp share button
41. Build "Join Family" flow: enter invite code → look up patient → create caregiver record
42. Build MemberList component
43. **TEST:** Two different phone numbers can sign in, join same patient, see same schedule, mark doses.

### Phase 7: Notifications (Day 8)
44. Generate VAPID keys
45. Build push subscription flow on Dashboard
46. Build `/api/push` route to store subscriptions
47. Build Supabase Edge Function for cron-based reminder sending
48. Build escalation logic (30-min check)
49. **TEST:** Set a reminder time 2 minutes from now. Receive push notification. Don't mark dose. Receive escalation.

### Phase 8: History & Polish (Day 9-10)
50. Build dose history page with filters
51. Add loading skeletons for all data-fetching states
52. Add error boundaries and toast notifications
53. Test on actual low-end Android phone via Chrome
54. Lighthouse audit — target: Performance > 80, Accessibility > 90, PWA badge
55. Write README with setup instructions

---

## 13. Critical Implementation Notes

### Things That Will Break If You Get Them Wrong:

1. **Supabase RLS must be tested thoroughly.** A caregiver should NEVER see another family's data. Write integration tests for this.

2. **Image compression BEFORE upload is non-negotiable.** Indian phone cameras shoot 12MP photos. A 4MB prescription photo on Jio 4G will timeout. Compress to < 200KB.

3. **The Dashboard MUST render from cache on load.** If the first load shows a spinner while fetching, users on slow connections will think the app is broken. Render from IndexedDB immediately, then refresh from network in the background (stale-while-revalidate pattern).

4. **OTP delivery in India:** Supabase uses Twilio for SMS. Twilio's India delivery rate is ~85-90%. Consider adding WhatsApp OTP as a future fallback. For MVP, SMS OTP is acceptable.

5. **Hindi typography:** Test on actual Android devices. Some older phones render Devanagari poorly with certain font stacks. System fonts (`font-family: system-ui`) are the safest bet.

6. **Time zones:** India is UTC+5:30 (single timezone). Hardcode `Asia/Kolkata` for all time calculations in the MVP. Don't over-engineer timezone support yet.

7. **Service worker caching strategy:** Use `NetworkFirst` for API calls (schedule data) and `CacheFirst` for static assets and medicine photos. Never use `CacheOnly` — the schedule changes when prescriptions are updated.

8. **WhatsApp sharing** of invite codes is the primary distribution mechanism. Make the share button prominent and pre-fill the message: "Join me on DawaiSathi to help manage [patient name]'s medicines. Install: [URL]. Code: [6-digit code]"

---

## 14. What's NOT in MVP (Backlog)

Do not build these now. They are documented for future contributors:

- [ ] Multi-patient support (one caregiver managing multiple patients)
- [ ] Doctor portal (doctor sends digital prescription directly)
- [ ] ABDM (Ayushman Bharat Digital Mission) integration
- [ ] Pharmacy integration (auto-reorder when medicines run low)
- [ ] Medicine interaction warnings
- [ ] Voice-based interface (full voice UI for illiterate users)
- [ ] Adherence analytics dashboard for doctors/NGOs
- [ ] Native mobile app (React Native / Flutter)
- [ ] Barcode scanning for medicine identification
- [ ] AI-powered schedule suggestion from prescription OCR

---

## 15. Licence

Apache 2.0. Include a `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` from day one. The project is designed to become a Digital Public Good.
