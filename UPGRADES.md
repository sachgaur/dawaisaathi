# DawaiSathi — Upgrade Roadmap and Market Review

> *What real users of medicine tracking apps ask for most — mapped to DawaiSathi's next steps.*

---

## How to Read This Document

Each upgrade is tagged with:
- **Impact** — How much users will notice and value it
- **Effort** — How hard it is to build (Low / Medium / High)
- **Priority** — Suggested build order based on impact vs effort

---

## Priority 1 — Users Will Demand These Immediately

### 1. Push Notifications (Dose Reminders)
**Impact: Critical | Effort: Medium**

The single biggest complaint across every medicine app (Medisafe, MyTherapy, Practo) is *"I still forget to take my medicine even with the app."* The cabinet schedule means nothing without a notification at the right time.

- Send a push notification at each time slot (Morning = 8am, Afternoon = 1pm, Evening = 6pm, Night = 10pm)
- Allow user to customize these times
- Notification should say: *"Time for your Evening medicines — Aspirin, Metformin"*
- Works even when the browser is closed (requires a Service Worker + Web Push API or Firebase Cloud Messaging)
- **Why users ask for this:** Medisafe has 10M+ downloads entirely because of this one feature

---

### 2. Mark as Taken (Dose Logging)
**Impact: Critical | Effort: Low-Medium**

Right now the cabinet shows what to take but there is no way to check it off. Users of apps like MyTherapy specifically cite *"tick it off when done"* as the feature they use most.

- Add a checkbox or swipe-to-complete on each medicine card in the cabinet
- Completed medicines show a green check and move to a "Done" section
- Resets automatically at midnight for the next day
- Optional: show a daily streak counter ("You've taken all medicines 7 days in a row")
- **Why users ask for this:** Without logging, the app is a passive display board, not an active health tool

---

### 3. Refill Tracker (Running Low Alerts)
**Impact: High | Effort: Medium**

The second-most common complaint in medicine app reviews is running out of medicine without warning. Users on Amazon Pharmacy, 1mg, and Netmeds reviews all mention this.

- When adding a medicine, let the user enter the current quantity (e.g., 30 tablets)
- The app counts down by the number of doses per day
- When quantity falls below 7 days of supply, send a push notification: *"You have 5 days of Metformin left — time to refill"*
- Optional: one-tap link to search the medicine on 1mg/Netmeds

---

### 4. Medicine Expiry Tracking
**Impact: High | Effort: Low**

Users frequently ask for this in reviews of Medisafe and similar apps. Expired medicines in the home are a real safety hazard.

- Add an optional expiry date field when confirming a medicine after scan
- The cabinet shows a warning badge near medicines expiring within 30 days
- Push alert on expiry date: *"Amoxicillin in Riya's cabinet expired today — dispose safely"*

---

## Priority 2 — Power Users Will Value These

### 5. Prescription History Archive
**Impact: High | Effort: Medium**

Users who visit doctors frequently want a log of past prescriptions — especially for insurance claims, second opinions, or referencing old medicines. Competitors like MedBridge and Zocdoc offer prescription history.

- Every scanned image is permanently stored with a timestamp and extracted medicine names
- A new "History" tab shows all past scans in reverse chronological order
- User can re-add a medicine from a past prescription with one tap

---

### 6. Dose Instructions (How to Take)
**Impact: High | Effort: Low**

A medicine name alone is not enough. Users need to know:
- With food or without?
- Half a tablet or full?
- For how many days?

- Add these optional fields in the confirmation screen after scan
- The AI can attempt to extract this from the prescription text too (Gemini can do this)
- Show these instructions as a small note in the cabinet card

---

### 7. Doctor and Pharmacy Notes
**Impact: Medium | Effort: Low**

A simple free-text notes field on each medicine for the user to write doctor's instructions. Very low effort, high perceived value — users feel the app is their personal health journal.

---

### 8. Caregiver / Remote Family Mode
**Impact: High | Effort: High**

The current family mode requires everyone to be on the same device or the same account network. A large market segment is adult children managing elderly parents remotely.

- Family members can be genuinely remote — each with their own Google account
- The caregiver (e.g., son/daughter) gets a read-only or full-control view of a parent's cabinet
- Changes sync in real-time over the internet
- **Why this matters:** India has roughly 100M elderly people; caregiving apps for this segment are heavily underserved

---

### 9. Regional Language Support
**Impact: Very High in India | Effort: Medium**

Gemini already supports Hindi, Bengali, Tamil, Telugu, Marathi and other Indian languages. A large portion of prescriptions in India are handwritten in regional languages or Hindi.

- Detect the language of the prescription automatically (Gemini can do this)
- Extract medicine names even from Hindi/Devanagari prescriptions
- Display the UI in the user's preferred language
- **Market insight:** 65% of India's population is not comfortable in English — this unlocks a massive new user base

---

### 10. Vitals Tracker (Blood Pressure, Sugar, Weight)
**Impact: Medium | Effort: Medium**

Apps like Samsung Health, HealthifyMe, and Google Fit are moving toward integrating vitals with medicine schedules. Users on chronic medicines (BP, diabetes) want to see if their readings correlate with medicine adherence.

- Add a simple log screen: Date, Vital type, Reading
- Show a simple line chart of readings over time
- Optional: tag a reading to a medicine ("BP reading taken 2 hours after Amlodipine")

---

## Priority 3 — Differentiators That Make the App Stand Out

### 11. AI Drug Interaction Checker
**Impact: Very High | Effort: Medium**

When a user adds a new medicine, the app can warn if it is known to interact with any medicine already in their cabinet. This is a genuine safety feature that no Indian consumer app currently offers well.

