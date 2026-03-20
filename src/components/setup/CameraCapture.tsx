'use client';

import { useRef } from 'react';

export default function CameraCapture({ onCapture, isLoading }: { onCapture: (file: File) => void, isLoading: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onCapture(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <input
        type="file"
        accept="image/*"
        capture="environment" /* Defaults to rear camera on mobile */
        className="hidden"
        ref={fileInputRef}
        onChange={handleCapture}
      />
      <button 
        type="button"
        disabled={isLoading}
        onClick={() => fileInputRef.current?.click()}
        className="w-full py-4 bg-[var(--color-primary)] text-white rounded-xl font-bold text-lg hover:bg-opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 shadow-sm touch-manipulation"
      >
        {isLoading ? (
          <span className="animate-pulse">Processing...</span>
        ) : (
          <>
            <span className="text-2xl">📸</span> Take Photo
          </>
        )}
      </button>
    </div>
  );
}
