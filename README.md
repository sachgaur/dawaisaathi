# DawaiSathi (दवाई साथी)
### A Visual Medication Reminder for Low-Resource Settings

## The Problem
Medication non-adherence in Indian households is a quiet crisis hiding in plain sight. Prescriptions are handwritten and illegible, medicines are sold in cut strips without labels, and dosage instructions are passed verbally. Multiple family members share caregiving duties, leading to missed or duplicate doses when handoffs fail.

Existing reminder apps assume literate, English-speaking users who can read drug names and set alarms. **DawaiSathi** aims to solve this for multi-caregiver, low-resource households where the caregivers often rely on visual cues rather than text.

## The Solution
DawaiSathi ("Medicine Companion") is a free, open-source mobile web app (PWA) designed for shared family medication management. 
- **Upload Prescriptions**: AI/OCR extracts medicine names and timings directly from photos of handwritten prescriptions.
- **Visual Medicine Identification**: Actual medicine strips are photographed to serve as the main visual identifier, removing the need to read text labels.
- **Visual Schedule Board**: A universally understandable colour-coded, time-of-day dashboard (Morning, Afternoon, Evening, Night) to mark doses.
- **Family Shared Access**: Multiple family members can securely join via a simple 6-digit invite code. Everyone sees the same schedule, and an audit trail tracks who gave what and when.
- **Offline-First**: The schedule works and doses can be logged entirely offline. Changes automatically sync when the device comes back online.
- **Smart Reminders**: Web Push notifications alert caregivers at scheduled times, with escalation alerts if critical doses are missed.

## Tech Stack Overview
Our architecture optimises for zero DevOps, minimal infrastructure cost, and progressive enhancement for low-end Android devices on weak mobile data networks.
- **Frontend Framework**: Next.js 14+ (App Router), TypeScript
- **Styling & UI**: Tailwind CSS, Radix UI primitives
- **PWA & Offline Data**: `next-pwa` (Serwist), Zustand (State), IndexedDB via `idb`
- **Backend & Database**: Supabase (Postgres, Auth via OTP/Magic Link, Storage, Edge Functions), Next.js API Routes
- **OCR Engine**: Google Cloud Vision API
- **Reminders**: Web Push API

## Local Development Setup

DawaiSathi is structured as a full-stack Next.js project. Any participant can deploy and try it on their own machine. Follow the steps below to run the MVP infrastructure locally.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- `npm` or `yarn`
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local development) or a free Supabase Cloud account.
- A Google Cloud account with the Cloud Vision API enabled.

### 1. Clone the Repository
```bash
git clone https://github.com/dawaisathi/dawaisathi.git
cd dawaisathi
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Supabase (Database & Auth)
If you are using **Supabase Local Development Environment**:
```bash
supabase init
supabase start
```
This automatically initiates a local PostgreSQL instance and executes the schema migrations from `supabase/migrations/001_initial_schema.sql`.

If you are using a **Supabase Cloud Project**:
1. Create a new hosted project on [Supabase.com](https://supabase.com/).
2. Navigate to the SQL Editor and copy-paste the queries in `supabase/migrations/001_initial_schema.sql` to structure your tables and Row Level Security (RLS) policies.
3. Gather your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the project settings.

### 4. Configure Environment Variables
Copy the template environment configuration file:
```bash
cp .env.local.example .env.local
```
Fill in the necessary credentials in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

GOOGLE_CLOUD_VISION_API_KEY=your_google_cloud_vision_api_key

NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your-email@example.com
```

### 5. Start the Application
Run the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application. 
*(Note: Be sure to test the application logic using the Google Chrome DevTools mobile view to simulate low-end Android displays accurately.)*

## Project Structure
- `public/`: Static assets, Progressive Web App manifest (`manifest.json`), service worker files, and `next-intl` localization dictionaries.
- `src/app/`: Next.js App Router configurations, containing core application pages like the `dashboard`, `setup`, and `history` views.
- `src/components/`: Reusable UI elements, categorised into `schedule`, `setup`, `family`, and `shared` logic, built using Radix UI & Tailwind CSS.
- `src/lib/`: Essential utility functions including the offline `IndexedDB` sync manager, Supabase clients, Push subscription rules, and `i18n` setup.

## Contributing to DawaiSathi
DawaiSathi is an open-source initiative (Apache 2.0) designed as a Digital Public Good. We want to welcome contributors from across engineering, design, linguistics, and healthcare disciplines!

Here are a few high-priority areas where we need help to bring this MVP to life:
- 🎨 **UX/UI Designers**: Developing robust interfaces tailored for low-literate users. 
- 🧠 **AI/ML Engineers**: Enhancing document AI and tweaking OCR specifically for Indic languages.
- 🌐 **Translators**: Creating natural language localizations in Hindi, Tamil, Telugu, Bengali etc.
- 💬 **Field Testers**: Taking DawaiSathi mockups into real family settings (in tier-2 and tier-3 cities) to gather qualitative field context.

Please read our `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` to learn more about how to contribute.
