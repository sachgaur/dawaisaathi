'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { generateInviteCode } from '@/lib/utils/invite-code';

export default function NewPatientOnboarding() {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<'CREATE' | 'JOIN'>('CREATE');

  const [patientName, setPatientName] = useState('');
  const [caregiverName, setCaregiverName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Not authenticated');

      const code = generateInviteCode();
      const patientId = crypto.randomUUID();

      const { error: patientError } = await supabase
        .from('patients')
        .insert({ id: patientId, name: patientName, invite_code: code, created_by: user.id });
      
      if (patientError) throw patientError;

      const { error: caregiverError } = await supabase
        .from('caregivers')
        .insert({ patient_id: patientId, user_id: user.id, role: 'admin', display_name: caregiverName });
      if (caregiverError) throw caregiverError;

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error creating patient profile');
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: patient, error: findError } = await supabase
        .from('patients')
        .select('id, name')
        .eq('invite_code', inviteCode.toUpperCase())
        .single();
      
      if (findError || !patient) throw new Error('Invalid invite code');

      const { error: joinError } = await supabase
        .from('caregivers')
        .insert({ patient_id: patient.id, user_id: user.id, role: 'member', display_name: caregiverName });
      
      // 23505 = Postgres Unique Violation (Caregiver already assigned)
      if (joinError && joinError.code !== '23505') throw joinError;

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid invite code or error joining');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col justify-center">
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button 
            className={`flex-1 py-4 text-sm font-bold transition-colors ${tab === 'CREATE' ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]' : 'text-gray-400'}`}
            onClick={() => { setTab('CREATE'); setError(''); }}
          >
            Create New Patient
          </button>
          <button 
            className={`flex-1 py-4 text-sm font-bold transition-colors ${tab === 'JOIN' ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]' : 'text-gray-400'}`}
            onClick={() => { setTab('JOIN'); setError(''); }}
          >
            Join Family
          </button>
        </div>

        <div className="p-6">
          {error && (
             <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium">
               {error}
             </div>
          )}

          {tab === 'CREATE' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient's Name</label>
                <input
                  type="text" required placeholder="e.g. Ram Kumar"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none text-lg"
                  value={patientName} onChange={(e) => setPatientName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name (Caregiver)</label>
                <input
                  type="text" required placeholder="e.g. Sunita"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none text-lg"
                  value={caregiverName} onChange={(e) => setCaregiverName(e.target.value)}
                />
              </div>
              <button disabled={loading} type="submit" className="w-full py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl text-lg mt-4 disabled:opacity-50">
                {loading ? 'Creating...' : 'Create Profile'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">6-Digit Invite Code</label>
                <input
                  type="text" required placeholder="ABC123"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none text-lg text-center tracking-widest uppercase"
                  value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase().slice(0, 6))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                <input
                  type="text" required placeholder="e.g. Amit"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none text-lg"
                  value={caregiverName} onChange={(e) => setCaregiverName(e.target.value)}
                />
              </div>
              <button disabled={loading || inviteCode.length < 6} type="submit" className="w-full py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl text-lg mt-4 disabled:opacity-50">
                {loading ? 'Joining...' : 'Join Family'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
