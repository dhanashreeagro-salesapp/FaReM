import React, { useState, useEffect, useRef } from 'react';
import { Navigation, Search, Filter, Phone, CheckSquare, Square, Navigation2, X, MapPin } from 'lucide-react';
import api from '../services/api';

const MultiSelect = ({ label, options, selected, onChange, valueKey = 'id', labelKey = 'name' }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef();

  useEffect(() => {
    const handleClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter(item => item !== val));
    else onChange([...selected, val]);
  };

  const filteredOptions = options.filter(opt => (opt[labelKey] || '').toLowerCase().includes(search.toLowerCase()));

  const selectAllFiltered = () => {
    const newSelected = [...selected];
    filteredOptions.forEach(opt => {
      if (!newSelected.includes(opt[valueKey])) newSelected.push(opt[valueKey]);
    });
    onChange(newSelected);
  };

  const clearAllFiltered = () => {
    const filteredVals = filteredOptions.map(opt => opt[valueKey]);
    onChange(selected.filter(val => !filteredVals.includes(val)));
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="bg-bg border border-border text-text rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary flex items-center justify-between min-w-[150px]">
        <span className="truncate">{selected.length === 0 ? `All ${label}` : `${selected.length} ${label} selected`}</span>
        <Filter size={14} className="ml-2 text-text-muted" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-64 bg-surface border border-border rounded-xl shadow-lg z-50 flex flex-col max-h-80">
          <div className="p-2 border-b border-border sticky top-0 bg-surface z-10">
            <input 
              type="search" 
              placeholder={`Search ${label}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary mb-2"
            />
            <div className="flex justify-between gap-2">
              <button onClick={selectAllFiltered} className="text-xs flex-1 py-1 bg-bg hover:bg-gray-100 rounded text-primary font-medium">Select All</button>
              <button onClick={clearAllFiltered} className="text-xs flex-1 py-1 bg-bg hover:bg-gray-100 rounded text-text-muted font-medium">Clear All</button>
            </div>
          </div>
          <div className="p-2 overflow-y-auto flex-1">
            {filteredOptions.map((opt, i) => {
              const val = opt[valueKey];
              const lbl = opt[labelKey];
              const isSel = selected.includes(val);
              return (
                <div key={i} className="flex items-center gap-2 p-2 hover:bg-bg rounded cursor-pointer" onClick={() => toggle(val)}>
                  {isSel ? <CheckSquare size={16} className="text-primary"/> : <Square size={16} className="text-text-muted"/>}
                  <span className="text-sm">{lbl}</span>
                </div>
              );
            })}
            {filteredOptions.length === 0 && <div className="text-xs text-center p-2 text-text-muted">No results found.</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default function VisitPlanner() {
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [startQuery, setStartQuery] = useState('');
  const [startCoords, setStartCoords] = useState(null);
  
  const [endQuery, setEndQuery] = useState('');
  const [endCoords, setEndCoords] = useState(null);
  
  const [villages, setVillages] = useState([]);
  const [crops, setCrops] = useState([]);
  const [stages, setStages] = useState([]);
  
  const [availableVillages, setAvailableVillages] = useState([]);
  const [availableCrops, setAvailableCrops] = useState([]);
  const [availableStages, setAvailableStages] = useState([]);
  
  const [selectedFarmers, setSelectedFarmers] = useState([]);
  
  const [viewMode, setViewMode] = useState('List'); // List, By Village, By Crop, By Crop + Stage

  useEffect(() => {
    fetchFilters();
  }, []);

  const fetchFilters = async () => {
    try {
      const [vData, cData, sData] = await Promise.all([
        api.getVillages(),
        api.getCrops(),
        api.getCropStages()
      ]);
      setAvailableVillages(vData.map(v => ({ id: v.village, name: v.village })));
      setAvailableCrops((cData?.results || cData || []).map(c => ({ id: c.id, name: c.crop_name })));
      setAvailableStages((sData?.results || sData || []).map(s => ({ id: s.id, name: s.stage_name })));
    } catch (error) {
      console.error('Failed to fetch filters', error);
    }
  };

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setStartCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
          setStartQuery('Current Location');
        },
        (error) => alert('Could not get location.')
      );
    }
  };

  const executeSearch = async () => {
    setLoading(true);
    try {
      const params = {};
      
      if (startCoords) { 
          params.lat = startCoords.lat; params.lng = startCoords.lng; 
      } else if (startQuery && startQuery !== 'Current Location') {
          params.start_village = startQuery;
      }
      
      if (endCoords) { 
          params.dest_lat = endCoords.lat; params.dest_lng = endCoords.lng; 
      } else if (endQuery) {
          params.dest_village = endQuery;
      }
      
      if (villages.length) params['village[]'] = villages;
      if (crops.length) params['crop[]'] = crops;
      if (stages.length) params['stage[]'] = stages;
      
      const data = await api.getDailyPlan(params);
      
      if (Array.isArray(data)) {
        setFarmers(data);
      } else {
        console.error("API did not return an array:", data);
        setFarmers([]);
      }
    } catch (error) {
      console.error('Failed to fetch plan', error);
      setFarmers([]);
    } finally {
      setLoading(false);
    }
  };

  const clearSelections = () => {
    setVillages([]);
    setCrops([]);
    setStages([]);
    setStartQuery('');
    setStartCoords(null);
    setEndQuery('');
    setEndCoords(null);
    setFarmers([]);
    setSelectedFarmers([]);
  };

  const toggleFarmerSelection = (id) => {
    if (selectedFarmers.includes(id)) setSelectedFarmers(selectedFarmers.filter(fid => fid !== id));
    else setSelectedFarmers([...selectedFarmers, id]);
  };
  
  const selectAll = () => setSelectedFarmers(farmers.map(f => f.farmer.id));
  const deselectAll = () => setSelectedFarmers([]);

  const generateRoute = () => {
    if (selectedFarmers.length === 0) return alert('Select farmers for the route.');
    const selected = farmers.filter(f => selectedFarmers.includes(f.farmer.id));
    const waypoints = selected.slice(0, 9).map(f => {
      return encodeURIComponent(`${f.farmer.village} ${f.farmer.taluka || ''} ${f.farmer.district || ''}`);
    }).join('|');
    
    const origin = startCoords ? `${startCoords.lat},${startCoords.lng}` : (startQuery || encodeURIComponent(selected[0].farmer.village));
    const dest = endCoords ? `${endCoords.lat},${endCoords.lng}` : (endQuery || origin);
    
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&waypoints=${waypoints}&destination=${dest}`;
    window.open(url, '_blank');
  };

  const groupedFarmers = () => {
    if (viewMode === 'List') return { 'All': farmers };
    if (viewMode === 'By Village') {
        const groups = {};
        farmers.forEach(item => {
            const key = item.farmer.village || 'Unknown';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }
    if (viewMode === 'By Crop') {
        const groups = {};
        farmers.forEach(item => {
            const cropsSet = new Set();
            item.farmer.plots?.forEach(p => {
                p.seasons?.forEach(s => {
                    if (s.status === 'Active' && s.crop_name) cropsSet.add(s.crop_name);
                });
            });
            if (cropsSet.size === 0) {
                if (!groups['Unknown']) groups['Unknown'] = [];
                groups['Unknown'].push(item);
            } else {
                cropsSet.forEach(crop => {
                    if (!groups[crop]) groups[crop] = [];
                    groups[crop].push(item);
                });
            }
        });
        return groups;
    }
    if (viewMode === 'By Crop + Stage') {
        const nested = {};
        farmers.forEach(item => {
            const cropStageSet = new Set();
            item.farmer.plots?.forEach(p => {
                p.seasons?.forEach(s => {
                    if (s.status === 'Active' && s.crop_name) {
                        const crop = s.crop_name;
                        const stage = s.stage_name || 'Unknown';
                        cropStageSet.add(`${crop}::${stage}`);
                    }
                });
            });
            if (cropStageSet.size === 0) {
                if (!nested['Unknown']) nested['Unknown'] = {};
                if (!nested['Unknown']['Unknown']) nested['Unknown']['Unknown'] = [];
                nested['Unknown']['Unknown'].push(item);
            } else {
                cropStageSet.forEach(cs => {
                    const [crop, stage] = cs.split('::');
                    if (!nested[crop]) nested[crop] = {};
                    if (!nested[crop][stage]) nested[crop][stage] = [];
                    nested[crop][stage].push(item);
                });
            }
        });
        return nested;
    }
    return {};
  };

  const renderTags = (tags) => tags?.map((tag, idx) => (
    <span key={idx} className="text-[10px] px-2 py-1 rounded-md border bg-surface text-text-muted font-medium">{tag}</span>
  ));

  const renderFarmerItem = (item) => {
    const isSel = selectedFarmers.includes(item.farmer.id);
    return (
        <div key={item.farmer.id} className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-start gap-3 ${isSel ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:bg-bg'}`} onClick={() => toggleFarmerSelection(item.farmer.id)}>
            <div className="pt-0.5">
                {isSel ? <CheckSquare size={18} className="text-primary"/> : <Square size={18} className="text-text-muted/50"/>}
            </div>
            <div className="flex-1">
                <div className="font-semibold text-text text-sm">{item.farmer.full_name}</div>
                <div className="text-xs text-text-muted flex justify-between items-center mt-0.5">
                    <span>{item.farmer.village}</span>
                    <a href={`tel:${item.farmer.primary_mobile}`} onClick={(e) => e.stopPropagation()} className="text-primary flex items-center gap-1 hover:underline">
                        <Phone size={12}/> Call
                    </a>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                    {renderTags(item.tags)}
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="bg-surface p-6 rounded-2xl border border-border">
        <h1 className="text-2xl font-heading font-bold text-text">Smart Route Planner</h1>
        <p className="text-text-muted text-sm mt-1">Plan your day based on location, crop stages, and market trends.</p>
      </div>

      <div className="bg-surface p-5 rounded-2xl border border-border space-y-4 shadow-sm">
          <datalist id="villages-list">
              {availableVillages.map((v, i) => <option key={i} value={v.name} />)}
          </datalist>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-muted uppercase">Start Point</label>
                  <div className="flex gap-2">
                      <input type="text" value={startQuery} onChange={e => setStartQuery(e.target.value)} list="villages-list" placeholder="e.g. Pune or Current Location" className="flex-1 bg-bg border border-border rounded-xl px-4 py-2 text-sm focus:border-primary focus:outline-none" />
                      <button onClick={useCurrentLocation} className="p-2 bg-bg border border-border rounded-xl hover:bg-gray-100" title="Use Current GPS">
                          <Navigation2 size={20} className="text-primary"/>
                      </button>
                  </div>
              </div>
              <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-muted uppercase">End Point</label>
                  <input type="text" value={endQuery} onChange={e => setEndQuery(e.target.value)} list="villages-list" placeholder="e.g. Nashik (Defaults to Start Point if empty)" className="w-full bg-bg border border-border rounded-xl px-4 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-border">
              <div className="flex flex-wrap gap-3">
                  <MultiSelect label="Villages" options={availableVillages} selected={villages} onChange={setVillages} />
                  <MultiSelect label="Crops" options={availableCrops} selected={crops} onChange={setCrops} />
                  <MultiSelect label="Stages" options={availableStages} selected={stages} onChange={setStages} />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={clearSelections} className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-6 py-2 bg-bg text-text border border-border rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors">
                      <X size={16} /> Clear
                  </button>
                  <button onClick={executeSearch} className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
                      <Search size={16} /> Find Farmers
                  </button>
              </div>
          </div>
      </div>

      {loading && <div className="py-12 text-center text-text-muted animate-pulse">Calculating optimal routes and filtering portfolio...</div>}

      {!loading && farmers.length > 0 && (
          <div className="max-w-4xl mx-auto">
              <div className="flex flex-col bg-surface rounded-2xl border border-border shadow-sm overflow-hidden min-h-[600px]">
                  <div className="p-5 border-b border-border bg-bg/50 space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                          <h2 className="font-bold text-text text-lg">Tour Selection</h2>
                          <div className="flex items-center gap-4 text-sm">
                              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-semibold">{selectedFarmers.length} / {farmers.length} Selected</span>
                              <div className="flex gap-2 font-medium">
                                  <button onClick={selectAll} className="text-primary hover:underline">Select All</button>
                                  <span className="text-border">|</span>
                                  <button onClick={deselectAll} className="text-text-muted hover:underline">Clear</button>
                              </div>
                          </div>
                      </div>
                      
                      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                          {['List', 'By Village', 'By Crop', 'By Crop + Stage'].map(mode => (
                              <button key={mode} onClick={() => setViewMode(mode)} className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-colors ${viewMode === mode ? 'bg-primary text-white shadow-md' : 'bg-surface border border-border text-text hover:bg-bg'}`}>{mode}</button>
                          ))}
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-6">
                      {viewMode === 'By Crop + Stage' ? (
                          Object.entries(groupedFarmers()).map(([cropName, stagesObj]) => (
                              <div key={cropName} className="space-y-4 bg-bg/30 p-4 rounded-xl border border-border/50">
                                  <h3 className="text-base font-heading font-bold text-text border-b border-border/60 pb-2">{cropName}</h3>
                                  {Object.entries(stagesObj).map(([stageName, items]) => (
                                      <div key={stageName} className="space-y-3 pl-4 border-l-2 border-primary/20 ml-2">
                                          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">{stageName}</h4>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                              {items.map(renderFarmerItem)}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          ))
                      ) : (
                          Object.entries(groupedFarmers()).map(([groupName, items]) => (
                              <div key={groupName} className="space-y-3">
                                  {viewMode !== 'List' && (
                                      <div className="flex items-center gap-2 px-1 pt-2">
                                          {viewMode === 'By Village' && (
                                              <button onClick={(e) => {
                                                  e.stopPropagation();
                                                  const allSelected = items.every(i => selectedFarmers.includes(i.farmer.id));
                                                  if (allSelected) {
                                                      setSelectedFarmers(prev => prev.filter(id => !items.find(i => i.farmer.id === id)));
                                                  } else {
                                                      const newIds = items.map(i => i.farmer.id).filter(id => !selectedFarmers.includes(id));
                                                      setSelectedFarmers(prev => [...prev, ...newIds]);
                                                  }
                                              }} className="text-primary focus:outline-none hover:opacity-80 transition-opacity">
                                                  {items.every(i => selectedFarmers.includes(i.farmer.id)) ? <CheckSquare size={18} /> : <Square size={18} className="text-text-muted/50" />}
                                              </button>
                                          )}
                                          <h3 className="text-sm font-heading font-bold text-text uppercase tracking-wide">{groupName} <span className="text-text-muted text-xs font-normal lowercase ml-1">({items.length} farmers)</span></h3>
                                      </div>
                                  )}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {items.map(renderFarmerItem)}
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
                  
                  <div className="p-5 border-t border-border bg-surface">
                      <button onClick={generateRoute} disabled={selectedFarmers.length === 0} className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-accent text-white rounded-xl text-base font-bold hover:bg-accent/90 transition-colors disabled:opacity-50 shadow-md">
                          <Navigation size={20} /> Generate Tour Route
                      </button>
                  </div>
              </div>
          </div>
      )}
      
      {!loading && farmers.length === 0 && (
          <div className="text-center py-16 bg-surface rounded-2xl border border-border shadow-sm">
            <MapPin size={48} className="mx-auto text-text-muted/30 mb-4" />
            <h3 className="text-lg font-heading font-semibold text-text mb-2">Ready to Plan</h3>
            <p className="text-text-muted max-w-sm mx-auto">Enter start/end points or filter by crop/village to find farmers for your tour.</p>
        </div>
      )}
    </div>
  );
}
