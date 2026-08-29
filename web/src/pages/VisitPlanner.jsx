import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Calendar, CheckCircle, AlertTriangle, TrendingUp, Search } from 'lucide-react';
import api from '../services/api';
import LogVisitModal from '../components/LogVisitModal';
import FarmerProfileModal from '../components/FarmerProfileModal';

export default function VisitPlanner() {
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [village, setVillage] = useState('');
  const [crop, setCrop] = useState('');
  const [stage, setStage] = useState('');
  const [availableVillages, setAvailableVillages] = useState([]);
  const [availableCrops, setAvailableCrops] = useState([]);
  const [availableStages, setAvailableStages] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);

  const [showBigFarmers, setShowBigFarmers] = useState(false);

  useEffect(() => {
    fetchFilters();
    fetchFarmers();
  }, []);

  const fetchFilters = async () => {
    try {
      const [vData, cData, sData] = await Promise.all([
        api.getVillages(),
        api.getCrops(),
        api.getCropStages()
      ]);
      setAvailableVillages(vData);
      setAvailableCrops(cData?.results || cData || []);
      setAvailableStages(sData?.results || sData || []);
    } catch (error) {
      console.error('Failed to fetch filters', error);
    }
  };

  const fetchFarmers = async (coords = location, selectedVillage = village, selectedCrop = crop, selectedStage = stage, bigFarmersFlag = showBigFarmers) => {
    setLoading(true);
    setFarmers([]); // Clear existing list on fetch
    try {
      if (bigFarmersFlag && selectedVillage) {
        const data = await api.getBigFarmers(selectedVillage);
        setFarmers(data.map(f => ({
          farmer: { id: f.id, full_name: f.full_name, village: f.village },
          smart_score: 'VIP',
          tags: [`Highest Acreage: ${f.total_acreage} Acres`],
          is_overdue: false,
          overdue_days: 0,
          distance: null
        })));
      } else {
        const params = {};
        if (coords) {
          params.lat = coords.latitude;
          params.lng = coords.longitude;
        }
        if (selectedVillage) {
          params.village = selectedVillage;
        }
        if (selectedCrop) {
          params.crop = selectedCrop;
        }
        if (selectedStage) {
          params.stage = selectedStage;
        }
        
        const data = await api.getDailyPlan(params);
        setFarmers(data);
      }
    } catch (error) {
      console.error('Failed to fetch plan', error);
    } finally {
      setLoading(false);
    }
  };

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation(position.coords);
          fetchFarmers(position.coords, village, showBigFarmers);
        },
        (error) => {
          alert('Could not get location. Please ensure location services are enabled.');
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  };

  const handleVillageChange = (e) => {
    setVillage(e.target.value);
    fetchFarmers(location, e.target.value, crop, stage, showBigFarmers);
  };

  const handleCropChange = (e) => {
    setCrop(e.target.value);
    fetchFarmers(location, village, e.target.value, stage, showBigFarmers);
  };

  const handleStageChange = (e) => {
    setStage(e.target.value);
    fetchFarmers(location, village, crop, e.target.value, showBigFarmers);
  };

  const toggleBigFarmers = () => {
    const newVal = !showBigFarmers;
    setShowBigFarmers(newVal);
    fetchFarmers(location, village, crop, stage, newVal);
  };

  const createRoutePlan = () => {
    if (farmers.length === 0) return;
    
    // Attempt to collect coordinates from farmers' plots or just use village names
    // Given the Google Maps URL constraints, we'll try to find coordinates from plots 
    // or fallback to just location search
    const waypoints = farmers.slice(0, 9).map(f => {
        // If we have actual coordinates in the frontend, we would use them. 
        // For now, we can use Village + Taluka + District as a waypoint search string
        return encodeURIComponent(`${f.farmer.village} ${f.farmer.taluka || ''} ${f.farmer.district || ''}`);
    }).join('|');
    
    const origin = location ? `${location.latitude},${location.longitude}` : (farmers[0] ? encodeURIComponent(farmers[0].farmer.village) : '');
    
    if (!origin && !waypoints) return;
    
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&waypoints=${waypoints}&destination=${origin}`;
    window.open(url, '_blank');
  };

  const renderTags = (tags) => {
    return tags.map((tag, idx) => {
      let colorClass = 'bg-surface text-text-muted border-border';
      if (tag === 'Overdue Visit') colorClass = 'bg-danger/10 text-danger border-danger/20';
      if (tag === 'Large Active Plot') colorClass = 'bg-primary/10 text-primary border-primary/20';
      if (tag.includes('High Value') || tag.includes('Expected Price Surge')) colorClass = 'bg-accent/10 text-accent border-accent/20';
      if (tag.includes('Favorable Market Trend')) colorClass = 'bg-success/10 text-success border-success/20';
      if (tag.includes('Highest Acreage') || tag.includes('Top Acreage')) colorClass = 'bg-primary text-white border-primary';

      return (
        <span key={idx} className={`text-[10px] px-2 py-1 rounded-md border ${colorClass} font-medium`}>
          {tag}
        </span>
      );
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text">Smart Visit Planner</h1>
          <p className="text-text-muted text-sm mt-1">Plan your day based on location, crop stages, and market trends.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
             <select
              value={village}
              onChange={handleVillageChange}
              className="bg-bg border border-border text-text rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary transition-colors w-48 sm:w-64 appearance-none"
            >
              <option value="">Select a village...</option>
              {availableVillages.map((v, i) => (
                <option key={i} value={v.village}>
                  {v.village}
                </option>
              ))}
            </select>
          </div>
          
          <div className="relative">
             <select
              value={crop}
              onChange={handleCropChange}
              className="bg-bg border border-border text-text rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary transition-colors w-32 sm:w-40 appearance-none"
            >
              <option value="">All Crops</option>
              {availableCrops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.crop_name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
             <select
              value={stage}
              onChange={handleStageChange}
              className="bg-bg border border-border text-text rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary transition-colors w-32 sm:w-40 appearance-none"
            >
              <option value="">All Stages</option>
              {availableStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.stage_name}
                </option>
              ))}
            </select>
          </div>
          
          <button 
            onClick={toggleBigFarmers}
            disabled={!village}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${showBigFarmers ? 'bg-primary text-white' : 'bg-surface border border-border text-text-muted hover:bg-bg disabled:opacity-50'}`}
          >
            <TrendingUp size={16} />
            Top Acreage
          </button>

          <button 
            onClick={useCurrentLocation}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${location ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface border border-border text-text-muted hover:bg-bg'}`}
          >
            <Navigation size={16} className={location ? 'animate-pulse' : ''} />
            {location ? 'Location Active' : 'Use Current'}
          </button>

          {farmers.length > 0 && (
             <button 
               onClick={createRoutePlan}
               className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors"
             >
               <MapPin size={16} />
               Create Route Plan
             </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => (
                <div key={i} className="bg-surface rounded-2xl p-6 border border-border animate-pulse">
                    <div className="h-5 bg-bg rounded w-1/3 mb-4"></div>
                    <div className="h-4 bg-bg rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-bg rounded w-1/4"></div>
                </div>
            ))}
        </div>
      ) : farmers.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-2xl border border-border">
            <MapPin size={48} className="mx-auto text-text-muted/30 mb-4" />
            <h3 className="text-lg font-heading font-semibold text-text mb-2">No Farmers Found</h3>
            <p className="text-text-muted max-w-sm mx-auto">Try adjusting your location or village filter to find farmers to visit.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {farmers.map((item) => (
            <div key={item.farmer.id} className="bg-surface rounded-2xl p-5 border border-border hover:border-primary/30 transition-all shadow-sm hover:shadow-md flex flex-col justify-between group">
              <div 
                className="cursor-pointer" 
                onClick={() => setSelectedProfile({ ...item.farmer, smartScore: item.smart_score, tags: item.tags })}
              >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-heading font-semibold text-text group-hover:text-primary transition-colors">{item.farmer.full_name}</h3>
                      <div className="flex items-center gap-2 text-sm text-text-muted mt-1">
                        <MapPin size={14} />
                        <span>{item.farmer.village}</span>
                        {item.distance !== null && (
                          <span className="text-primary font-medium ml-2 bg-primary/5 px-2 py-0.5 rounded-full text-xs border border-primary/10">{item.distance} km away</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Smart Score</div>
                        <div className="text-2xl font-heading font-bold text-primary">{item.smart_score}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {renderTags(item.tags)}
                  </div>
              </div>

              <div className="pt-4 border-t border-border mt-2 flex justify-between items-center">
                <div className="text-sm">
                    {item.is_overdue ? (
                        <span className="flex items-center gap-1.5 text-danger font-medium"><AlertTriangle size={14}/> Overdue by {item.overdue_days} days</span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-text-muted"><CheckCircle size={14}/> Visited {item.overdue_days} days ago</span>
                    )}
                </div>
                <button 
                  onClick={() => setSelectedFarmer(item.farmer)}
                  className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Log Visit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <LogVisitModal 
        isOpen={!!selectedFarmer} 
        farmer={selectedFarmer} 
        onClose={() => setSelectedFarmer(null)} 
        onVisitLogged={() => fetchFarmers(location, village, crop, stage, showBigFarmers)}
      />

      <FarmerProfileModal
        isOpen={!!selectedProfile}
        farmer={selectedProfile}
        smartScore={selectedProfile?.smartScore}
        tags={selectedProfile?.tags}
        onClose={() => setSelectedProfile(null)}
        onLogVisit={(f) => {
            setSelectedProfile(null);
            setSelectedFarmer(f);
        }}
      />
    </div>
  );
}
