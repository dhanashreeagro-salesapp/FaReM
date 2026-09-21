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
          api.getTerritories().catch(() => []),
          api.getCrops().catch(() => []),
          api.getVillages().catch(() => []),
          api.getDistricts().catch(() => []),
          api.getTalukas().catch(() => [])
        ]);
        const tList = terrData?.results || terrData || [];
        
        let filteredTerritories = tList;
        if (user?.role === 'FieldStaff') {
          filteredTerritories = tList.filter(t => t.name === user.territory_name || String(t.id) === String(user.territory_id));
        } else if (user?.role !== 'Admin' && user?.managed_territory_ids?.length > 0) {
          filteredTerritories = tList.filter(t => user.managed_territory_ids.includes(String(t.id)));
        }
        setTerritories(filteredTerritories);

        setCrops(cropData?.results || cropData || []);
        setAvailableVillages(villData || []);
        setAvailableDistricts(distData || []);
        setAvailableTalukas(talData || []);

        if (user?.role === 'FieldStaff' && (user?.territory_name || user?.territory_id)) {
          const tMatch = filteredTerritories[0];
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
    
    let finalIds = matchedIds;
    if (matchedIds.length > 5) {
      alert(`Your search matched ${matchedIds.length} farmers. We will only select the first 5 farmers for manual messaging.`);
      finalIds = matchedIds.slice(0, 5);
    }
    
    const filters = { crop: selectedCrop, stage: selectedStage, territory: selectedTerritory, weather: selectedWeather };
    onAudienceSelected(finalIds, filters);
  };

  // Find the selected crop object to get its stages
  const activeCropObj = crops.find(c => c.crop_name === selectedCrop);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-bg rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-stagger-in">
        <div className="flex justify-between items-center p-3 border-b border-border bg-surface">
          <h3 className="font-heading font-semibold text-text flex items-center gap-2"><Users size={18}/> Target Audience</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>
        
        <div className="p-4 space-y-3">
          
          {user?.role !== 'FieldStaff' && (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <select 
                  value={selectedTerritory} 
                  onChange={(e) => setSelectedTerritory(e.target.value)}
                  className="w-full px-2 py-1.5 border border-border rounded-lg bg-surface text-text text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">Any Region</option>
                  {territories.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Crop</label>
              <select 
                value={selectedCrop} 
                onChange={(e) => { setSelectedCrop(e.target.value); setSelectedStage(''); }}
                className="w-full px-2 py-1.5 border border-border rounded-lg bg-surface text-text text-sm focus:outline-none focus:border-primary"
              >
                <option value="">Any Crop</option>
                {crops.map(c => <option key={c.id} value={c.crop_name}>{c.crop_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Crop Stage (Optional)</label>
              <select 
                value={selectedStage} 
                onChange={(e) => setSelectedStage(e.target.value)}
                disabled={!selectedCrop || !activeCropObj?.stages?.length}
                className="w-full px-2 py-1.5 border border-border rounded-lg bg-surface text-text text-sm focus:outline-none focus:border-primary disabled:opacity-50"
              >
                <option value="">Any Stage</option>
                {activeCropObj?.stages?.map(s => (
                  <option key={s.id} value={s.stage_name}>{s.stage_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">District</label>
              <input 
                type="text" 
                list="districts-list"
                placeholder="e.g. Nashik" 
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-2 py-1.5 border border-border rounded-lg bg-surface text-text text-sm focus:outline-none focus:border-primary"
              />
              <datalist id="districts-list">
                {availableDistricts.map(d => <option key={d.district} value={d.district} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Taluka</label>
              <input 
                type="text" 
                list="talukas-list"
                placeholder="e.g. Sinnar" 
                value={taluka}
                onChange={(e) => setTaluka(e.target.value)}
                className="w-full px-2 py-1.5 border border-border rounded-lg bg-surface text-text text-sm focus:outline-none focus:border-primary"
              />
              <datalist id="talukas-list">
                {availableTalukas.map(t => <option key={t.taluka} value={t.taluka} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Village</label>
              <input 
                type="text" 
                list="villages-list"
                placeholder="e.g. Dongargaon" 
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                className="w-full px-2 py-1.5 border border-border rounded-lg bg-surface text-text text-sm focus:outline-none focus:border-primary"
              />
              <datalist id="villages-list">
                {availableVillages.map(v => <option key={v.village} value={v.village} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">Weather Condition (Forecast)</label>
              <select 
                value={selectedWeather}
                onChange={(e) => setSelectedWeather(e.target.value)}
                className="w-full px-2 py-1.5 border border-border rounded-lg bg-surface text-text text-sm focus:outline-none focus:border-primary"
              >
                <option value="">Any Weather</option>
                <option value="rain">Rain Risk / Showers Expected</option>
                <option value="heat">Extreme Heat / High Temp</option>
                <option value="frost">Frost Risk</option>
                <option value="clear">Clear Sky</option>
              </select>
            </div>
          </div>
          
          <div className="flex justify-center mt-3">
            <button 
              onClick={handleSearch}
              disabled={loading}
              className="px-4 py-1.5 border border-primary text-primary hover:bg-primary/5 font-semibold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Search size={16} />}
              Calculate Audience Size
            </button>
          </div>

          {matchedCount !== null && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
              <div className="text-2xl font-heading font-bold text-emerald-800">{matchedCount}</div>
              <div className="text-xs text-emerald-600 font-medium">Farmers matched criteria</div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border bg-surface flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-3 py-1.5 text-text-muted hover:text-text font-medium text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleContinue}
            disabled={matchedCount === null || matchedCount === 0}
            className="px-4 py-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg disabled:opacity-50 cursor-pointer"
          >
            Continue to Message
          </button>
        </div>
      </div>
    </div>
  );
}
