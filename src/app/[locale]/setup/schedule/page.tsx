'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/utils/image';
import CameraCapture from '@/components/setup/CameraCapture';

const TIME_SLOTS = [
  { id: 'morning', label: 'Morning', icon: '🌅', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { id: 'afternoon', label: 'Afternoon', icon: '🌤️', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { id: 'evening', label: 'Evening', icon: '🌇', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'night', label: 'Night', icon: '🌙', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' }
];

function ScheduleWizardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const prescriptionId = searchParams.get('prescription_id');

  const [medicines, setMedicines] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form State for Active Medicine
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [doseCount, setDoseCount] = useState('1');

  useEffect(() => {
    if (!prescriptionId) return;

    const fetchMedicines = async () => {
      const { data, error } = await supabase
        .from('medicines')
        .select('*')
        .eq('prescription_id', prescriptionId)
        .order('sort_order', { ascending: true });
      
      if (!error && data) setMedicines(data);
      setLoading(false);
    };

    fetchMedicines();
  }, [prescriptionId, supabase]);

  const handlePhotoCapture = (file: File) => {
    setSelectedFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const toggleSlot = (slotId: string) => {
    setSelectedSlots(prev => prev.includes(slotId) ? prev.filter(s => s !== slotId) : [...prev, slotId]);
  };

  const handleSaveMedicine = async () => {
    if (selectedSlots.length === 0) {
      alert("Please select at least one time slot.");
      return;
    }
    
    setIsProcessing(true);
    try {
      const activeMed = medicines[currentStep];
      let finalPhotoUrl = activeMed.photo_url;

      // 1. Upload Photo to general Prescriptions bucket but in a specific medicines folder
      if (selectedFile) {
        const { data: userData } = await supabase.auth.getUser();
        const compressedBlob = await compressImage(selectedFile, 800, 0.7);
        const compressedFile = new File([compressedBlob], `med_${activeMed.id}.jpg`, { type: 'image/jpeg' });
        
        const filePath = `${userData.user?.id}/medicines/${compressedFile.name}`;
        await supabase.storage.from('prescriptions').upload(filePath, compressedFile, { upsert: true });
        
        const { data: publicUrlData } = supabase.storage.from('prescriptions').getPublicUrl(filePath);
        finalPhotoUrl = publicUrlData.publicUrl;

        await supabase.from('medicines').update({ photo_url: finalPhotoUrl }).eq('id', activeMed.id);
      }

      // 2. Insert schedule entries
      const scheduleInserts = selectedSlots.map(slot => ({
        medicine_id: activeMed.id,
        patient_id: activeMed.patient_id,
        time_slot: slot,
        dose_count: parseFloat(doseCount) || 1
      }));

      const { error: insertError } = await supabase.from('schedule_entries').insert(scheduleInserts);
      if (insertError) throw insertError;

      // 3. Move to next step or finish wizard
      if (currentStep + 1 < medicines.length) {
        setCurrentStep(prev => prev + 1);
        setPhotoPreview(null);
        setSelectedFile(null);
        setSelectedSlots([]);
        setDoseCount('1');
      } else {
        router.push('/dashboard');
      }
    } catch(err: any) {
      alert("Error saving schedule: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div className="p-6 text-center mt-20 text-gray-500 animate-pulse">Loading medicine queue...</div>
  if (medicines.length === 0) return <div className="p-6 text-center mt-20">No medicines found.</div>

  const activeMed = medicines[currentStep];

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Schedule & Photos</h2>
        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">
          {currentStep + 1} of {medicines.length}
        </span>
      </div>

      <div className="bg-blue-50 p-4 rounded-xl mb-6">
        <h3 className="text-xl font-bold">{activeMed.name}</h3>
        <p className="text-sm text-gray-600 mt-1">{activeMed.instructions}</p>
      </div>

      <div className="mb-8">
        <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase">1. Add Strip Photo</h4>
        {photoPreview ? (
          <div className="space-y-3">
             <img src={photoPreview} alt="Medicine strip" className="w-full h-48 object-cover rounded-xl border border-gray-200 shadow-sm" />
             <button onClick={() => { setPhotoPreview(null); setSelectedFile(null); }} className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl">Retake Photo</button>
          </div>
        ) : (
          <CameraCapture onCapture={handlePhotoCapture} isLoading={false} />
        )}
      </div>

      <div className="mb-8">
         <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase">2. When to take it?</h4>
         <div className="grid grid-cols-2 gap-3">
            {TIME_SLOTS.map(slot => {
              const isSelected = selectedSlots.includes(slot.id);
              return (
                <button 
                  key={slot.id}
                  onClick={() => toggleSlot(slot.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all touch-manipulation ${isSelected ? slot.color + ' border-current scale-95 shadow-sm' : 'bg-gray-50 border-gray-100 text-gray-500'}`}
                >
                  <span className="text-2xl mb-1">{slot.icon}</span>
                  <span className="font-bold text-sm">{slot.label}</span>
                </button>
              )
            })}
         </div>
      </div>

      <div className="mb-8">
         <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase">3. How much to take?</h4>
         <input type="number" step="0.5" value={doseCount} onChange={(e) => setDoseCount(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-xl text-center outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
      </div>

      <button 
        onClick={handleSaveMedicine}
        disabled={isProcessing || selectedSlots.length === 0}
        className="w-full py-4 bg-[var(--color-primary)] text-white font-bold rounded-xl text-lg shadow-sm disabled:opacity-50"
      >
        {isProcessing ? 'Saving...' : (currentStep + 1 === medicines.length ? 'Finish Setup' : 'Save & Next')}
      </button>
    </div>
  );
}

export default function ScheduleWizardPage() {
  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <header className="py-6 mb-4">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">Setup Wizard</h1>
        <p className="text-gray-500 mt-1">Final Step</p>
      </header>
      
      <main className="space-y-6">
         <Suspense fallback={<div className="p-6 text-center text-gray-500">Loading...</div>}>
            <ScheduleWizardContent />
         </Suspense>
      </main>
    </div>
  );
}
