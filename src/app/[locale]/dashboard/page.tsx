import { getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/i18n/routing';
import BottomNav from '@/components/shared/BottomNav';

export default async function DashboardPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const { locale } = await params;
  const t = await getTranslations('dashboard');
  const supabase = await createClient();

  // 1. Check authentication (Though middleware guarantees this, we need the user to fetch data)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: '/login', locale });
    return null;
  }

  // 2. Fetch Caregiver Profile to find connected patients
  const { data: caregivers } = await supabase
    .from('caregivers')
    .select('patient_id, role, patients(name)')
    .eq('user_id', user.id);

  if (!caregivers || caregivers.length === 0) {
    // User has no patients. Force them to onboarding.
    redirect({ href: '/family/new', locale });
    return null;
  }

  // Use the first patient for the MVP 
  const activePatientId = caregivers[0].patient_id;
  const activePatientData = caregivers[0].patients as any;
  const activePatientName = activePatientData?.name || 'Patient';

  // 3. Fetch scheduled medicines for today (We'll build out the complex schedule hook later. For now, check if any medicines exist)
  const { data: medicines } = await supabase
    .from('medicines')
    .select('id')
    .eq('patient_id', activePatientId)
    .limit(1);

  const hasMedicines = medicines && medicines.length > 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="px-4 py-6 bg-white shadow-sm sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">{t('title')}</h1>
          <p className="text-sm text-gray-500">{activePatientName} • Today</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] opacity-20 flex items-center justify-center text-primary font-bold">
           {activePatientName.charAt(0)}
        </div>
      </header>
      
      <main className="p-4 space-y-4">
        {!hasMedicines ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center shadow-sm">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              📸
            </div>
            <h2 className="text-xl font-bold mb-2">No Medicines Yet</h2>
            <p className="text-gray-500 mb-6">Start by taking a picture of {activePatientName}'s prescription. We will automatically read the medicines and help you schedule them.</p>
            <Link 
              href="/setup/prescription"
              className="inline-block w-full py-4 bg-[var(--color-primary)] text-white font-bold rounded-xl text-lg hover:bg-opacity-90 shadow-sm"
            >
              Upload Prescription
            </Link>
          </div>
        ) : (
          <>
            {/* Morning */}
            <section className="bg-[var(--color-morning-bg)] rounded-xl p-4 border border-[var(--color-morning-accent)]">
              <h2 className="text-lg font-bold text-[var(--color-morning-text)] mb-3 flex items-center gap-2">
                🌅 {t('morning')}
              </h2>
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                <div className="min-w-[140px] snap-center bg-white rounded-lg p-3 shadow-sm flex flex-col items-center gap-2 relative">
                  <div className="w-16 h-16 bg-gray-100 border border-gray-200 rounded-md"></div>
                  <span className="font-bold text-center leading-tight">Amlodipine 5mg</span>
                  <span className="text-sm text-gray-600 font-medium">{t('tablets', { count: 1 })}</span>
                  <button className="w-full mt-1 py-3 bg-[var(--color-given)] text-white rounded-md font-bold text-sm touch-manipulation">
                    ✅ {t('markGiven')}
                  </button>
                </div>
              </div>
            </section>
            
            {/* Placeholder empty states for other slots... */}
            <section className="bg-[var(--color-afternoon-bg)] rounded-xl p-4 border border-[var(--color-afternoon-accent)]">
              <h2 className="text-lg font-bold text-[var(--color-afternoon-text)] mb-3 flex items-center gap-2">
                🌤️ {t('afternoon')}
              </h2>
              <div className="h-20 flex items-center justify-center text-[var(--color-afternoon-text)] opacity-60 font-medium bg-white/40 rounded-lg">
                No medicines scheduled
              </div>
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
