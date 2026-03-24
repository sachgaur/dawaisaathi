'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/utils/image';
import CameraCapture from '@/components/setup/CameraCapture';

export default function PrescriptionUploadPage() {
  const t = useTranslations('setup');
  const router = useRouter();
  const supabase = createClient();
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handlePhotoCapture = (file: File) => {
    setSelectedFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setError('');

    try {
      // 2. Compress image using Canvas API
      const compressedBlob = await compressImage(selectedFile, 1200, 0.8);
      const compressedFile = new File([compressedBlob], `prescription_${Date.now()}.jpg`, { type: 'image/jpeg' });

      // 3. Upload to Supabase Storage
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("You must be logged in to upload a prescription.");

      const filePath = `${userData.user.id}/${compressedFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('prescriptions')
        .upload(filePath, compressedFile);

      if (uploadError) throw new Error("Failed to upload image. Please ensure the 'prescriptions' storage bucket is created and public in your Supabase dashboard.");

      // 4. Get Public URL
      const { data: publicUrlData } = supabase.storage.from('prescriptions').getPublicUrl(filePath);
      
      // 5. Connect to Google Cloud Vision API
      const ocrResponse = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: publicUrlData.publicUrl }),
      });
      const ocrData = await ocrResponse.json();

      if (!ocrResponse.ok) throw new Error(ocrData.error || 'Failed to read prescription text via OCR');

      // 6. Save the prescription record to the database
      const { data: caregiver } = await supabase.from('caregivers').select('patient_id').eq('user_id', userData.user.id).limit(1).single();
      
      const { data: prescription, error: prescriptionError } = await supabase
        .from('prescriptions')
        .insert({
          patient_id: caregiver?.patient_id,
          photo_url: publicUrlData.publicUrl,
          ocr_raw_text: ocrData.rawText,
          created_by: userData.user.id
        })
        .select()
        .single();
      
      if (prescriptionError) throw new Error("Failed to save prescription to database: " + prescriptionError.message);

      // 7. Route to the Medicine Review screen
      router.push(`/setup/medicines?prescription_id=${prescription.id}`);
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <header className="py-6 mb-4">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">Setup Wizard</h1>
        <p className="text-gray-500 mt-1">Step 1 of 3</p>
      </header>
      
      <main className="space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-2">{t('step1')}</h2>
          <p className="text-gray-600 mb-6">
            To get started, please take a clear photograph of the doctor's prescription. We will automatically extract the medicines for you.
          </p>

          {error && (
            <div className="p-3 mb-6 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          {photoPreview ? (
            <div className="space-y-4">
              <img src={photoPreview} alt="Prescription preview" className="w-full h-64 object-cover rounded-xl border border-gray-200" />
              <div className="flex gap-2">
                <button 
                  onClick={() => { setPhotoPreview(null); setSelectedFile(null); }}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl active:bg-gray-200 transition-colors"
                >
                  Retake
                </button>
                <button 
                  onClick={handleConfirmUpload}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl active:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {isProcessing ? 'Analyzing AI...' : 'Confirm'}
                </button>
              </div>
            </div>
          ) : (
            <CameraCapture onCapture={handlePhotoCapture} isLoading={isProcessing} />
          )}

        </div>
      </main>
    </div>
  );
}
