import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, CheckCircle, AlertTriangle, Search, Filter, Phone, CheckSquare, Square, Navigation2, Layers } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../services/api';
import LogVisitModal from '../components/LogVisitModal';
import FarmerProfileModal from '../components/FarmerProfileModal';

// Fix for default Leaflet markers in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const customIcon = (color) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const MultiSelect = ({ label, options, selected, onChange, valueKey = 'id', labelKey = 'name' }) => {
  const [open, setOpen] = useState(false);
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

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="bg-bg border border-border text-text rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary flex items-center justify-between min-w-[150px]">
        <span className="truncate">{selected.length === 0 ? `All ${label}` : `${selected.length} ${label} selected`}</span>
        <Filter size={14} className="ml-2 text-text-muted" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-64 bg-surface border border-border rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
          <div className="p-2">
            {options.map((opt, i) => {
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
          </div>
        </div>
      )}
    </div>
  );
};

// Map Bounds Updater component
const MapUpdater = ({ farmers, startCoords, endCoords }) => {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([]);
    if (startCoords) bounds.extend([startCoords.lat, startCoords.lng]);
    if (endCoords) bounds.extend([endCoords.lat, endCoords.lng]);
    
    farmers.forEach(f => {
      const plots = f.farmer.plots || [];
      plots.forEach(p => {
        if (p.location && p.location.coordinates) {
          // GeoJSON Point is [lng, lat]
          const coord = p.location.coordinates;
          bounds.extend([coord[1], coord[0]]);
        }
      });
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [farmers, startCoords, endCoords, map]);
  return null;
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
  
  const [viewMode, setViewMode] = useState('List'); // List, Village, Crop, CropStage
  
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);

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

  const geocode = async (query) => {
    if (!query) return null;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)},India`);
      const data = await res.json();
      if (data && data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch (e) {
      console.error(e);
    }
    return null;
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
      let sCoords = startCoords;
      if (startQuery && startQuery !== 'Current Location') {
        sCoords = await geocode(startQuery);
        setStartCoords(sCoords);
      }
      let eCoords = endCoords;
      if (endQuery) {
        eCoords = await geocode(endQuery);
        setEndCoords(eCoords);
      }

      const params = {};
      if (sCoords) { params.lat = sCoords.lat; params.lng = sCoords.lng; }
      if (eCoords) { params.dest_lat = eCoords.lat; params.dest_lng = eCoords.lng; }
      
      if (villages.length) params['village[]'] = villages;
      if (crops.length) params['crop[]'] = crops;
      if (stages.length) params['stage[]'] = stages;
      
      const data = await api.getDailyPlan(params);
      setFarmers(data);
    } catch (error) {
      console.error('Failed to fetch plan', error);
    } finally {
      setLoading(false);
    }
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
    const groups = {};
    farmers.forEach(item => {
      let key = 'Unknown';
      if (viewMode === 'By Village') key = item.farmer.village;
      if (viewMode === 'By Crop' || viewMode === 'By Crop + Stage') {
        const cropsList = [];
        item.farmer.plots?.forEach(p => {
            p.seasons?.forEach(s => {
                if (s.status === 'Active' && s.crop) {
                    let k = s.crop.crop_name;
                    if (viewMode === 'By Crop + Stage' && s.current_stage) k += ` - ${s.current_stage.stage_name}`;
                    cropsList.push(k);
                }
            })
        });
        if (cropsList.length > 0) key = cropsList.join(', ');
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  };

  const renderTags = (tags) => tags.map((tag, idx) => (
    <span key={idx} className="text-[10px] px-2 py-1 rounded-md border bg-surface text-text-muted font-medium">{tag}</span>
  ));

  const mapCenter = startCoords ? [startCoords.lat, startCoords.lng] : [19.0760, 72.8777]; // Default to Mumbai roughly

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-border">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text">Smart Route Planner</h1>
          <p className="text-text-muted text-sm mt-1">Plan your day based on location, crop stages, and market trends.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={executeSearch} className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
                <Search size={16} /> Find Farmers
            </button>
        </div>
      </div>

      <div className="bg-surface p-4 rounded-2xl border border-border space-y-4">
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
                  <input type="text" value={endQuery} onChange={e => setEndQuery(e.target.value)} list="villages-list" placeholder="e.g. Nashik (Optional)" className="w-full bg-bg border border-border rounded-xl px-4 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
              <MultiSelect label="Villages" options={availableVillages} selected={villages} onChange={setVillages} />
              <MultiSelect label="Crops" options={availableCrops} selected={crops} onChange={setCrops} />
              <MultiSelect label="Stages" options={availableStages} selected={stages} onChange={setStages} />
          </div>
      </div>

      {loading && <div className="py-12 text-center text-text-muted animate-pulse">Calculating optimal routes and filtering portfolio...</div>}

      {!loading && farmers.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-[500px] bg-surface rounded-2xl border border-border overflow-hidden relative z-0">
                  <MapContainer center={mapCenter} zoom={7} style={{ height: '100%', width: '100%' }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <MapUpdater farmers={farmers} startCoords={startCoords} endCoords={endCoords} />
                      
                      {startCoords && (
                          <Marker position={[startCoords.lat, startCoords.lng]} icon={customIcon('green')}>
                              <Popup>Start Point: {startQuery}</Popup>
                          </Marker>
                      )}
                      
                      {endCoords && (
                          <Marker position={[endCoords.lat, endCoords.lng]} icon={customIcon('red')}>
                              <Popup>End Point: {endQuery}</Popup>
                          </Marker>
                      )}

                      {startCoords && endCoords && (
                          <Polyline positions={[[startCoords.lat, startCoords.lng], [endCoords.lat, endCoords.lng]]} color="blue" weight={3} opacity={0.5} dashArray="10, 10" />
                      )}

                      {farmers.map(f => {
                          const isSel = selectedFarmers.includes(f.farmer.id);
                          return f.farmer.plots?.filter(p => p.location?.coordinates).map((p, idx) => (
                              <Marker key={`${f.farmer.id}-${idx}`} position={[p.location.coordinates[1], p.location.coordinates[0]]} icon={customIcon(isSel ? 'gold' : 'blue')}>
                                  <Popup>
                                      <div className="font-bold">{f.farmer.full_name}</div>
                                      <div className="text-sm">{f.farmer.village}</div>
                                      <a href={`tel:${f.farmer.primary_mobile}`} className="text-primary flex items-center gap-1 mt-1 text-sm"><Phone size={12}/> Call {f.farmer.primary_mobile}</a>
                                  </Popup>
                              </Marker>
                          ));
                      })}
                  </MapContainer>
              </div>

              <div className="flex flex-col h-[500px] bg-surface rounded-2xl border border-border overflow-hidden">
                  <div className="p-4 border-b border-border bg-bg/50 space-y-3">
                      <div className="flex justify-between items-center">
                          <h2 className="font-bold text-text">Tour Selection</h2>
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-semibold">{selectedFarmers.length} / {farmers.length} Selected</span>
                      </div>
                      <div className="flex gap-2 text-sm">
                          <button onClick={selectAll} className="text-primary hover:underline">Select All</button>
                          <span className="text-border">|</span>
                          <button onClick={deselectAll} className="text-text-muted hover:underline">Clear</button>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                          {['List', 'By Village', 'By Crop', 'By Crop + Stage'].map(mode => (
                              <button key={mode} onClick={() => setViewMode(mode)} className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === mode ? 'bg-primary text-white' : 'bg-surface border border-border text-text-muted hover:bg-bg'}`}>{mode}</button>
                          ))}
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-4">
                      {Object.entries(groupedFarmers()).map(([groupName, items]) => (
                          <div key={groupName} className="space-y-2">
                              {viewMode !== 'List' && <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider px-2 pt-2">{groupName}</h3>}
                              {items.map(item => {
                                  const isSel = selectedFarmers.includes(item.farmer.id);
                                  return (
                                      <div key={item.farmer.id} className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-start gap-3 ${isSel ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:bg-bg'}`} onClick={() => toggleFarmerSelection(item.farmer.id)}>
                                          <div className="pt-0.5">
                                              {isSel ? <CheckSquare size={18} className="text-primary"/> : <Square size={18} className="text-text-muted/50"/>}
                                          </div>
                                          <div className="flex-1">
                                              <div className="font-semibold text-text text-sm">{item.farmer.full_name}</div>
                                              <div className="text-xs text-text-muted flex gap-2 mt-0.5">
                                                  <span>{item.farmer.village}</span>
                                                  {item.distance && <span className="text-primary font-medium">{item.distance}km</span>}
                                              </div>
                                              <div className="flex flex-wrap gap-1 mt-1.5">
                                                  {renderTags(item.tags)}
                                              </div>
                                          </div>
                                      </div>
                                  )
                              })}
                          </div>
                      ))}
                  </div>
                  <div className="p-4 border-t border-border bg-bg/50">
                      <button onClick={generateRoute} disabled={selectedFarmers.length === 0} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent/90 transition-colors disabled:opacity-50">
                          <Navigation size={18} /> Generate Tour Route
                      </button>
                  </div>
              </div>
          </div>
      )}
      
      {!loading && farmers.length === 0 && (
          <div className="text-center py-16 bg-surface rounded-2xl border border-border">
            <MapPin size={48} className="mx-auto text-text-muted/30 mb-4" />
            <h3 className="text-lg font-heading font-semibold text-text mb-2">Ready to Plan</h3>
            <p className="text-text-muted max-w-sm mx-auto">Enter start/end points or filter by crop/village to find farmers for your tour.</p>
        </div>
      )}
    </div>
  );
}
