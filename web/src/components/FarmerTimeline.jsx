import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { MapPin, PhoneCall, Award, MessageSquare, Send, Calendar, Clock, Loader2, ChevronRight } from 'lucide-react';

export default function FarmerTimeline({ farmerId }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  useEffect(() => {
    async function fetchTimeline() {
      setLoading(true);
      try {
        const res = await api.getFarmerTimeline(farmerId, page);
        if (page === 1) {
          setTimeline(res.timeline || []);
        } else {
          setTimeline(prev => [...prev, ...(res.timeline || [])]);
        }
        setHasNext(res.has_next);
      } catch (err) {
        console.error("Timeline fetch error:", err);
      }
      setLoading(false);
    }
    if (farmerId) fetchTimeline();
  }, [farmerId, page]);

  const getIcon = (type) => {
    switch (type) {
      case 'Visit':
        return <MapPin size={16} className="text-emerald-600" />;
      case 'Call':
        return <PhoneCall size={16} className="text-blue-600" />;
      case 'Recommendation':
        return <Award size={16} className="text-amber-600" />;
      case 'WhatsApp Message':
        return <MessageSquare size={16} className="text-emerald-500" />;
      case 'SMS Message':
        return <Send size={16} className="text-blue-500" />;
      default:
        return <Calendar size={16} className="text-primary" />;
    }
  };

  if (loading && page === 1) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted">
        <Loader2 size={24} className="animate-spin text-primary mr-2" />
        <span className="text-xs font-medium">Loading farmer activity timeline...</span>
      </div>
    );
  }

  if (!timeline.length) {
    return (
      <div className="text-center py-8 text-text-muted text-xs">
        No recorded visits, call logs, or recommendations found for this farmer.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative pl-6 border-l-2 border-border space-y-6">
        {timeline.map((item) => (
          <div key={item.id} className="relative group">
            {/* Timeline Icon Node */}
            <div className="absolute -left-[31px] top-0 p-1.5 bg-surface border-2 border-border group-hover:border-primary rounded-full transition-all shadow-sm">
              {getIcon(item.type)}
            </div>

            {/* Event Card */}
            <div className="bg-bg border border-border rounded-xl p-4 space-y-2 hover:border-primary/40 transition-all shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-heading font-bold text-text">{item.title}</span>
                <span className="text-[11px] text-text-muted font-mono">
                  {new Date(item.timestamp).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              <p className="text-xs text-text-muted font-medium">
                By: <span className="text-text font-semibold">{item.staff_name}</span>
              </p>

              {/* Event specific details */}
              {item.type === 'Visit' && (
                <div className="text-xs text-text space-y-1 bg-surface p-2.5 rounded-lg border border-border">
                  <p><strong>Notes:</strong> {item.details.notes || 'No notes'}</p>
                  <p><strong>Status:</strong> <span className="font-semibold text-emerald-600">{item.details.status}</span></p>
                  {item.details.photos?.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {item.details.photos.map((p, i) => (
                        <img key={i} src={p} alt="visit" className="w-12 h-12 object-cover rounded-lg border border-border" />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {item.type === 'Call' && (
                <div className="text-xs text-text space-y-1 bg-surface p-2.5 rounded-lg border border-border">
                  <p><strong>Notes:</strong> {item.details.notes || 'N/A'}</p>
                  {item.details.next_action && <p><strong>Next Action:</strong> {item.details.next_action}</p>}
                </div>
              )}

              {item.type === 'Recommendation' && (
                <div className="text-xs text-text space-y-1 bg-surface p-2.5 rounded-lg border border-border">
                  <p><strong>Dose:</strong> {item.details.dose} ({item.details.application_method})</p>
                  <p><strong>Timing:</strong> {item.details.timing}</p>
                  {item.details.notes && <p><strong>Notes:</strong> {item.details.notes}</p>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasNext && (
        <div className="text-center pt-2">
          <button
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 bg-surface border border-border hover:bg-bg rounded-xl text-xs font-semibold text-text transition-all"
          >
            Load Older Activities
          </button>
        </div>
      )}
    </div>
  );
}
