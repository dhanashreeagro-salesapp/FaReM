import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
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
          <img src="/agriamigo-logo.png" alt="AgriAmigo Logo" className="w-20 h-20 mx-auto mb-3 object-contain drop-shadow-md rounded-2xl" />
          <h1 className="text-2xl font-heading font-bold text-emerald-800 tracking-tight">AgriAmigo</h1>
          <p className="text-text-muted mt-1 text-sm font-medium">Farmer Relationship Management</p>
        </div>


        {error && (
          <div className="bg-red-50 border border-red-200 text-danger rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-muted mb-1.5">
                Email Address
              </label>
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@plantnutrition.in"
                className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-muted mb-1.5">
                Password
              </label>
              <input
                id="password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
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
