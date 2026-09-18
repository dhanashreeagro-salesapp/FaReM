import React, { useState, useEffect } from 'react';
import { X, Send, Calendar, Clock, RefreshCw, Search, ChevronDown, Sparkles } from 'lucide-react';
import api from '../services/api';

export default function SendMessageModal({ farmerIds, onClose, onSuccess, initialData, mode = 'create' }) {
  const [promotions, setPromotions] = useState([]);
  const [selectedPromo, setSelectedPromo] = useState(initialData?.content || '');
  const [channel, setChannel] = useState(initialData?.channel || 'WhatsApp');
  const [scheduleMode, setScheduleMode] = useState(initialData?.scheduleMode || 'Immediate');
  const [startDate, setStartDate] = useState(initialData?.startDate || '');
  const [loading, setLoading] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sentFarmers, setSentFarmers] = useState({});
  const [campaignLogged, setCampaignLogged] = useState(false);
  const [robustFarmers, setRobustFarmers] = useState(farmerIds);

  const filters = initialData?.filters || {};
  const { crop: filterCrop, stage: filterStage } = filters;
  
  const justIds = robustFarmers.map(f => typeof f === 'object' ? f.id : f);
  const isManualWhatsApp = channel === 'WhatsApp' && scheduleMode === 'Immediate' && justIds.length <= 5 && typeof robustFarmers[0] === 'object';

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

  useEffect(() => {
    const upgradeFarmers = async () => {
      if (farmerIds.length > 0 && typeof farmerIds[0] === 'string' && farmerIds.length <= 5) {
        setLoading(true);
        try {
          const detailed = await Promise.all(
            farmerIds.map(id => api.request(`/farmers/${id}/`))
          );
          setRobustFarmers(detailed);
        } catch (err) {
          console.error("Failed to upgrade farmer IDs", err);
        } finally {
          setLoading(false);
        }
      } else {
        setRobustFarmers(farmerIds);
      }
    };
    upgradeFarmers();
  }, [farmerIds]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPromo) return alert('Please select a promotion message.');
    
    if (isManualWhatsApp && Object.keys(sentFarmers).length === 0) {
      return alert('Please click the "Send WhatsApp" button for at least one farmer before finishing.');
    }
    
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
      
      if (mode === 'edit') {
        await api.updateBulkSend(initialData.id, payload);
      } else {
        // If it's a manual WhatsApp and it hasn't been logged yet, log it now
        if (isManualWhatsApp && !campaignLogged) {
          await api.createBulkSend(payload);
          setCampaignLogged(true);
        } else if (!isManualWhatsApp) {
          await api.createBulkSend(payload);
        }
      }

      onSuccess();
    } catch (e) {
      let errMsg = 'Unknown error';
      if (typeof e === 'object' && e !== null) {
        errMsg = e.detail || e.error || e.message || JSON.stringify(e);
      } else {
        errMsg = String(e);
      }
      alert(`Failed to ${mode === 'edit' ? 'update' : 'schedule'} messages. Error: ${errMsg}`);
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
          <div className="relative">
            <label className="block text-sm font-semibold text-text mb-1">Select Message Template *</label>
            <div 
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface cursor-pointer flex justify-between items-center"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <span className="truncate">
                {selectedPromo ? promotions.find(p => String(p.id) === String(selectedPromo))?.title || 'Selected' : '-- Choose Template --'}
              </span>
              <ChevronDown size={16} className="text-text-muted shrink-0" />
            </div>

            {dropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-60 flex flex-col">
                <div className="p-2 border-b border-border sticky top-0 bg-white">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-text-muted" />
                    <input 
                      type="text"
                      placeholder="Search templates..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full pl-8 pr-2 py-1.5 text-sm border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 p-1">
                  {(() => {
                    let suggested = [];
                    let others = [];
                    const query = templateSearch.toLowerCase();
                    
                    promotions.forEach(p => {
                      const matchSearch = p.title?.toLowerCase().includes(query) || p.whatsapp_template?.toLowerCase().includes(query) || p.sms_template?.toLowerCase().includes(query);
                      if (!matchSearch) return;

                      let isSuggested = false;
                      if (filterCrop) {
                        if (filterStage) {
                          if (p.crop_name === filterCrop && p.stage_name === filterStage) isSuggested = true;
                        } else {
                          if (p.crop_name === filterCrop) isSuggested = true;
                        }
                      }
                      
                      if (isSuggested) suggested.push(p);
                      else others.push(p);
                    });

                    if (suggested.length === 0 && others.length === 0) {
                      return <div className="p-3 text-center text-xs text-text-muted">No templates found.</div>;
                    }

                    return (
                      <>
                        {suggested.length > 0 && (
                          <div className="mb-2">
                            <div className="px-2 py-1 text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1 bg-amber-50 rounded mb-1">
                              <Sparkles size={12} /> Suggested by AI
                            </div>
                            {suggested.map(p => (
                              <div 
                                key={p.id}
                                className={`px-2 py-1.5 text-sm cursor-pointer rounded hover:bg-gray-100 ${String(selectedPromo) === String(p.id) ? 'bg-primary/10 text-primary font-bold' : 'text-text'}`}
                                onClick={() => { setSelectedPromo(p.id); setDropdownOpen(false); }}
                              >
                                {p.title}
                              </div>
                            ))}
                          </div>
                        )}
                        {others.length > 0 && (
                          <div>
                            {suggested.length > 0 && <div className="px-2 py-1 text-[10px] font-bold text-text-muted uppercase border-t border-border mt-1 pt-2 mb-1">Other Templates</div>}
                            {others.map(p => (
                              <div 
                                key={p.id}
                                className={`px-2 py-1.5 text-sm cursor-pointer rounded hover:bg-gray-100 ${String(selectedPromo) === String(p.id) ? 'bg-primary/10 text-primary font-bold' : 'text-text'}`}
                                onClick={() => { setSelectedPromo(p.id); setDropdownOpen(false); }}
                              >
                                {p.title}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Channel and Schedule options are hidden as we default to WhatsApp and Immediate */}

          {isManualWhatsApp && selectedPromo && (
            <div className="mt-4 border border-border rounded-lg overflow-hidden">
              <div className="bg-surface px-3 py-2 text-xs font-bold text-text-muted uppercase border-b border-border">
                Manual Sending List
              </div>
              <div className="divide-y divide-border">
                {robustFarmers.map(farmer => (
                  <div key={farmer.id} className="p-3 flex justify-between items-center bg-white">
                    <div>
                      <div className="font-semibold text-text text-sm">{farmer.full_name}</div>
                      <div className="text-xs text-text-muted font-mono">{farmer.primary_mobile}</div>
                    </div>
                    <button
                      type="button"
                      disabled={sentFarmers[farmer.id]}
                      onClick={async () => {
                        const promoObj = promotions.find(p => String(p.id) === String(selectedPromo));
                        let messageContent = "Promotion Message";
                        if (promoObj) {
                          messageContent = promoObj.whatsapp_template || promoObj.title || "Promotion Message";
                          if (promoObj.file_url) messageContent += `\n\nView attachment: ${promoObj.file_url}`;
                        }
                        const normalizedPhone = String(farmer.primary_mobile).replace(/\D/g, '').replace(/^0+/, '');
                        const finalPhone = normalizedPhone.length === 10 ? `91${normalizedPhone}` : normalizedPhone;
                        const whatsappUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(messageContent)}`;
                        window.open(whatsappUrl, '_blank');
                        
                        setSentFarmers(prev => ({ ...prev, [farmer.id]: true }));
                        
                        // Log activity
                        try {
                          await api.createActivityLog({
                            farmer: farmer.id,
                            activity_type: 'WhatsApp',
                            notes: `Sent promotion: ${promoObj?.title || 'Message'} via manual link`
                          });
                        } catch (err) { console.error(err); }

                        // Log campaign if not logged
                        if (!campaignLogged && mode === 'create') {
                          try {
                            const payload = { content: selectedPromo, channel: 'WhatsApp', farmer_ids: justIds, frequency: 'Once' };
                            await api.createBulkSend(payload);
                            setCampaignLogged(true);
                          } catch (err) { console.error(err); }
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${sentFarmers[farmer.id] ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                    >
                      {sentFarmers[farmer.id] ? 'Sent' : 'Send WhatsApp'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-border gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg disabled:opacity-50 btn-press">
              {isManualWhatsApp ? 'Done' : (loading ? 'Processing...' : 'Send Message')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
