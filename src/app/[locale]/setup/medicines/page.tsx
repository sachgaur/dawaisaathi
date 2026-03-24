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
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!prescriptionId) return;

    const fetchPrescription = async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, patients(*)')
        .eq('id', prescriptionId)
        .single();
      
      if (!error && data) {
        setPrescription(data);
        if (data.ocr_raw_text) {
          try {
            const parsed = JSON.parse(data.ocr_raw_text);
            if (Array.isArray(parsed)) {
              // Format for React State
              setMedicines(parsed.map(med => ({
                name: med.name || '',
                dosage: med.dosage || '',
                instructions: med.instructions || '',
                id: crypto.randomUUID() // Local UI id
              })));
            }
          } catch(e) {
            console.error("Could not parse AI response as JSON:", data.ocr_raw_text);
          }
        }
      }
      setLoading(false);
    };

    fetchPrescription();
  }, [prescriptionId, supabase]);

  const updateMedicine = (id: string, field: string, value: string) => {
    setMedicines(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const addMedicine = () => {
    setMedicines([...medicines, { name: '', dosage: '', instructions: '', id: crypto.randomUUID() }]);
  };

  const removeMedicine = (id: string) => {
    setMedicines(prev => prev.filter(m => m.id !== id));
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      // Prepare medicines for insertion
      const inserts = medicines.filter(m => m.name.trim() !== '').map((m, index) => ({
        patient_id: prescription.patient_id,
        prescription_id: prescription.id,
        name: m.name,
        instructions: `${m.dosage} - ${m.instructions}`,
        sort_order: index
      }));

      if (inserts.length === 0) {
        alert("Please add at least one valid medicine");
        setSaving(false);
        return;
      }

      // Bulk insert into the `medicines` table
      const { data, error } = await supabase.from('medicines').insert(inserts).select();
      if (error) throw error;

      // Navigate to the Scheduling / Photo step
      router.push(`/setup/schedule?prescription_id=${prescription.id}`);
    } catch(err) {
      alert("Error saving medicines");
      console.error(err);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-6 text-center mt-20 text-gray-500 animate-pulse">Loading prescription data...</div>

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <h2 className="text-xl font-bold mb-1">Verify Medicines</h2>
      <p className="text-gray-500 text-sm mb-6">Review the AI extraction. You can edit names, add any that were missed, or delete incorrect ones.</p>

      <div className="space-y-4 mb-6">
         {medicines.map((med, idx) => (
           <div key={med.id} className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col gap-3 relative">
             <button onClick={() => removeMedicine(med.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 font-bold p-2">✕</button>
             
             <div>
               <label className="text-xs font-bold text-gray-500 uppercase">Medicine Name</label>
               <input type="text" value={med.name} onChange={e => updateMedicine(med.id, 'name', e.target.value)} className="w-full bg-white border border-gray-200 rounded px-3 py-2 mt-1 outline-none focus:border-blue-400 font-bold" placeholder="e.g. Paracetamol 500mg"/>
             </div>
             
             <div className="flex gap-2">
               <div className="flex-1">
                 <label className="text-xs font-bold text-gray-500 uppercase">Dosage</label>
                 <input type="text" value={med.dosage} onChange={e => updateMedicine(med.id, 'dosage', e.target.value)} className="w-full bg-white border border-gray-200 rounded px-3 py-2 mt-1 outline-none focus:border-blue-400 text-sm" placeholder="1 tablet"/>
               </div>
               <div className="flex-1">
                 <label className="text-xs font-bold text-gray-500 uppercase">Notes</label>
                 <input type="text" value={med.instructions} onChange={e => updateMedicine(med.id, 'instructions', e.target.value)} className="w-full bg-white border border-gray-200 rounded px-3 py-2 mt-1 outline-none focus:border-blue-400 text-sm" placeholder="After food"/>
               </div>
             </div>
           </div>
         ))}
      </div>

      <button onClick={addMedicine} className="w-full py-3 mb-6 bg-gray-100 text-[var(--color-primary)] font-bold rounded-xl active:bg-gray-200 border border-gray-200 flex items-center justify-center gap-2">
        <span>+</span> Add Another Medicine Manually
      </button>

      <button 
        onClick={handleConfirm}
        disabled={saving || medicines.length === 0}
        className="w-full py-4 bg-[var(--color-primary)] text-white font-bold rounded-xl text-lg shadow-sm disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Confirm & Schedule'}
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
