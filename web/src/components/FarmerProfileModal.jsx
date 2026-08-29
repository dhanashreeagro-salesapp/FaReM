import React, { useState, useEffect } from 'react';
import { X, MapPin, Phone, User, Calendar, PlusCircle } from 'lucide-react';
import api from '../services/api';

export default function FarmerProfileModal({ isOpen, farmer, smartScore, tags, onClose, onLogVisit }) {
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && farmer) {
      fetchPlots();
    }
  }, [isOpen, farmer]);

  const fetchPlots = async () => {
    setLoading(true);
    try {
      const data = await api.getPlots({ farmer: farmer.id });
      setPlots(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error('Failed to fetch plots for farmer', error);
      setPlots([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !farmer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm">
      <div className="bg-surface w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-heading font-bold text-xl">
              {farmer.full_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-heading font-bold text-text">{farmer.full_name}</h2>
              <div className="flex items-center gap-2 text-sm text-text-muted mt-0.5">
                <MapPin size={14} />
                <span>{farmer.village} {farmer.taluka ? `, ${farmer.taluka}` : ''}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { onClose(); onLogVisit(farmer); }}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Log Visit
            </button>
            <button onClick={onClose} className="p-2 text-text-muted hover:bg-bg rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="bg-bg rounded-xl p-4 border border-border">
                <div className="text-xs text-text-muted mb-1 flex items-center gap-1"><Phone size={14}/> Phone</div>
                <div className="font-medium text-text">{farmer.primary_mobile || 'N/A'}</div>
             </div>
             <div className="bg-bg rounded-xl p-4 border border-border">
                <div className="text-xs text-text-muted mb-1 flex items-center gap-1"><Calendar size={14}/> Acquired</div>
                <div className="font-medium text-text">{farmer.acquisition_date || 'N/A'}</div>
             </div>
             <div className="bg-bg rounded-xl p-4 border border-border">
                <div className="text-xs text-text-muted mb-1 flex items-center gap-1"><User size={14}/> Total Acreage</div>
                <div className="font-medium text-text">{farmer.land_holding_acres || '0'} Acres</div>
             </div>
             {smartScore !== undefined && (
                <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                    <div className="text-xs text-primary/70 mb-1 font-semibold uppercase">Smart Score</div>
                    <div className="font-heading font-bold text-primary text-xl">{smartScore}</div>
                </div>
             )}
          </div>

          {tags && tags.length > 0 && (
              <div>
                  <h3 className="text-sm font-semibold text-text mb-2">Smart Tags</h3>
                  <div className="flex flex-wrap gap-2">
                      {tags.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-1 rounded-md bg-accent/10 text-accent border border-accent/20 font-medium">
                              {tag}
                          </span>
                      ))}
                  </div>
              </div>
          )}

          {/* Plots & Seasons */}
          <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-heading font-semibold text-text">Plots & Active Crops</h3>
            </div>
            
            {loading ? (
                <div className="text-center py-8 text-text-muted">Loading plots...</div>
            ) : plots.length === 0 ? (
                <div className="text-center py-8 bg-bg rounded-xl border border-border border-dashed text-text-muted">
                    No plots recorded for this farmer.
                </div>
            ) : (
                <div className="space-y-4">
                    {plots.map(plot => (
                        <div key={plot.id} className="bg-bg rounded-xl border border-border p-4">
                            <div className="flex items-center justify-between mb-3 pb-3 border-b border-border/50">
                                <div>
                                    <h4 className="font-semibold text-text">Plot: {plot.plot_name || 'Unnamed Plot'}</h4>
                                    <div className="text-sm text-text-muted">{plot.area_acres} Acres • {plot.soil_type || 'Unknown Soil'}</div>
                                </div>
                            </div>
                            
                            {plot.seasons && plot.seasons.filter(s => s.status === 'Active').length > 0 ? (
                                <div className="space-y-2">
                                    {plot.seasons.filter(s => s.status === 'Active').map(season => (
                                        <div key={season.id} className="flex items-center justify-between bg-surface rounded-lg p-3 border border-border/50">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded bg-success/10 text-success flex items-center justify-center font-bold text-xs">
                                                    {season.crop_name?.charAt(0) || 'C'}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-sm text-text">{season.crop_name}</div>
                                                    <div className="text-xs text-text-muted">Var: {season.variety_name || 'N/A'}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full inline-block">
                                                    {season.current_stage_name || 'Unknown Stage'}
                                                </div>
                                                <div className="text-[10px] text-text-muted mt-1">Sown: {season.sowing_date || 'N/A'}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-text-muted italic py-2">No active crops on this plot.</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
