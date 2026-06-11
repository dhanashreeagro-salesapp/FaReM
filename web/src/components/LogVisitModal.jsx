import React, { useState } from 'react';
import api from '../services/api';
import { X } from 'lucide-react';

export default function LogVisitModal({ isOpen, onClose, farmer, onVisitLogged }) {
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !farmer) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const time = now.toTimeString().split(' ')[0];

      await api.logActivity({
        farmer: farmer.id,
        activity_type: 'Visit',
        date,
        time,
        visit_purpose: purpose,
        notes,
      });
      onVisitLogged();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to log visit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl w-full max-w-md p-6 border border-border shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-heading font-semibold text-text">Log Visit</h3>
          <button onClick={onClose} className="p-2 hover:bg-bg rounded-lg text-text-muted transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="mb-6 p-4 bg-primary/5 rounded-xl border border-primary/10">
            <p className="text-sm text-text-muted">Farmer</p>
            <p className="font-medium text-text">{farmer.full_name}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-danger/10 text-danger rounded-xl text-sm border border-danger/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Purpose of Visit</label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text focus:outline-none focus:border-primary transition-colors"
              placeholder="e.g. Routine Check, Pest Issue"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Notes / Observations</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text focus:outline-none focus:border-primary transition-colors h-32 resize-none"
              placeholder="Add any details about crop health or farmer requests..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-text hover:bg-bg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? 'Saving...' : 'Save Visit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
