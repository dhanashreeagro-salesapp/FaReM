import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Calendar, Clock, UserCheck, MapPin, BarChart2, Loader2 } from 'lucide-react';

export default function WeeklyVisitSummary() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSummary() {
      try {
        const res = await api.getWeeklyVisitSummary();
        setSummary(res);
      } catch (err) {
        console.error("Failed to fetch weekly visit summary:", err);
      }
      setLoading(false);
    }
    loadSummary();
  }, []);

  if (loading) {
    return (
      <div className="p-4 bg-surface border border-border rounded-2xl flex items-center justify-center text-xs text-text-muted">
        <Loader2 size={16} className="animate-spin text-primary mr-2" />
        <span>Aggregating weekly field visits...</span>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="p-5 bg-surface border border-border rounded-2xl shadow-sm space-y-4">
      <div className="flex justify-between items-center border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <BarChart2 size={18} />
          </div>
          <div>
            <h4 className="text-sm font-heading font-bold text-text">Weekly Visit Summary</h4>
            <p className="text-[11px] text-text-muted">Week of {summary.start_of_week}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-bg border border-border rounded-xl">
          <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
            <MapPin size={14} className="text-emerald-600" />
            <span>Total Visits</span>
          </div>
          <p className="text-lg font-heading font-bold text-text">{summary.total_visits}</p>
        </div>

        <div className="p-3 bg-bg border border-border rounded-xl">
          <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
            <UserCheck size={14} className="text-blue-600" />
            <span>Unique Farmers</span>
          </div>
          <p className="text-lg font-heading font-bold text-text">{summary.unique_farmers}</p>
        </div>

        <div className="p-3 bg-bg border border-border rounded-xl">
          <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
            <Clock size={14} className="text-amber-600" />
            <span>Hours Spent</span>
          </div>
          <p className="text-lg font-heading font-bold text-text">{summary.hours_spent} hrs</p>
        </div>

        <div className="p-3 bg-bg border border-border rounded-xl">
          <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
            <Calendar size={14} className="text-purple-600" />
            <span>Avg Duration</span>
          </div>
          <p className="text-lg font-heading font-bold text-text">{summary.average_duration_minutes} mins</p>
        </div>
      </div>

      {summary.purpose_breakdown && Object.keys(summary.purpose_breakdown).length > 0 && (
        <div>
          <span className="text-xs font-semibold text-text mb-2 block">Purpose Breakdown</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.purpose_breakdown).map(([purpose, count]) => (
              <span key={purpose} className="px-2.5 py-1 bg-bg border border-border rounded-lg text-xs font-medium text-text">
                {purpose}: <strong className="text-primary">{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
