'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';

function MedicineReviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const prescriptionId = searchParams.get('prescription_id');

  const [prescription, setPrescription] = useState<any>(null);
  const [medicinesFound, setMedicinesFound] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!prescriptionId) return;

    const fetchPrescription = async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('id', prescriptionId)
        .single();
      
      if (!error && data) {
        setPrescription(data);
        // Simple heuristic: Split the messy raw OCR text by newlines and filter out empty strings
        if (data.ocr_raw_text) {
          const lines = data.ocr_raw_text.split('\\n').filter((l: string) => l.trim().length > 3);
          setMedicinesFound(lines);
        }
      }
      setLoading(false);
    };

    fetchPrescription();
  }, [prescriptionId, supabase]);

  if (loading) {
    return <div className="p-6 text-center mt-20 text-gray-500 animate-pulse">Loading prescription data...</div>
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <h2 className="text-xl font-bold mb-4">Review Medicines</h2>
      
      {prescription?.photo_url && (
        <div className="mb-6">
          <p className="text-sm text-gray-500 font-medium mb-2">Original Prescription</p>
          <img src={prescription.photo_url} alt="Prescription" className="w-full h-40 object-cover rounded-xl border border-gray-200" />
        </div>
      )}

      <div className="mb-6">
         <p className="text-sm text-gray-500 font-medium mb-2">Found Text (OCR Output)</p>
         <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm font-mono text-gray-700 h-40 overflow-y-auto whitespace-pre-wrap">
           {prescription?.ocr_raw_text || "No text could be extracted."}
         </div>
      </div>

      <button 
        onClick={() => router.push('/dashboard')}
        className="w-full py-4 bg-[var(--color-primary)] text-white font-bold rounded-xl text-lg shadow-sm"
      >
        Finish Setup & Go To Dashboard
      </button>
    </div>
  );
}

export default function MedicineReviewPage() {
  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <header className="py-6 mb-4">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">Setup Wizard</h1>
        <p className="text-gray-500 mt-1">Step 2 of 3</p>
      </header>
      
      <main className="space-y-6">
         <Suspense fallback={<div className="p-6 text-center text-gray-500">Loading...</div>}>
            <MedicineReviewContent />
         </Suspense>
      </main>
    </div>
  );
}
