# DawaiSathi (दवाई साथी)

**A Visual Medication Reminder for Low-Resource Settings in India.**

## The Problem
Medication non-adherence in multi-caregiver Indian households is a massive systemic failure. This is often driven by illegible prescriptions, lack of digital literacy, language barriers, and informal responsibility sharing ("Did you give Pitaji his medicine today?").

## The Solution
DawaiSathi is a mobile-first, visual, photo-driven medication reminder designed for shared family management. It explicitly requires virtually zero reading skills from the primary patient by substituting textual medicine names with photos of the actual blister packs and color-coded time slots.

## Core Features (MVP)
- **AI Prescription Reading**: Snap a photo, and Google Gemini Multimodal AI extracts all medicines automatically.
- **Visual Medicine Identification**: Medicine strips are photographed. A user only needs to look at the pill photo to know what to give.
- **Visual Day Dashboard**: Morning (🌅), Afternoon (🌤️), Evening (🌇), and Night (🌙) visual slots.
- **Family Sync**: Secure 6-digit invite codes allow multiple family members to share the same patient's audit trail.
- **Email OTP**: Passwordless secure authentication via Supabase.

## Tech Stack
- **Frontend**: Next.js 14+ (App Router), Tailwind CSS, Radix UI Primitives
- **Localization**: next-intl (English & Hindi)
- **Backend & Auth**: Supabase (Postgres, Auth, Storage)
- **AI OCR**: Google Gemini API (Multimodal Flash models)

---

## Local Development Setup

To run DawaiSathi on your local machine:

### 1. Clone & Install
```bash
git clone https://github.com/sachgaur/dawaisaathi.git
cd dawaisaathi
npm install
```

### 2. Supabase Cloud Setup
1. Create a free project on [Supabase.com](https://supabase.com/).
2. Setup the Database: Go to the SQL Editor and run the table queries found in `supabase/migrations/001_initial_schema.sql`.
3. Set up Storage: Go to **Storage**, click **New Bucket**, name it exactly `prescriptions`, and make it **Public**. Then run the queries from `supabase/migrations/002_storage_policies.sql` in the SQL Editor to grant upload access.
4. Enable Authentication: Go to Authentication > Providers and verify Email is enabled.

### 3. Google Gemini AI Setup
- Go to [Google AI Studio](https://aistudio.google.com/app/apikey) and generate a free API key.

### 4. Environment Variables
Copy the `.env.local.example` file to create your own configuration:
```bash
cp .env.local.example .env.local
```
Then heavily edit `.env.local` to paste your unique `<PROJECT_URL>`, `<ANON_KEY>`, and `<GEMINI_API_KEY>`.

### 5. Start Development Server
```bash
npm run dev
```
Open your browser at [http://localhost:3000](http://localhost:3000) to see it running!

---

## Project Structure
- `src/app/` - Next.js App Router endpoints (localized by `next-intl`).
- `src/components/` - Reusable UI widgets like `CameraCapture` and `BottomNav`.
- `src/lib/supabase/` - Next.js standard Supabase client configuration.
- `src/app/api/ocr/` - Backend secure route to execute Gemini AI logic.
- `supabase/migrations/` - SQL schema backups to replicate the backend.

## Open Source Contributions
We heartily welcome community contributions! Specific areas of focus for the MVP:
- **PWA Integration**: Caching the app via service workers for full offline usage.
- **Push Notifications**: Integrating the Web Push APIs for CRON-job scheduling alerts.
- **Localization**: We currently support English & Hindi. Help us add Marathi, Bengali, Tamil, etc.!
