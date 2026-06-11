import React, { useState, useEffect } from 'react';
import { X, Send, Calendar, Clock, RefreshCw } from 'lucide-react';
import api from '../services/api';

export default function SendMessageModal({ farmerIds, onClose, onSuccess }) {
  const [promotions, setPromotions] = useState([]);
  const [selectedPromo, setSelectedPromo] = useState('');
  const [channel, setChannel] = useState('WhatsApp');
  const [scheduleMode, setScheduleMode] = useState('Immediate'); // Immediate, Scheduled, Recurring
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [frequency, setFrequency] = useState('Daily');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPromos = async () => {
      try {
        const data = await api.getPromotions();
        setPromotions(data.results || data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchPromos();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPromo) return alert('Please select a promotion message.');
    
    setLoading(true);
    try {
      const payload = {
        content: selectedPromo,
        channel: channel,
        farmer_ids: farmerIds,
      };
      
      if (scheduleMode !== 'Immediate') {
        if (!startDate) {
          setLoading(false);
          return alert('Please select a start date.');
        }
        payload.scheduled_start_date = startDate;
      }
      
      if (scheduleMode === 'Recurring') {
        if (!endDate) {
          setLoading(false);
          return alert('Please select an end date for recurring messages.');
        }
        payload.frequency = frequency;
        payload.scheduled_end_date = endDate;
      } else {
        payload.frequency = 'Once';
      }

      await api.createBulkSend(payload);
      onSuccess();
    } catch (e) {
      alert('Failed to schedule messages.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-bg rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-stagger-in">
        <div className="flex justify-between items-center p-4 border-b border-border bg-surface">
          <h3 className="font-heading font-semibold text-text">Send Message ({farmerIds.length} farmers)</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-text mb-1">Select Message Template *</label>
            <select 
              required
              value={selectedPromo}
              onChange={e => setSelectedPromo(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="">-- Choose Template --</option>
              {promotions.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text mb-1">Channel *</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                <input type="radio" name="channel" value="WhatsApp" checked={channel === 'WhatsApp'} onChange={() => setChannel('WhatsApp')} className="text-primary" />
                WhatsApp
              </label>
              <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                <input type="radio" name="channel" value="SMS" checked={channel === 'SMS'} onChange={() => setChannel('SMS')} className="text-primary" />
                SMS
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text mb-2">Schedule</label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2 text-sm text-text cursor-pointer p-2 border border-border rounded-lg flex-1 justify-center bg-surface hover:bg-bg transition-colors" style={{borderColor: scheduleMode === 'Immediate' ? 'var(--color-primary)' : ''}}>
                <input type="radio" name="scheduleMode" className="hidden" checked={scheduleMode === 'Immediate'} onChange={() => setScheduleMode('Immediate')} />
                <Send size={14} className={scheduleMode === 'Immediate' ? 'text-primary' : 'text-text-muted'} /> Immediate
              </label>
              <label className="flex items-center gap-2 text-sm text-text cursor-pointer p-2 border border-border rounded-lg flex-1 justify-center bg-surface hover:bg-bg transition-colors" style={{borderColor: scheduleMode === 'Scheduled' ? 'var(--color-primary)' : ''}}>
                <input type="radio" name="scheduleMode" className="hidden" checked={scheduleMode === 'Scheduled'} onChange={() => setScheduleMode('Scheduled')} />
                <Clock size={14} className={scheduleMode === 'Scheduled' ? 'text-primary' : 'text-text-muted'} /> Schedule
              </label>
              <label className="flex items-center gap-2 text-sm text-text cursor-pointer p-2 border border-border rounded-lg flex-1 justify-center bg-surface hover:bg-bg transition-colors" style={{borderColor: scheduleMode === 'Recurring' ? 'var(--color-primary)' : ''}}>
                <input type="radio" name="scheduleMode" className="hidden" checked={scheduleMode === 'Recurring'} onChange={() => setScheduleMode('Recurring')} />
                <RefreshCw size={14} className={scheduleMode === 'Recurring' ? 'text-primary' : 'text-text-muted'} /> Recurring
              </label>
            </div>

            {scheduleMode !== 'Immediate' && (
              <div className="grid grid-cols-2 gap-4 bg-surface p-3 rounded-lg border border-border">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Start Date *</label>
                  <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded text-sm bg-bg focus:ring-1 focus:ring-primary focus:outline-none" />
                </div>
                
                {scheduleMode === 'Recurring' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-text-muted mb-1">Frequency *</label>
                      <select value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded text-sm bg-bg focus:ring-1 focus:ring-primary focus:outline-none">
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-text-muted mb-1">End Date *</label>
                      <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded text-sm bg-bg focus:ring-1 focus:ring-primary focus:outline-none" />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-border gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg disabled:opacity-50 btn-press">
              {loading ? 'Processing...' : 'Send Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