- When a new medicine is added, query Gemini: *"Does [Medicine A] interact with [Medicine B], [Medicine C]?"*
- Show a soft warning if there is a known interaction: *"Ibuprofen may interact with Warfarin already in your cabinet. Please check with your doctor."*
- This alone would make DawaiSathi stand out from every competitor in the market

---

### 12. Scan from Gallery (Not Just Camera)
**Impact: High | Effort: Low**

Many users receive prescriptions as WhatsApp photos or PDF scans from their doctor. They want to import these directly.

- Add an "Upload from Gallery" option alongside the camera scan
- The same Gemini pipeline processes the image
- **Why users ask for this:** e-prescriptions via WhatsApp are extremely common in urban India

---

### 13. Medicine Information Card (What Is This Drug?)
**Impact: Medium | Effort: Low**

When a user sees an unfamiliar medicine name in their cabinet, they want to know what it is for without leaving the app.

- Long-press a medicine name to show an AI-generated summary: *"Metformin is used to manage Type 2 diabetes by lowering blood sugar levels."*
- Powered by Gemini — no external drug database needed
- Always display: *"Follow your doctor's instructions. This is general information only."*

---

### 14. Dark Mode / Theme Toggle
**Impact: Medium | Effort: Low**

A frequently requested UI feature across all health apps — especially relevant for night-time medicine checks.

---

### 15. Export to PDF / Share Cabinet
**Impact: Medium | Effort: Medium**

When visiting a doctor, users want to show their full current medicine list. A "Share My Cabinet" button that generates a clean PDF of all medicines, doses, and schedules would be practical for doctor visits.

---

### 16. Wearable / Smartwatch Integration
**Impact: Medium | Effort: High**

- Show dose reminders on Apple Watch or Wear OS
- Confirm a dose taken directly from the watch
- Long-term feature, not immediate priority

---

## Infrastructure and Technical Upgrades

These are not user-visible features but are essential for the app to scale and perform properly in production.

### T1. Migrate to PostgreSQL (Cloud Database)
**Why:** SQLite is a file on one server. If the server restarts, data could be at risk. PostgreSQL on Supabase or Railway gives you a proper cloud database with backups.

### T2. Deploy Backend to a Real Server
**Why:** Currently the Flask server runs on your laptop. For real users, deploy to:
- Railway (simplest, free tier available)
- Render (good free tier)
- Google Cloud Run (scales to zero, pay per use)

### T3. Fix PWA Cache URLs for Production
**Why:** The `vite.config.ts` workbox patterns have been updated to use relative paths, so they now work on any domain. This is already fixed in the current codebase.

### T4. Rate Limiting on Gemini API Calls
**Why:** Each scan makes a call to Gemini Vision which costs money per call. Without rate limiting, a single user could repeatedly hit the scan endpoint and generate high API costs.

### T5. Image Compression Before Upload
**Why:** Phone cameras take 4-10MB photos. Compressing to 300-500KB before sending to the backend would make the cabinet load significantly faster on mobile, especially on slower connections.

---

## Offline Capability — Honest Assessment

### What Works Offline (After Add to Home Screen)

When a user adds DawaiSathi to their home screen and opens it without internet, here is what actually works:

| Feature | Offline Status | Reason |
|---|---|---|
| App shell loads | Works | Vite PWA caches all JS, CSS, HTML at install time |
| Cabinet view (cached data) | Partial | If the user visited the cabinet while online, NetworkFirst caches the last API response for up to 24 hours |
| Medicine photos | Partial | If photos were viewed while online, CacheFirst serves them from cache for up to 30 days |
| Scanner / Camera | Does not work | Gemini AI call requires internet. Camera preview works but AI extraction fails |
| Google Sign In | Does not work | OAuth requires internet — user must already be logged in |
| Adding new medicines | Does not work | Requires backend API call to save |
| Family sync | Does not work | Requires backend |

### What Offline Could Look Like With Proper Investment

With a proper offline-first architecture (IndexedDB for local data, background sync for writes), the cabinet view could work fully offline — showing the user their full medicine schedule even with no internet. This is achievable in a few days of additional work.

---

## Summary Table

| # | Upgrade | Impact | Effort | Priority |
|---|---|---|---|---|
| 1 | Push Notifications | Critical | Medium | Now |
| 2 | Mark as Taken | Critical | Low | Now |
| 3 | Refill Tracker | High | Medium | Now |
| 4 | Expiry Tracking | High | Low | Now |
| 5 | Prescription History | High | Medium | Next |
| 6 | Dose Instructions | High | Low | Next |
| 7 | Doctor Notes | Medium | Low | Next |
| 8 | Remote Caregiver Mode | High | High | Next |
| 9 | Regional Languages | Very High | Medium | Next |
| 10 | Vitals Tracker | Medium | Medium | Next |
| 11 | AI Drug Interaction | Very High | Medium | Later |
| 12 | Scan from Gallery | High | Low | Later |
| 13 | Medicine Info Card | Medium | Low | Later |
| 14 | Dark Mode | Medium | Low | Later |
| 15 | Export to PDF | Medium | Medium | Later |
| 16 | Wearable Integration | Medium | High | Later |
| T1 | PostgreSQL Migration | Infrastructure | Low | Now |
| T2 | Deploy to Real Server | Infrastructure | Medium | Now |
| T3 | Fix PWA Cache URLs | Infrastructure | Low | Done |
| T4 | API Rate Limiting | Infrastructure | Low | Next |
| T5 | Image Compression | Infrastructure | Low | Next |

---

*Document prepared for DawaiSathi v1 — Project Eigen*
