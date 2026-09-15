import React, { useState, useEffect } from 'react';
import { X, Search, Users } from 'lucide-react';
import api from '../services/api';
import { useAuth } from './AuthProvider';

export default function AudienceTargetingModal({ onClose, onAudienceSelected }) {
  const { user } = useAuth();
  const [territories, setTerritories] = useState([]);
  const [crops, setCrops] = useState([]);
  
  const [availableVillages, setAvailableVillages] = useState([]);
  const [availableDistricts, setAvailableDistricts] = useState([]);
  const [availableTalukas, setAvailableTalukas] = useState([]);
  
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const [selectedCrop, setSelectedCrop] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedWeather, setSelectedWeather] = useState('');
  
  const [district, setDistrict] = useState('');
  const [taluka, setTaluka] = useState('');
  const [village, setVillage] = useState('');

  const [loading, setLoading] = useState(false);
  const [matchedCount, setMatchedCount] = useState(null);
  const [matchedIds, setMatchedIds] = useState([]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [terrData, cropData, villData, distData, talData] = await Promise.all([
          api.getTerritories(),
          api.getCrops(),
          api.getVillages().catch(() => []),
          api.getDistricts().catch(() => []),
          api.getTalukas().catch(() => [])
        ]);
        const tList = terrData?.results || terrData || [];
        setTerritories(tList);
        setCrops(cropData?.results || cropData || []);
        setAvailableVillages(villData || []);
        setAvailableDistricts(distData || []);
        setAvailableTalukas(talData || []);

        if (user?.role === 'FieldStaff' && (user?.territory_name || user?.territory_id)) {
          const tMatch = tList.find(t => t.name === user.territory_name || String(t.id) === String(user.territory_id));
          if (tMatch) setSelectedTerritory(tMatch.id);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadFilters();
  }, [user]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedTerritory) params.territory = selectedTerritory;
      if (selectedCrop) params.crop = selectedCrop;
      if (selectedStage) params.stage = selectedStage;
      if (selectedWeather) params.weather_forecast = selectedWeather;
      
      if (district) params.district = district;
      if (taluka) params.taluka = taluka;
      if (village) params.village = village;
      
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
    const filters = { crop: selectedCrop, stage: selectedStage, territory: selectedTerritory, weather: selectedWeather };
    onAudienceSelected(matchedIds, filters);
  };

  // Find the selected crop object to get its stages
  const activeCropObj = crops.find(c => c.crop_name === selectedCrop);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-bg rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-stagger-in">
        <div className="flex justify-between items-center p-4 border-b border-border bg-surface">
          <h3 className="font-heading font-semibold text-text flex items-center gap-2"><Users size={18}/> Target Audience</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>
        
        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          <p className="text-sm text-text-muted">Select filters to build an audience for your campaign.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary Demographics */}
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-semibold text-text mb-1">Region / Territory</label>
              <select 
                value={selectedTerritory}
                onChange={e => { setSelectedTerritory(e.target.value); setMatchedCount(null); }}
                disabled={user?.role === 'FieldStaff'}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
              >
                <option value="">Any Region</option>
                {territories.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text mb-1">Crop</label>
              <select 
                value={selectedCrop}
                onChange={e => { 
                  setSelectedCrop(e.target.value); 
                  setSelectedStage(''); 
                  setMatchedCount(null); 
                }}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Any Crop</option>
                {crops.map(c => (
                  <option key={c.id} value={c.crop_name}>{c.crop_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text mb-1">Crop Stage (Optional)</label>
              <select 
                value={selectedStage}
                onChange={e => { setSelectedStage(e.target.value); setMatchedCount(null); }}
                disabled={!selectedCrop}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
              >
                <option value="">Any Stage</option>
                {activeCropObj?.stages?.map(s => (
                  <option key={s.id} value={s.stage_name}>{s.stage_name}</option>
                ))}
              </select>
            </div>

            {/* Geographical Granularity */}
            <div>
              <label className="block text-sm font-semibold text-text mb-1">District</label>
              <input 
                type="text" 
                list="districts-list"
                value={district}
                onChange={e => { setDistrict(e.target.value); setMatchedCount(null); }}
                placeholder="e.g. Nashik"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
              />
              <datalist id="districts-list">
                {availableDistricts.map((d, idx) => <option key={idx} value={d.district} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text mb-1">Taluka</label>
              <input 
                type="text" 
                list="talukas-list"
                value={taluka}
                onChange={e => { setTaluka(e.target.value); setMatchedCount(null); }}
                placeholder="e.g. Sinnar"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
              />
              <datalist id="talukas-list">
                {availableTalukas.map((t, idx) => <option key={idx} value={t.taluka} />)}
              </datalist>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-semibold text-text mb-1">Village</label>
              <input 
                type="text" 
                list="villages-list"
                value={village}
                onChange={e => { setVillage(e.target.value); setMatchedCount(null); }}
                placeholder="e.g. Dongargaon"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
              />
              <datalist id="villages-list">
                {availableVillages.map((v, idx) => <option key={idx} value={v.village} />)}
              </datalist>
            </div>

            <div className="col-span-1 md:col-span-2">
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
          
          <div className="flex gap-2 justify-center mt-6">
            <button 
              type="button" 
              onClick={handleSearch} 
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-surface border border-primary text-primary hover:bg-primary/5 text-sm font-medium rounded-lg transition-colors cursor-pointer"
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

          <div className="flex justify-end pt-4 border-t border-border gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text transition-colors cursor-pointer">
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleContinue}
              disabled={matchedCount === null || matchedCount === 0} 
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg disabled:opacity-50 cursor-pointer"
            >
              Continue to Message
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
