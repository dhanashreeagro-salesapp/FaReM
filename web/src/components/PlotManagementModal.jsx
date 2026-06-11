import React, { useState, useEffect, useRef } from 'react';
import { X, Map, Plus, Save, ChevronLeft, Calendar, DollarSign, Activity, Navigation, Search, Layers, Eye, EyeOff } from 'lucide-react';
import { MapContainer, TileLayer, Polygon, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import * as turf from '@turf/turf';

function LocationSelector({ setPolygonPoints, polygonPoints }) {
  useMapEvents({
    click(e) {
      setPolygonPoints(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
    },
  });

  return polygonPoints.length > 0 ? <Polygon positions={polygonPoints} color="blue" /> : null;
}

function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 15);
    }
  }, [center, map]);
  return null;
}

export default function PlotManagementModal({ farmer, onClose }) {
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list', 'add_plot', 'plot_details'
  const [showDisabled, setShowDisabled] = useState(false);
  
  // Plot Add
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [form, setForm] = useState({ plot_name: '', area_acres: '', soil_type: '', irrigation_source: '' });
  const [calculatedArea, setCalculatedArea] = useState(0);
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapLayer, setMapLayer] = useState('standard');
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef(null);
  
  // Plot Details & Seasons
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [crops, setCrops] = useState([]);
  const [seasonForm, setSeasonForm] = useState({ crop: '', variety_name: '', area_acres: '', sowing_date: '' });
  const [endSeasonForm, setEndSeasonForm] = useState({ total_yield_kg: '', total_income_rs: '', total_expenses_rs: '' });
  const [showEndForm, setShowEndForm] = useState(null);
  
  const [editAreaMode, setEditAreaMode] = useState(false);
  const [editedArea, setEditedArea] = useState('');

  const fetchPlots = async () => {
    setLoading(true);
    try {
      const data = await api.getPlots({ farmer: farmer.id });
      setPlots(Array.isArray(data) ? data : data.results || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPlots();
    api.getCrops().then(d => setCrops(Array.isArray(d) ? d : d.results || [])).catch(() => {});
  }, [farmer.id]);

  useEffect(() => {
    if (polygonPoints.length >= 3) {
      try {
        const coords = polygonPoints.map(p => [p[1], p[0]]); // GeoJSON needs [lng, lat]
        coords.push([polygonPoints[0][1], polygonPoints[0][0]]); // close polygon
        const polygon = turf.polygon([coords]);
        const areaSqMeters = turf.area(polygon);
        const areaAcres = areaSqMeters * 0.000247105;
        setCalculatedArea(areaAcres);
      } catch (e) {
        setCalculatedArea(0);
      }
    } else {
      setCalculatedArea(0);
    }
  }, [polygonPoints]);

  const fetchSeasons = async (plotId) => {
    setLoading(true);
    try {
      const data = await api.getCropSeasons({ plot: plotId });
      setSeasons(Array.isArray(data) ? data : data.results || []);
    } catch(e) {}
    setLoading(false);
  };

  const handleSelectPlot = (plot) => {
    setSelectedPlot(plot);
    setEditedArea(plot.area_acres || '');
    setEditAreaMode(false);
    setView('plot_details');
    fetchSeasons(plot.id);
  };

  const handleSavePlot = async (e) => {
    e.preventDefault();
    if (polygonPoints.length < 3) {
      alert("Please select at least 3 points on the map to define the plot area.");
      return;
    }

    let coords = polygonPoints.map(p => `${p[1]} ${p[0]}`);
    coords.push(`${polygonPoints[0][1]} ${polygonPoints[0][0]}`);
    const wkt = `POLYGON((${coords.join(', ')}))`;

    try {
      await api.createPlot({
        farmer: farmer.id,
        plot_name: form.plot_name,
        area_acres: form.area_acres || null,
        soil_type: form.soil_type,
        irrigation_source: form.irrigation_source,
        location_wkt: wkt,
        is_active: true
      });
      setView('list');
      setPolygonPoints([]);
      setForm({ plot_name: '', area_acres: '', soil_type: '', irrigation_source: '' });
      fetchPlots();
    } catch (e) {
      alert(e.error || 'Failed to save plot');
    }
  };

  const handleStartSeason = async (e) => {
    e.preventDefault();
    const allocatedArea = seasons.filter(s => s.status === 'Active').reduce((sum, s) => sum + parseFloat(s.area_acres || 0), 0);
    const newArea = parseFloat(seasonForm.area_acres || 0);
    const plotArea = parseFloat(selectedPlot.area_acres || 0);

    if (newArea + allocatedArea > plotArea) {
      alert(`Warning: Total area under crops (${newArea + allocatedArea} acres) exceeds the plot area (${plotArea} acres). Please correct the area.`);
      return;
    }

    try {
      await api.createCropSeason({
        plot: selectedPlot.id,
        crop: seasonForm.crop,
        variety_name: seasonForm.variety_name,
        area_acres: seasonForm.area_acres,
        sowing_date: seasonForm.sowing_date,
        status: 'Active'
      });
      setSeasonForm({ crop: '', variety_name: '', area_acres: '', sowing_date: '' });
      fetchSeasons(selectedPlot.id);
    } catch(e) {
      alert(e.error || 'Failed to start season');
    }
  };

  const handleEndSeason = async (e, seasonId) => {
    e.preventDefault();
    try {
      await api.updateCropSeason(seasonId, {
        status: 'Completed',
        total_yield_kg: endSeasonForm.total_yield_kg || null,
        total_income_rs: endSeasonForm.total_income_rs || null,
        total_expenses_rs: endSeasonForm.total_expenses_rs || null
      });
      setShowEndForm(null);
      setEndSeasonForm({ total_yield_kg: '', total_income_rs: '', total_expenses_rs: '' });
      fetchSeasons(selectedPlot.id);
    } catch(e) {
      alert(e.error || 'Failed to end season');
    }
  };

  const handleToggleDisablePlot = async () => {
    try {
      await api.updatePlot(selectedPlot.id, { is_active: !selectedPlot.is_active });
      fetchPlots();
      setView('list');
    } catch(e) {
      alert(e.error || 'Failed to update plot status');
    }
  };

  const handleUpdateArea = async () => {
    try {
      await api.updatePlot(selectedPlot.id, { area_acres: editedArea || null });
      setEditAreaMode(false);
      fetchPlots();
      setSelectedPlot({ ...selectedPlot, area_acres: editedArea });
    } catch(e) {
      alert(e.error || 'Failed to update area');
    }
  };

  const getCropName = (id) => crops.find(c => c.id === id)?.crop_name || 'Unknown Crop';

  // Map utilities
  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setMapCenter([pos.coords.latitude, pos.coords.longitude]),
        (err) => alert("Could not get location: " + err.message)
      );
    }
  };

  const handleToggleWalkBoundary = () => {
    if (isTracking) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      setIsTracking(false);
    } else {
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const newPoint = [pos.coords.latitude, pos.coords.longitude];
            setPolygonPoints(prev => [...prev, newPoint]);
            setMapCenter(newPoint);
          },
          (err) => {
            alert("Could not start tracking: " + err.message);
            setIsTracking(false);
          },
          { enableHighAccuracy: true }
        );
        setIsTracking(true);
      } else {
        alert("Geolocation is not supported by your browser.");
      }
    }
  };

  const handleSearchLocation = async () => {
    if (!searchQuery) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
      } else {
        alert("Location not found.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const activeSeasons = seasons.filter(s => s.status === 'Active');
  const pastSeasons = seasons.filter(s => s.status === 'Completed');
  const visiblePlots = plots.filter(p => showDisabled ? true : p.is_active !== false);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-surface w-full max-w-4xl rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-border">
          <div className="flex items-center gap-3">
            {view !== 'list' && (
              <button onClick={() => setView('list')} className="p-1 hover:bg-bg rounded-lg transition-colors">
                <ChevronLeft size={20} />
              </button>
            )}
            <h2 className="text-xl font-heading font-bold text-text">
              {view === 'plot_details' ? `Manage Plot: ${selectedPlot?.plot_name}` : `Manage Plots - ${farmer.full_name}`}
            </h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text btn-press"><X size={20} /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {view === 'list' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <button onClick={() => setShowDisabled(!showDisabled)} className="flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors">
                  {showDisabled ? <EyeOff size={16}/> : <Eye size={16}/>} {showDisabled ? 'Hide Disabled Plots' : 'View Disabled Plots'}
                </button>
                <button onClick={() => setView('add_plot')} className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium text-sm btn-press">
                  <Plus size={16} /> Add New Plot
                </button>
              </div>

              {loading ? (
                <p className="text-center text-text-muted py-8">Loading plots...</p>
              ) : visiblePlots.length === 0 ? (
                <p className="text-center text-text-muted py-8">No plots found for this farmer.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visiblePlots.map(plot => (
                    <div key={plot.id} className={`border ${plot.is_active === false ? 'border-danger/30 bg-danger/5 opacity-70' : 'border-border bg-bg'} rounded-lg p-4 hover:border-primary/50 cursor-pointer transition-colors`} onClick={() => handleSelectPlot(plot)}>
                      <h3 className="font-heading font-semibold text-lg text-primary">{plot.plot_name} {plot.is_active === false && <span className="text-xs text-danger ml-2">(Disabled)</span>}</h3>
                      <div className="mt-2 text-sm space-y-1">
                        <p className="flex justify-between"><span className="text-text-muted">Area:</span> <span className="font-mono text-right">{plot.area_acres ? `${Number(plot.area_acres).toFixed(2)} Acres` : '—'} {plot.calculated_area_acres && <span className="text-[10px] text-text-muted block">(Geo: {Number(plot.calculated_area_acres).toFixed(2)})</span>}</span></p>
                        <p className="flex justify-between"><span className="text-text-muted">Soil:</span> <span>{plot.soil_type || '—'}</span></p>
                        <p className="flex justify-between"><span className="text-text-muted">Irrigation:</span> <span>{plot.irrigation_source || '—'}</span></p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-border/50 text-right">
                        <span className="text-sm font-medium text-primary flex items-center justify-end gap-1"><Map size={14} /> Manage Seasons &rarr;</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'add_plot' && (
            <form onSubmit={handleSavePlot}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Plot Name</label>
                  <input required placeholder="e.g. North Field" value={form.plot_name} onChange={e => setForm({...form, plot_name: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Area (Acres)</label>
                  <div className="flex gap-2 items-center">
                    <input type="number" step="0.01" required placeholder="e.g. 5.5" value={form.area_acres} onChange={e => setForm({...form, area_acres: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
                    {calculatedArea > 0 && (
                      <div className="flex-none bg-primary/10 text-primary border border-primary/20 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap">
                        Geofenced: {calculatedArea.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Soil Type</label>
                  <input placeholder="e.g. Black Cotton" value={form.soil_type} onChange={e => setForm({...form, soil_type: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Irrigation Source</label>
                  <input placeholder="e.g. Well, Canal" value={form.irrigation_source} onChange={e => setForm({...form, irrigation_source: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-xs font-semibold text-text-muted">Map Plot Boundaries</label>
                  <div className="flex gap-2">
                    <div className="flex border border-border rounded-lg overflow-hidden">
                      <input type="text" placeholder="Village, District" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSearchLocation())} className="px-2 py-1 text-xs outline-none bg-surface" />
                      <button type="button" onClick={handleSearchLocation} className="px-2 bg-bg hover:bg-border"><Search size={14}/></button>
                    </div>
                    <button type="button" onClick={() => setMapLayer(l => l === 'standard' ? 'satellite' : 'standard')} className="px-2 py-1 text-xs border border-border rounded-lg bg-surface flex items-center gap-1 hover:bg-bg"><Layers size={14}/> {mapLayer === 'standard' ? 'Satellite' : 'Standard'}</button>
                    <button type="button" onClick={handleUseCurrentLocation} className="px-2 py-1 text-xs border border-border rounded-lg bg-surface flex items-center gap-1 hover:bg-bg"><Navigation size={14}/> My Location</button>
                    <button type="button" onClick={handleToggleWalkBoundary} className={`px-2 py-1 text-xs border border-border rounded-lg flex items-center gap-1 ${isTracking ? 'bg-primary text-white' : 'bg-surface hover:bg-bg'}`}>
                      <Map size={14}/> {isTracking ? 'Stop Walking' : 'Map by Walking'}
                    </button>
                  </div>
                </div>
                <div className="h-64 rounded-lg overflow-hidden border border-border z-0">
                  <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                    <MapController center={mapCenter} />
                    {mapLayer === 'standard' ? (
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    ) : (
                      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                    )}
                    <LocationSelector setPolygonPoints={setPolygonPoints} polygonPoints={polygonPoints} />
                  </MapContainer>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-text-muted">
                    {polygonPoints.length} points selected. 
                    {calculatedArea > 0 && <span className="ml-2 font-medium text-primary">Geofenced Area: {calculatedArea.toFixed(2)} Acres</span>}
                  </span>
                  <button type="button" onClick={() => setPolygonPoints([])} className="text-xs text-danger hover:underline">Clear Points</button>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4 mt-4">
                <button type="button" onClick={() => setView('list')} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-bg btn-press">Cancel</button>
                <button type="submit" className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium btn-press">
                  <Save size={16} /> Save Plot
                </button>
              </div>
            </form>
          )}

          {view === 'plot_details' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between md:items-center bg-bg p-4 rounded-lg border border-border gap-4">
                <div className="flex gap-6">
                  <div>
                    <p className="text-sm text-text-muted uppercase">Plot Status</p>
                    <p className="font-semibold">{selectedPlot?.is_active !== false ? 'Active' : 'Disabled'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted uppercase">Area (Acres)</p>
                    {editAreaMode ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input type="number" step="0.01" value={editedArea} onChange={e => setEditedArea(e.target.value)} className="w-24 px-2 py-1 border border-border rounded text-sm" />
                        <button onClick={handleUpdateArea} className="text-xs bg-primary text-white px-2 py-1 rounded">Save</button>
                        <button onClick={() => setEditAreaMode(false)} className="text-xs border border-border px-2 py-1 rounded">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">
                          {selectedPlot?.area_acres ? Number(selectedPlot.area_acres).toFixed(2) : '—'}
                          {selectedPlot?.calculated_area_acres && <span className="text-xs text-text-muted font-normal ml-2">(Geo: {Number(selectedPlot.calculated_area_acres).toFixed(2)})</span>}
                        </p>
                        <button onClick={() => setEditAreaMode(true)} className="text-xs text-primary hover:underline">Edit</button>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={handleToggleDisablePlot} className={`px-4 py-2 rounded-lg text-sm font-medium btn-press whitespace-nowrap ${selectedPlot?.is_active !== false ? 'bg-danger text-white' : 'bg-success text-white'}`}>
                  {selectedPlot?.is_active !== false ? 'Disable Plot' : 'Enable Plot'}
                </button>
              </div>

              {selectedPlot?.is_active !== false && (
                <>
                  <div className="card p-5 border-l-4 border-l-success">
                    <h3 className="font-heading font-semibold text-lg flex items-center gap-2 mb-4"><Activity size={18} className="text-success" /> Active Crop Seasons</h3>
                    {activeSeasons.length > 0 ? (
                      <div className="space-y-6">
                        {activeSeasons.map(activeSeason => (
                          <div key={activeSeason.id} className="border-b border-border/50 pb-4 last:border-0 last:pb-0">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                              <div><span className="block text-xs text-text-muted mb-1">Crop</span><span className="font-medium">{getCropName(activeSeason.crop)}</span></div>
                              <div><span className="block text-xs text-text-muted mb-1">Variety</span><span className="font-medium">{activeSeason.variety_name || '—'}</span></div>
                              <div><span className="block text-xs text-text-muted mb-1">Area</span><span className="font-medium">{activeSeason.area_acres || selectedPlot.area_acres} Acres</span></div>
                              <div><span className="block text-xs text-text-muted mb-1">Sowing Date</span><span className="font-medium">{activeSeason.sowing_date}</span></div>
                              <div><span className="block text-xs text-text-muted mb-1">Stage</span><span className="font-medium">{activeSeason.current_stage?.stage_name || 'Unknown'}</span></div>
                            </div>
                            
                            {showEndForm !== activeSeason.id ? (
                              <button onClick={() => setShowEndForm(activeSeason.id)} className="bg-danger hover:bg-danger-dark text-white px-4 py-2 rounded-lg text-sm font-medium btn-press transition-colors">End Cycle</button>
                            ) : (
                              <form onSubmit={(e) => handleEndSeason(e, activeSeason.id)} className="bg-bg p-4 rounded-lg border border-border mt-2">
                                <h4 className="text-sm font-semibold mb-3">Record Financials</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                  <div>
                                    <label className="block text-xs text-text-muted mb-1">Total Yield (Kg)</label>
                                    <input type="number" required value={endSeasonForm.total_yield_kg} onChange={e => setEndSeasonForm({...endSeasonForm, total_yield_kg: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface" />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-text-muted mb-1">Total Income (₹)</label>
                                    <input type="number" required value={endSeasonForm.total_income_rs} onChange={e => setEndSeasonForm({...endSeasonForm, total_income_rs: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface" />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-text-muted mb-1">Total Expenses (₹) (Optional)</label>
                                    <input type="number" value={endSeasonForm.total_expenses_rs} onChange={e => setEndSeasonForm({...endSeasonForm, total_expenses_rs: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface" />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button type="submit" className="bg-success text-white px-4 py-2 rounded-lg text-sm font-medium btn-press">Submit & Close Season</button>
                                  <button type="button" onClick={() => setShowEndForm(null)} className="px-4 py-2 border border-border rounded-lg text-sm bg-surface btn-press">Cancel</button>
                                </div>
                              </form>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-text-muted mb-4">No active crop season for this plot.</p>
                    )}

                    <div className="mt-6 pt-4 border-t border-border">
                      <h4 className="font-semibold text-sm mb-3">Add Another Crop</h4>
                      <form onSubmit={handleStartSeason} className="bg-bg p-4 rounded-lg border border-border grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div>
                          <label className="block text-xs text-text-muted mb-1">Crop *</label>
                          <select required value={seasonForm.crop} onChange={e => setSeasonForm({...seasonForm, crop: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface">
                            <option value="">Select Crop...</option>
                            {crops.map(c => <option key={c.id} value={c.id}>{c.crop_name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-text-muted mb-1">Variety</label>
                          {(() => {
                            const selectedCropObj = crops.find(c => c.id === seasonForm.crop);
                            return selectedCropObj && selectedCropObj.varieties && selectedCropObj.varieties.length > 0 ? (
                              <select value={seasonForm.variety_name} onChange={e => setSeasonForm({...seasonForm, variety_name: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface">
                                <option value="">Select Variety...</option>
                                {selectedCropObj.varieties.map(v => <option key={v.id} value={v.variety_name}>{v.variety_name}</option>)}
                              </select>
                            ) : (
                              <input value={seasonForm.variety_name} onChange={e => setSeasonForm({...seasonForm, variety_name: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface" />
                            );
                          })()}
                        </div>
                        <div>
                          <label className="block text-xs text-text-muted mb-1">Area (Acres)</label>
                          <input type="number" step="0.01" required value={seasonForm.area_acres} onChange={e => setSeasonForm({...seasonForm, area_acres: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface" />
                        </div>
                        <div>
                          <label className="block text-xs text-text-muted mb-1">Sowing Date *</label>
                          <input type="date" required value={seasonForm.sowing_date} onChange={e => setSeasonForm({...seasonForm, sowing_date: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface" />
                        </div>
                        <div>
                          <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium btn-press">Add Crop</button>
                        </div>
                      </form>
                      <p className="text-xs text-text-muted mt-2">Plot Total Area: {selectedPlot.area_acres} Acres. Allocated: {seasons.filter(s=>s.status==='Active').reduce((sum,s)=>sum+parseFloat(s.area_acres||0),0)} Acres.</p>
                    </div>
                  </div>
                </>
              )}

              {/* Past Seasons */}
              <div>
                <h3 className="font-heading font-semibold text-lg flex items-center gap-2 mb-4"><Calendar size={18} className="text-text-muted" /> Historical Cycles</h3>
                {pastSeasons.length > 0 ? (
                  <div className="space-y-3">
                    {pastSeasons.map(season => (
                      <div key={season.id} className="border border-border rounded-lg p-4 bg-bg flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                          <p className="font-medium text-text">{getCropName(season.crop)} {season.variety_name && <span className="text-text-muted text-sm border-l border-border pl-2 ml-2">{season.variety_name}</span>}</p>
                          <p className="text-sm text-text-muted mt-1">Sowed: {season.sowing_date} • Area: {season.area_acres || selectedPlot.area_acres} Acres</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm font-mono">
                          <div className="bg-surface px-3 py-1.5 rounded-lg border border-border"><span className="text-text-muted block text-[10px] uppercase">Yield</span>{season.total_yield_kg ? `${season.total_yield_kg} Kg` : '—'}</div>
                          <div className="bg-success/10 text-success px-3 py-1.5 rounded-lg"><span className="text-success/70 block text-[10px] uppercase">Income</span>{season.total_income_rs ? `₹${season.total_income_rs}` : '—'}</div>
                          <div className="bg-danger/10 text-danger px-3 py-1.5 rounded-lg"><span className="text-danger/70 block text-[10px] uppercase">Expenses</span>{season.total_expenses_rs ? `₹${season.total_expenses_rs}` : '—'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">No historical crop cycles recorded.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
