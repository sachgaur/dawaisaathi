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
