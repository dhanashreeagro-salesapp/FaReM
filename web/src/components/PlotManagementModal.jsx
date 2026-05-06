import React, { useState, useEffect } from 'react';
import { X, Map, Plus, Save, ChevronLeft, Calendar, DollarSign, Activity } from 'lucide-react';
import { MapContainer, TileLayer, Polygon, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';

function LocationSelector({ setPolygonPoints, polygonPoints }) {
  useMapEvents({
    click(e) {
      setPolygonPoints(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
    },
  });

  return polygonPoints.length > 0 ? <Polygon positions={polygonPoints} color="blue" /> : null;
}

export default function PlotManagementModal({ farmer, onClose }) {
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list', 'add_plot', 'plot_details'
  
  // Plot Add
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [form, setForm] = useState({ plot_name: '', soil_type: '', irrigation_source: '' });
  
  // Plot Details & Seasons
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [crops, setCrops] = useState([]);
  const [seasonForm, setSeasonForm] = useState({ crop: '', variety_name: '', sowing_date: '' });
  const [endSeasonForm, setEndSeasonForm] = useState({ total_yield_kg: '', total_income_rs: '', total_expenses_rs: '' });
  const [showEndForm, setShowEndForm] = useState(null);

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
        soil_type: form.soil_type,
        irrigation_source: form.irrigation_source,
        location_wkt: wkt
      });
      setView('list');
      setPolygonPoints([]);
      setForm({ plot_name: '', soil_type: '', irrigation_source: '' });
      fetchPlots();
    } catch (e) {
      alert(e.error || 'Failed to save plot');
    }
  };

  const handleStartSeason = async (e) => {
    e.preventDefault();
    try {
      await api.createCropSeason({
        plot: selectedPlot.id,
        crop: seasonForm.crop,
        variety_name: seasonForm.variety_name,
        sowing_date: seasonForm.sowing_date,
        status: 'Active'
      });
      setSeasonForm({ crop: '', variety_name: '', sowing_date: '' });
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

  const getCropName = (id) => crops.find(c => c.id === id)?.crop_name || 'Unknown Crop';

  const activeSeason = seasons.find(s => s.status === 'Active');
  const pastSeasons = seasons.filter(s => s.status === 'Completed');

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
              <div className="flex justify-end mb-4">
                <button onClick={() => setView('add_plot')} className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium text-sm btn-press">
                  <Plus size={16} /> Add New Plot
                </button>
              </div>

              {loading ? (
                <p className="text-center text-text-muted py-8">Loading plots...</p>
              ) : plots.length === 0 ? (
                <p className="text-center text-text-muted py-8">No plots found for this farmer.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plots.map(plot => (
                    <div key={plot.id} className="border border-border rounded-lg p-4 bg-bg hover:border-primary/50 cursor-pointer transition-colors" onClick={() => handleSelectPlot(plot)}>
                      <h3 className="font-heading font-semibold text-lg text-primary">{plot.plot_name}</h3>
                      <div className="mt-2 text-sm space-y-1">
                        <p className="flex justify-between"><span className="text-text-muted">Area:</span> <span className="font-mono">{plot.area_acres ? `${Number(plot.area_acres).toFixed(2)} Acres` : '—'}</span></p>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1">Plot Name</label>
                  <input required placeholder="e.g. North Field" value={form.plot_name} onChange={e => setForm({...form, plot_name: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
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
                <label className="block text-xs font-semibold text-text-muted mb-1">Map Plot Boundaries (Click map to add points)</label>
                <div className="h-64 rounded-lg overflow-hidden border border-border z-0">
                  <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <LocationSelector setPolygonPoints={setPolygonPoints} polygonPoints={polygonPoints} />
                  </MapContainer>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-text-muted">{polygonPoints.length} points selected</span>
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
              {/* Active Season */}
              <div className="card p-5 border-l-4 border-l-success">
                <h3 className="font-heading font-semibold text-lg flex items-center gap-2 mb-4"><Activity size={18} className="text-success" /> Active Crop Season</h3>
                {activeSeason ? (
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div><span className="block text-xs text-text-muted mb-1">Crop</span><span className="font-medium">{getCropName(activeSeason.crop)}</span></div>
                      <div><span className="block text-xs text-text-muted mb-1">Variety</span><span className="font-medium">{activeSeason.variety_name || '—'}</span></div>
                      <div><span className="block text-xs text-text-muted mb-1">Sowing Date</span><span className="font-medium">{activeSeason.sowing_date}</span></div>
                      <div><span className="block text-xs text-text-muted mb-1">Stage</span><span className="font-medium">{activeSeason.current_stage || 'Unknown'}</span></div>
                    </div>
                    
                    {showEndForm !== activeSeason.id ? (
                      <button onClick={() => setShowEndForm(activeSeason.id)} className="bg-danger hover:bg-danger-dark text-white px-4 py-2 rounded-lg text-sm font-medium btn-press transition-colors">End Cycle</button>
                    ) : (
                      <form onSubmit={(e) => handleEndSeason(e, activeSeason.id)} className="bg-bg p-4 rounded-lg border border-border">
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
                ) : (
                  <div>
                    <p className="text-sm text-text-muted mb-4">No active crop season for this plot.</p>
                    <form onSubmit={handleStartSeason} className="bg-bg p-4 rounded-lg border border-border grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Crop</label>
                        <select required value={seasonForm.crop} onChange={e => setSeasonForm({...seasonForm, crop: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface">
                          <option value="">Select Crop...</option>
                          {crops.map(c => <option key={c.id} value={c.id}>{c.crop_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Variety (Optional)</label>
                        <input value={seasonForm.variety_name} onChange={e => setSeasonForm({...seasonForm, variety_name: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface" />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Sowing Date</label>
                        <input type="date" required value={seasonForm.sowing_date} onChange={e => setSeasonForm({...seasonForm, sowing_date: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface" />
                      </div>
                      <div>
                        <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium btn-press">Start Season</button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* Past Seasons */}
              <div>
                <h3 className="font-heading font-semibold text-lg flex items-center gap-2 mb-4"><Calendar size={18} className="text-text-muted" /> Historical Cycles</h3>
                {pastSeasons.length > 0 ? (
                  <div className="space-y-3">
                    {pastSeasons.map(season => (
                      <div key={season.id} className="border border-border rounded-lg p-4 bg-bg flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                          <p className="font-medium text-text">{getCropName(season.crop)} {season.variety_name && <span className="text-text-muted text-sm border-l border-border pl-2 ml-2">{season.variety_name}</span>}</p>
                          <p className="text-sm text-text-muted mt-1">Sowed: {season.sowing_date}</p>
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
