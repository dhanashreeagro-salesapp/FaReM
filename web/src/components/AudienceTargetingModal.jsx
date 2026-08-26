import React, { useState, useEffect } from 'react';
import { X, Search, Users } from 'lucide-react';
import api from '../services/api';

export default function AudienceTargetingModal({ onClose, onAudienceSelected }) {
  const [territories, setTerritories] = useState([]);
  const [crops, setCrops] = useState([]);
  
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const [selectedCrop, setSelectedCrop] = useState('');
  const [selectedWeather, setSelectedWeather] = useState('');
  const [loading, setLoading] = useState(false);
  const [matchedCount, setMatchedCount] = useState(null);
  const [matchedIds, setMatchedIds] = useState([]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [terrData, cropData] = await Promise.all([
          api.getTerritories(),
          api.getCropMaster()
        ]);
        setTerritories(terrData.results || terrData);
        setCrops(cropData.results || cropData);
      } catch (e) {
        console.error(e);
      }
    };
    loadFilters();
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedTerritory) params.territory = selectedTerritory;
      if (selectedCrop) params.crop = selectedCrop;
      if (selectedWeather) params.weather_forecast = selectedWeather;
      
      const ids = await api.getFarmerIds(params);
      setMatchedIds(ids);
      setMatchedCount(ids.length);
    } catch (e) {
      console.error(e);
      alert('Failed to search audience');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (matchedIds.length === 0) {
      return alert('No farmers matched this criteria. Please widen your search.');
    }
    onAudienceSelected(matchedIds);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-bg rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-stagger-in">
        <div className="flex justify-between items-center p-4 border-b border-border bg-surface">
          <h3 className="font-heading font-semibold text-text flex items-center gap-2"><Users size={18}/> Target Audience</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>
        
        <div className="p-4 space-y-4">
          <p className="text-sm text-text-muted">Select filters to build an audience for your campaign.</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-text mb-1">Crop</label>
              <select 
                value={selectedCrop}
                onChange={e => { setSelectedCrop(e.target.value); setMatchedCount(null); }}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Any Crop</option>
                {crops.map(c => (
                  <option key={c.id} value={c.crop_name}>{c.crop_name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-text mb-1">Region / Territory</label>
              <select 
                value={selectedTerritory}
                onChange={e => { setSelectedTerritory(e.target.value); setMatchedCount(null); }}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Any Region</option>
                {territories.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-text mb-1">Weather Condition (Forecast)</label>
              <select 
                value={selectedWeather}
                onChange={e => { setSelectedWeather(e.target.value); setMatchedCount(null); }}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Any Weather</option>
                <option value="rain">Rain Risk / Showers Expected</option>
                <option value="heat">Extreme Heat / High Temp</option>
                <option value="frost">Frost Risk</option>
                <option value="clear">Clear Sky</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-2 justify-center mt-2">
            <button 
              type="button" 
              onClick={handleSearch} 
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-surface border border-primary text-primary hover:bg-primary/5 text-sm font-medium rounded-lg transition-colors"
            >
              <Search size={16} />
              {loading ? 'Calculating...' : 'Calculate Audience Size'}
            </button>
          </div>

          {matchedCount !== null && (
            <div className={`p-4 mt-4 rounded-lg text-center ${matchedCount > 0 ? 'bg-success/10 text-success-dark border border-success/20' : 'bg-danger/10 text-danger-dark border border-danger/20'}`}>
              <div className="text-3xl font-bold font-heading">{matchedCount}</div>
              <div className="text-sm font-medium">Farmers matched criteria</div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-border gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text transition-colors">
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleContinue}
              disabled={matchedCount === null || matchedCount === 0} 
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg disabled:opacity-50 btn-press"
            >
              Continue to Message
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
