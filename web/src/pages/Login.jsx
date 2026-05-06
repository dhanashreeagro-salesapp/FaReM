import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { sendOtp, login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('mobile'); // 'mobile' | 'otp'
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(mobile, otp);
      navigate('/');
    } catch (err) {
      console.error("Login error:", err);
      if (err.error) {
        setError(err.error);
      } else if (err.message) {
        setError("Network/Browser Error: " + err.message);
      } else {
        setError("Unknown Error: " + JSON.stringify(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4"
         style={{
           backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 39px, rgba(237,233,224,0.06) 39px, rgba(237,233,224,0.06) 40px)`
         }}>
      <div className="card p-8 w-full max-w-md animate-stagger-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-heading font-bold">D</span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-text">FFMA Admin</h1>
          <p className="text-text-muted mt-1 text-sm">Dhanashree Crop Solutions</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-danger rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

          <form onSubmit={handleVerifyOtp}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-muted mb-1.5">
                Registered Mobile Number (10 Digits)
              </label>
              <input
                id="mobile-input"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
                minLength={10}
                pattern="[0-9]{10}"
                title="Please enter exactly 10 digits"
                className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-lg"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-muted mb-1.5">
                Password (Testing Phase)
              </label>
              <input
                id="otp-input"
                type="password"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-lg"
                required
              />
            </div>

            <button
              id="verify-otp-btn"
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-heading font-semibold transition-all btn-press disabled:opacity-50"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
      </div>
    </div>
  );
}
