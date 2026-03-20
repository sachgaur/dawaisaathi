import { getTranslations } from 'next-intl/server';
import BottomNav from '@/components/shared/BottomNav';

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="px-4 py-6 bg-white shadow-sm sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">{t('title')}</h1>
          <p className="text-sm text-gray-500">Pitaji • Today</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] opacity-20"></div>
      </header>
      
      <main className="p-4 space-y-4">
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
            
            <div className="min-w-[140px] snap-center bg-white rounded-lg p-3 shadow-sm flex flex-col items-center gap-2 relative">
              <div className="w-16 h-16 bg-gray-100 border border-gray-200 rounded-md"></div>
              <span className="font-bold text-center leading-tight">Metoprolol</span>
              <span className="text-sm text-gray-600 font-medium">{t('tablets', { count: 0.5 })}</span>
              <button className="w-full mt-1 py-3 bg-[var(--color-given)] text-white rounded-md font-bold text-sm touch-manipulation">
                ✅ {t('markGiven')}
              </button>
            </div>
          </div>
        </section>

        {/* Afternoon */}
        <section className="bg-[var(--color-afternoon-bg)] rounded-xl p-4 border border-[var(--color-afternoon-accent)]">
          <h2 className="text-lg font-bold text-[var(--color-afternoon-text)] mb-3 flex items-center gap-2">
            🌤️ {t('afternoon')}
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
            <div className="min-w-[140px] snap-center bg-white rounded-lg p-3 shadow-sm flex flex-col items-center gap-2 relative opacity-60">
              <div className="absolute top-2 right-2  bg-[var(--color-given)] text-white text-xs px-2 py-1 rounded-full z-10 font-bold flex items-center gap-1">
                ✅ {t('markGiven')}
              </div>
              <div className="w-16 h-16 bg-gray-100 border border-gray-200 rounded-md"></div>
              <span className="font-bold text-center leading-tight">Vitamin D3</span>
              <span className="text-sm text-gray-600 font-medium">{t('tablets', { count: 1 })}</span>
              <button className="w-full mt-1 py-3 bg-gray-200 text-gray-500 rounded-md font-bold text-sm touch-manipulation pointer-events-none">
                {t('markGiven')}
              </button>
            </div>
          </div>
        </section>

        {/* Evening */}
        <section className="bg-[var(--color-evening-bg)] rounded-xl p-4 border border-[var(--color-evening-accent)]">
          <h2 className="text-lg font-bold text-[var(--color-evening-text)] mb-3 flex items-center gap-2">
            🌇 {t('evening')}
          </h2>
          <div className="h-20 flex items-center justify-center text-[var(--color-evening-text)] opacity-60 font-medium bg-white/40 rounded-lg">
            No medicines scheduled
          </div>
        </section>

        {/* Night */}
        <section className="bg-[var(--color-night-bg)] rounded-xl p-4 border border-[var(--color-night-accent)]">
          <h2 className="text-lg font-bold text-[var(--color-night-text)] mb-3 flex items-center gap-2">
            🌙 {t('night')}
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
            <div className="min-w-[140px] snap-center bg-white rounded-lg p-3 shadow-sm flex flex-col items-center gap-2 relative">
              <div className="w-16 h-16 bg-gray-100 border border-gray-200 rounded-md"></div>
              <span className="font-bold text-center leading-tight">Atorvastatin</span>
              <span className="text-sm text-gray-600 font-medium">{t('tablets', { count: 1 })}</span>
              <button className="w-full mt-1 py-3 bg-gray-100 text-gray-700 border border-gray-300 rounded-md font-bold text-sm touch-manipulation hover:bg-[var(--color-given)] hover:text-white hover:border-transparent transition-colors">
                {t('markGiven')}
              </button>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
