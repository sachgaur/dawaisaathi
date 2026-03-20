'use client';

import { Link, usePathname } from '@/i18n/routing';
import { CalendarClock, History, Settings } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-50">
      <div className="flex justify-around items-center h-16 px-4">
        <Link 
          href="/dashboard" 
          className={`flex flex-col items-center justify-center w-20 flex-1 h-full gap-1 transition-colors ${pathname === '/dashboard' ? 'text-[var(--color-primary)]' : 'text-gray-400'}`}
        >
          <CalendarClock size={24} strokeWidth={pathname === '/dashboard' ? 2.5 : 2} />
          <span className="text-xs font-semibold">Schedule</span>
        </Link>
        
        <Link 
          href="/history" 
          className={`flex flex-col items-center justify-center w-20 flex-1 h-full gap-1 transition-colors ${pathname === '/history' ? 'text-[var(--color-primary)]' : 'text-gray-400'}`}
        >
          <History size={24} strokeWidth={pathname === '/history' ? 2.5 : 2} />
          <span className="text-xs font-semibold">History</span>
        </Link>
        
        <Link 
          href="/settings" 
          className={`flex flex-col items-center justify-center w-20 flex-1 h-full gap-1 transition-colors ${pathname === '/settings' ? 'text-[var(--color-primary)]' : 'text-gray-400'}`}
        >
          <Settings size={24} strokeWidth={pathname === '/settings' ? 2.5 : 2} />
          <span className="text-xs font-semibold">Settings</span>
        </Link>
      </div>
    </nav>
  );
}
