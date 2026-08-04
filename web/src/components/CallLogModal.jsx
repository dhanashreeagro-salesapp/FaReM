import React, { useState } from 'react';
import api from '../services/api';
import { offlineQueue } from '../utils/offlineQueue';
import { Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, X, Loader2, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';

export default function CallLogModal({ farmer, onClose, onSuccess }) {
  const [direction, setDirection] = useState('Outgoing');
  const [outcome, setOutcome] = useState('Interested');
  const [notes, setNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(60);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const outcomes = [
    'Interested',
    'Not Interested',
    'Follow-up Required',
    'No Answer',
    'Busy',
    'Switched Off',
    'Complaint',
    'Other'
  ];

  const handleDialNumber = () => {
    if (farmer?.primary_mobile) {
      window.location.href = `tel:${farmer.primary_mobile}`;
    }
  };

  const handleSaveCallLog = async () => {
    if (!farmer) return;

    setLoading(true);
    setError(null);

    const payload = {
      farmer: farmer.id,
      direction,
      outcome,
      duration: parseInt(durationSeconds) || 60,
      notes,
      next_action: nextAction,
      followup_date: followupDate || null
    };

    try {
      if (!navigator.onLine) {
        offlineQueue.saveCall(payload);
        alert("Offline mode: Call log saved locally and will auto-sync on network reconnection!");
        if (onSuccess) onSuccess();
        onClose();
        return;
      }

      const res = await api.createCallLog(payload);
      if (onSuccess) onSuccess(res);
      onClose();
    } catch (err) {
      setError(err.error || "Failed to log call");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 my-8">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <PhoneCall size={22} />
            </div>
            <div>
              <h3 className="text-lg font-heading font-bold text-text">Call Log & Summary</h3>
              <p className="text-xs text-text-muted">{farmer?.full_name} ({farmer?.primary_mobile})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text rounded-lg hover:bg-bg">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-danger text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Click To Call Action Button */}
        <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl flex items-center justify-between">
          <div className="text-xs">
            <p className="font-semibold text-blue-900">Native Phone Dialer</p>
            <p className="text-blue-700">Dial farmer using registered mobile</p>
          </div>
          <button
            type="button"
            onClick={handleDialNumber}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-sm"
          >
            <Phone size={14} />
            <span>Call Now</span>
          </button>
        </div>

        {/* Direction Selector */}
        <div>
          <label className="block text-xs font-semibold text-text mb-1.5">Call Direction</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('Outgoing')}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                direction === 'Outgoing'
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-bg border-border text-text-muted hover:text-text'
              }`}
            >
              <PhoneOutgoing size={14} />
              <span>Outgoing Call</span>
            </button>
            <button
              type="button"
              onClick={() => setDirection('Incoming')}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                direction === 'Incoming'
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-bg border-border text-text-muted hover:text-text'
              }`}
            >
              <PhoneIncoming size={14} />
              <span>Incoming Call</span>
            </button>
          </div>
        </div>

        {/* Outcome Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-text mb-1.5">Call Outcome</label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-sm font-medium text-text focus:ring-2 focus:ring-primary/20 outline-none"
          >
            {outcomes.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        {/* Call Duration */}
        <div>
          <label className="block text-xs font-semibold text-text mb-1.5">Call Duration (seconds)</label>
          <input
            type="number"
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-sm font-medium text-text focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>

        {/* Multiline Notes */}
        <div>
          <label className="block text-xs font-semibold text-text mb-1.5">Call Summary & Discussion</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Key points discussed during the phone call..."
            className="w-full p-3 bg-bg border border-border rounded-xl text-sm text-text focus:ring-2 focus:ring-primary/20 outline-none resize-none"
          />
        </div>

        {/* Follow-up Details */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">Next Action</label>
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="e.g. Send WhatsApp brochure"
              className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-xs text-text outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">Follow-up Date</label>
            <input
              type="date"
              value={followupDate}
              onChange={(e) => setFollowupDate(e.target.value)}
              className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-xs text-text outline-none"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-3 border-t border-border flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-border text-text-muted hover:bg-bg rounded-xl text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleSaveCallLog}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-md transition-all"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            <span>Save Call Summary</span>
          </button>
        </div>

      </div>
    </div>
  );
}
