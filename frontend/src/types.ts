export interface User {
  id: number
  name: string
  email: string
  avatar_url: string | null
  family_id: number | null
}

export interface Family {
  id: number
  name: string
  family_code: string
  created_at: string
}

export interface FamilyMember extends User {}

export interface JoinRequest {
  id: number
  requester: User
  family_id: number
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

export interface MedicineEntry {
  id: number
  user_id: number
  family_id: number | null
  name: string
  dosage: string | null
  schedule: TimeSlot[]
  days: number | null
  instructions: string | null
  target_eye?: 'right_eye' | 'left_eye' | 'both_eyes' | 'none' | null
  bottle_cap_color?: string | null
  stagger_interval_minutes?: number | null
  sequence_order?: number | null
  scan_image_url: string | null
  pack_image_url: string | null
  created_at: string
  today_logs?: TimeSlot[]
  user_name?: string | null
}

export interface MedicineLog {
  id: number
  entry_id: number
  logged_by_user_id: number
  time_slot: TimeSlot
  logged_at: string
}

export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night'

export type Page = 'family' | 'cabinet' | 'scan' | 'inbox'

// Runtime sentinel so Vite ESM doesn't see an empty module
export const _types_loaded = true

