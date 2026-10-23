import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, CheckSquare, Square, Users, ArrowRight, Loader2, Phone, MapPin, Filter, RotateCcw } from 'lucide-react';
import api from '../services/api';

export default function PromotionFarmerSelectModal({ promo, onClose, onConfirmSelection }) {
  const [farmers, setFarmers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [selectedTaluka, setSelectedTaluka] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        const data = await api.getFarmers();
        const list = Array.isArray(data) ? data : data.results || [];
        setFarmers(list);
      } catch (err) {
        console.error('Failed to load farmers', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFarmers();
  }, []);

  const villages = useMemo(() => {
    const set = new Set();
    farmers.forEach(f => {
      if (f.village && f.village.trim()) set.add(f.village.trim());
    });
    return Array.from(set).sort();
  }, [farmers]);

  const talukas = useMemo(() => {
    const set = new Set();
    farmers.forEach(f => {
      if (f.taluka && f.taluka.trim()) set.add(f.taluka.trim());
    });
    return Array.from(set).sort();
  }, [farmers]);

  const filteredFarmers = useMemo(() => {
    return farmers.filter(f => {
      if (selectedVillage && f.village !== selectedVillage) return false;
      if (selectedTaluka && f.taluka !== selectedTaluka) return false;
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        (f.full_name || '').toLowerCase().includes(term) ||
        (f.primary_mobile || '').includes(term) ||
        (f.village || '').toLowerCase().includes(term) ||
        (f.taluka || '').toLowerCase().includes(term)
      );
    });
  }, [farmers, search, selectedVillage, selectedTaluka]);

  const hasActiveFilters = Boolean(search || selectedVillage || selectedTaluka);

  const resetFilters = () => {
    setSearch('');
    setSelectedVillage('');
    setSelectedTaluka('');
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredFarmers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredFarmers.map(f => f.id));
    }
  };

  const handleContinue = () => {
    if (selectedIds.length === 0) {
      return alert('Please select at least one farmer to send the promotion.');
    }
    const chosen = farmers.filter(f => selectedIds.includes(f.id));
    onConfirmSelection(chosen);
  };

  return (
    <div className="fixed inset-0 bg-text/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-surface w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-border animate-scale-up">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-bg/40">
          <div>
            <h3 className="font-heading font-bold text-text text-base md:text-lg">Select Farmers for WhatsApp Handoff</h3>
            <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
              Sending: <span className="font-semibold text-text">{promo.title}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Search Bar & Filter Controls */}
        <div className="p-4 border-b border-border bg-bg/20 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search farmer by name, mobile, village, taluka..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary transition-all"
            />
          </div>

          {/* Quick Dropdown Filters */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedVillage}
              onChange={e => setSelectedVillage(e.target.value)}
              className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
            >
              <option value="">All Villages ({villages.length})</option>
              {villages.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>

            <select
              value={selectedTaluka}
              onChange={e => setSelectedTaluka(e.target.value)}
              className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
            >
              <option value="">All Talukas ({talukas.length})</option>
              {talukas.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between text-xs text-text-muted px-1">
            <div className="flex items-center gap-3">
              <button 
                onClick={toggleAll}
                className="flex items-center gap-1.5 font-semibold text-primary hover:underline"
              >
                {selectedIds.length === filteredFarmers.length && filteredFarmers.length > 0 ? (
                  <CheckSquare size={14} />
                ) : (
                  <Square size={14} />
                )}
                <span>{selectedIds.length === filteredFarmers.length && filteredFarmers.length > 0 ? 'Deselect All' : 'Select All Filtered'}</span>
              </button>

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-text-muted hover:text-text font-medium"
                >
                  <RotateCcw size={12} /> Clear filters
                </button>
              )}
            </div>

            <span>Selected: <strong className="text-text">{selectedIds.length}</strong> of {filteredFarmers.length} farmers</span>
          </div>
        </div>

        {/* Farmer List Area */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-border/60">
          {loading ? (
            <div className="py-12 text-center text-text-muted space-y-3">
              <Loader2 size={32} className="animate-spin mx-auto text-primary" />
              <p className="text-sm">Loading farmers directory...</p>
            </div>
          ) : filteredFarmers.length === 0 ? (
            <div className="py-12 text-center text-text-muted">
              <Users size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No farmers found matching your filter criteria.</p>
            </div>
          ) : (
            filteredFarmers.map(farmer => {
              const isChecked = selectedIds.includes(farmer.id);
              return (
                <div
                  key={farmer.id}
                  onClick={() => toggleSelect(farmer.id)}
                  className={`py-3 px-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all ${
                    isChecked ? 'bg-primary/10 border border-primary/20' : 'hover:bg-bg/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-primary mt-0.5">
                      {isChecked ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} className="text-text-muted" />}
                    </div>
                    <div>
                      <h4 className="font-heading font-semibold text-text text-sm">{farmer.full_name || 'Unnamed Farmer'}</h4>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted mt-0.5">
                        <span className="flex items-center gap-1"><Phone size={11} /> {farmer.primary_mobile || 'No Mobile'}</span>
                        {(farmer.village || farmer.taluka) && (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} /> {[farmer.village, farmer.taluka].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className={`badge text-[10px] ${farmer.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
                    {farmer.status || 'Active'}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-bg/50 flex justify-between items-center">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-bg transition-colors">
            Cancel
          </button>

          <button
            onClick={handleContinue}
            disabled={selectedIds.length === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-medium shadow-sm hover:shadow transition-all btn-press"
          >
            <span>Proceed to Send ({selectedIds.length})</span>
            <ArrowRight size={15} />
          </button>
        </div>

      </div>
    </div>
  );
}
