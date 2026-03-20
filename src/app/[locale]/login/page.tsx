'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Supabase allows sending a 6-digit OTP to the email. This is much faster
    // and completely free to test out of the box without any SMS configurations.
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
    });

    if (error) {
      setError(error.message);
    } else {
      setStep('OTP');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error } = await supabase.auth.verifyOtp({
      email: email,
      token: otp,
      type: 'email',
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Successfully logged in
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[var(--color-primary)] opacity-20 rounded-full mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">DawaiSathi</h1>
          <p className="text-gray-500 mt-2">Sign in to manage medicines</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium text-center">
            {error}
          </div>
        )}

        {step === 'EMAIL' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <div className="flex relative">
                <input
                  type="email"
                  required
                  placeholder="test@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all touch-manipulation text-lg"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !email.includes('@')}
              className="w-full py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl text-lg hover:bg-opacity-90 disabled:opacity-50 transition-opacity touch-manipulation mt-2"
            >
              {loading ? 'Sending Code...' : 'Get OTP Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enter 6-digit Code</label>
              <input
                type="text"
                required
                placeholder="000000"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all text-center tracking-widest text-2xl touch-manipulation"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <p className="text-sm text-center text-gray-500">
              We sent a code to <br/><span className="font-semibold text-gray-700">{email}</span>
            </p>
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl text-lg hover:bg-opacity-90 disabled:opacity-50 transition-opacity touch-manipulation mt-2"
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button
              type="button"
              onClick={() => setStep('EMAIL')}
              className="w-full py-2 text-gray-500 font-medium text-sm mt-2"
            >
              Change Email Address
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
