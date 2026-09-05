import React, { useState, useMemo } from 'react';
import { X, ChevronRight, ChevronDown, Phone, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PlotsModal({ isOpen, onClose, data, loading }) {
  const [expandedVillages, setExpandedVillages] = useState({});
  const [expandedFarmers, setExpandedFarmers] = useState({});

  const groupedData = useMemo(() => {
    const villages = {};
    data.forEach(item => {
      const v = item.village || 'Unknown Village';
      const fId = item.farmer_id || 'unknown';
      if (!villages[v]) villages[v] = { farmers: {}, totalPlots: 0 };
      if (!villages[v].farmers[fId]) {
        villages[v].farmers[fId] = { 
          farmer_name: item.farmer_name, 
          mobile_number: item.mobile_number, 
          plots: [] 
        };
      }
      villages[v].farmers[fId].plots.push(item);
      villages[v].totalPlots++;
    });
    return villages;
  }, [data]);

  const toggleVillage = (v) => setExpandedVillages(prev => ({ ...prev, [v]: !prev[v] }));
  const toggleFarmer = (f) => setExpandedFarmers(prev => ({ ...prev, [f]: !prev[f] }));

  const expandAll = () => {
    const allV = {};
    const allF = {};
    Object.keys(groupedData).forEach(v => {
      allV[v] = true;
      Object.keys(groupedData[v].farmers).forEach(f => { allF[f] = true; });
    });
    setExpandedVillages(allV);
    setExpandedFarmers(allF);
  };

  const collapseAll = () => {
    setExpandedVillages({});
    setExpandedFarmers({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl max-w-5xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-border pb-3 shrink-0">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-heading font-bold text-text">Total Plots</h3>
            <div className="flex gap-2">
              <button onClick={expandAll} className="text-xs px-2 py-1 bg-surface border border-border rounded hover:bg-bg">Expand All</button>
              <button onClick={collapseAll} className="text-xs px-2 py-1 bg-surface border border-border rounded hover:bg-bg">Collapse All</button>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text rounded-lg">
            <X size={18} />
          </button>
        </div>
        {loading ? (
          <div className="py-12 text-center text-xs text-text-muted">Loading plots...</div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-2">
            {Object.keys(groupedData).length === 0 ? (
              <div className="p-4 text-center text-xs">No plots found.</div>
            ) : (
              Object.keys(groupedData).sort().map(village => (
                <div key={village} className="border border-border rounded-lg overflow-hidden">
                  <div 
                    className="p-3 bg-bg flex justify-between items-center cursor-pointer hover:bg-bg/80"
                    onClick={() => toggleVillage(village)}
                  >
                    <div className="flex items-center gap-2">
                      {expandedVillages[village] ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                      <span className="font-bold text-sm text-text">{village}</span>
                    </div>
                    <span className="text-sm font-semibold">{groupedData[village].totalPlots} Plots</span>
                  </div>
                  
                  {expandedVillages[village] && (
                    <div className="bg-surface border-t border-border p-2 space-y-2">
                      {Object.entries(groupedData[village].farmers).map(([fId, farmerData]) => (
                        <div key={fId} className="border border-border/60 rounded-md overflow-hidden ml-4">
                          <div className="p-2 bg-gray-50 flex justify-between items-center">
                            <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleFarmer(fId)}>
                              {expandedFarmers[fId] ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                              <Link to={`/farmers?search=${farmerData.mobile_number || encodeURIComponent(farmerData.farmer_name)}`} className="font-semibold text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                                {farmerData.farmer_name}
                              </Link>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-text-muted">{farmerData.plots.length} Plots</span>
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => window.open(`tel:${farmerData.mobile_number || ''}`)} 
                                  className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100" 
                                  title="Call"
                                >
                                  <Phone size={14} />
                                </button>
                                <Link 
                                  to={`/farmers?search=${farmerData.mobile_number || encodeURIComponent(farmerData.farmer_name)}`} 
                                  className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100"
                                  title="Log Visit"
                                >
                                  <MapPin size={14} />
                                </Link>
                              </div>
                            </div>
                          </div>
                          
                          {expandedFarmers[fId] && (
                            <div className="p-2 bg-white">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="text-text-muted border-b border-border/50">
                                    <th className="pb-1 pl-2">Plot Name</th>
                                    <th className="pb-1">Area (Acres)</th>
                                    <th className="pb-1">Active Crops</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {farmerData.plots.map((plot, idx) => (
                                    <tr key={plot.id || idx} className="border-b border-border/30 last:border-0">
                                      <td className="py-1.5 pl-2">{plot.plot_name}</td>
                                      <td className="py-1.5">{plot.area_acres}</td>
                                      <td className="py-1.5">{plot.active_crops_count}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CropsModal({ isOpen, onClose, data, loading }) {
  const [expandedCrops, setExpandedCrops] = useState({});

  const groupedData = useMemo(() => {
    const groups = {};
    data.forEach(item => {
      const crop = item.crop_name || 'Unknown Crop';
      if (!groups[crop]) {
        groups[crop] = { totalAcres: 0, stages: {} };
      }
      groups[crop].totalAcres += parseFloat(item.area_acres || 0);
      
      const stage = item.stage_name || 'Unknown Stage';
      if (!groups[crop].stages[stage]) {
        groups[crop].stages[stage] = 0;
      }
      groups[crop].stages[stage] += parseFloat(item.area_acres || 0);
    });
    return groups;
  }, [data]);

  const toggleCrop = (crop) => {
    setExpandedCrops(prev => ({ ...prev, [crop]: !prev[crop] }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-border pb-3 shrink-0">
          <h3 className="text-lg font-heading font-bold text-text">Active Crops Breakdown</h3>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text rounded-lg">
            <X size={18} />
          </button>
        </div>
        {loading ? (
          <div className="py-12 text-center text-xs text-text-muted">Loading crops...</div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-2">
            {Object.keys(groupedData).length === 0 ? (
              <div className="p-4 text-center text-xs">No active crops found.</div>
            ) : (
              Object.keys(groupedData).map((crop) => (
                <div key={crop} className="border border-border rounded-lg overflow-hidden">
                  <div 
                    className="p-3 bg-bg flex justify-between items-center cursor-pointer hover:bg-bg/80"
                    onClick={() => toggleCrop(crop)}
                  >
                    <div className="flex items-center gap-2">
                      {expandedCrops[crop] ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                      <span className="font-bold text-sm">{crop}</span>
                    </div>
                    <span className="text-sm font-semibold">{groupedData[crop].totalAcres.toFixed(2)} Acres</span>
                  </div>
                  {expandedCrops[crop] && (
                    <div className="p-3 bg-surface border-t border-border">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-text-muted border-b border-border">
                            <th className="pb-2 pl-4">Crop Stage</th>
                            <th className="pb-2 text-right pr-4">Acreage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(groupedData[crop].stages).map(([stage, acres]) => (
                            <tr key={stage} className="border-b border-border/50 last:border-0">
                              <td className="py-2 pl-4">{stage}</td>
                              <td className="py-2 text-right pr-4">{acres.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function VisitsModal({ isOpen, onClose, data, loading }) {
  if (!isOpen) return null;

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => new Date(b.created_at || b.check_in_time || 0) - new Date(a.created_at || a.check_in_time || 0));
  }, [data]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-border pb-3 shrink-0">
          <h3 className="text-lg font-heading font-bold text-text">Total Visits</h3>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text rounded-lg">
            <X size={18} />
          </button>
        </div>
        {loading ? (
          <div className="py-12 text-center text-xs text-text-muted">Loading visits...</div>
        ) : (
          <div className="overflow-y-auto flex-1 border border-border rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-bg text-text-muted sticky top-0 border-b border-border font-semibold">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Farmer</th>
                  <th className="p-3">Purpose</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedData.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-bg/50">
                    <td className="p-3 whitespace-nowrap">{new Date(item.created_at || item.check_in_time).toLocaleDateString()}</td>
                    <td className="p-3 font-bold">{item.farmer_name || (item.farmer && item.farmer.full_name) || 'Unknown'}</td>
                    <td className="p-3">{item.purpose}</td>
                    <td className="p-3">{item.status}</td>
                    <td className="p-3 max-w-xs truncate">{item.notes}</td>
                  </tr>
                ))}
                {sortedData.length === 0 && (
                  <tr><td colSpan="5" className="p-4 text-center">No visits found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function CallsModal({ isOpen, onClose, data, loading }) {
  if (!isOpen) return null;

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => new Date(b.created_at || b.call_time || 0) - new Date(a.created_at || a.call_time || 0));
  }, [data]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-border pb-3 shrink-0">
          <h3 className="text-lg font-heading font-bold text-text">Total Calls</h3>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text rounded-lg">
            <X size={18} />
          </button>
        </div>
        {loading ? (
          <div className="py-12 text-center text-xs text-text-muted">Loading calls...</div>
        ) : (
          <div className="overflow-y-auto flex-1 border border-border rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-bg text-text-muted sticky top-0 border-b border-border font-semibold">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Farmer</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedData.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-bg/50">
                    <td className="p-3 whitespace-nowrap">{new Date(item.created_at || item.call_time).toLocaleDateString()}</td>
                    <td className="p-3 font-bold">{item.farmer_name || (item.farmer && item.farmer.full_name) || 'Unknown'}</td>
                    <td className="p-3">{item.status}</td>
                    <td className="p-3 max-w-xs truncate">{item.notes}</td>
                  </tr>
                ))}
                {sortedData.length === 0 && (
                  <tr><td colSpan="4" className="p-4 text-center">No calls found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function OverdueModal({ isOpen, onClose, data, loading }) {
  const [sortConfig, setSortConfig] = useState({ key: 'overdue_days', direction: 'desc' });
  const [filters, setFilters] = useState({ village: '', district: '', crop_name: '', crop_stage: '' });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    let filtered = data.filter(item => {
      const vMatch = !filters.village || (item.village || '').toLowerCase().includes(filters.village.toLowerCase());
      const dMatch = !filters.district || (item.district || '').toLowerCase().includes(filters.district.toLowerCase());
      const cMatch = !filters.crop_name || (item.crop_name || '').toLowerCase().includes(filters.crop_name.toLowerCase());
      const sMatch = !filters.crop_stage || (item.crop_stage || '').toLowerCase().includes(filters.crop_stage.toLowerCase());
      return vMatch && dMatch && cMatch && sMatch;
    });

    return filtered.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, filters, sortConfig]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl max-w-6xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-border pb-3 shrink-0">
          <h3 className="text-lg font-heading font-bold text-text">Overdue Visits</h3>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-4 mb-2">
          <input 
            type="text" 
            placeholder="Filter Village..." 
            className="p-1.5 border border-border rounded text-xs flex-1"
            value={filters.village}
            onChange={(e) => setFilters({...filters, village: e.target.value})}
          />
          <input 
            type="text" 
            placeholder="Filter District..." 
            className="p-1.5 border border-border rounded text-xs flex-1"
            value={filters.district}
            onChange={(e) => setFilters({...filters, district: e.target.value})}
          />
          <input 
            type="text" 
            placeholder="Filter Crop..." 
            className="p-1.5 border border-border rounded text-xs flex-1"
            value={filters.crop_name}
            onChange={(e) => setFilters({...filters, crop_name: e.target.value})}
          />
          <input 
            type="text" 
            placeholder="Filter Stage..." 
            className="p-1.5 border border-border rounded text-xs flex-1"
            value={filters.crop_stage}
            onChange={(e) => setFilters({...filters, crop_stage: e.target.value})}
          />
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-text-muted">Loading overdue visits...</div>
        ) : (
          <div className="overflow-y-auto flex-1 border border-border rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-bg text-text-muted sticky top-0 border-b border-border font-semibold">
                <tr>
                  <th className="p-3 cursor-pointer hover:bg-black/5" onClick={() => handleSort('farmer_name')}>Farmer {sortConfig.key === 'farmer_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="p-3 cursor-pointer hover:bg-black/5" onClick={() => handleSort('crop_name')}>Crop {sortConfig.key === 'crop_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="p-3 cursor-pointer hover:bg-black/5" onClick={() => handleSort('crop_stage')}>Crop Stage {sortConfig.key === 'crop_stage' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="p-3 cursor-pointer hover:bg-black/5" onClick={() => handleSort('farmer_score')}>Score {sortConfig.key === 'farmer_score' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="p-3 cursor-pointer hover:bg-black/5" onClick={() => handleSort('acreage')}>Acreage {sortConfig.key === 'acreage' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="p-3 cursor-pointer hover:bg-black/5" onClick={() => handleSort('overdue_days')}>Overdue Days {sortConfig.key === 'overdue_days' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAndSortedData.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-bg/50">
                    <td className="p-3 font-bold">{item.farmer_name}</td>
                    <td className="p-3">{item.crop_name}</td>
                    <td className="p-3">{item.crop_stage}</td>
                    <td className="p-3 font-mono">{item.farmer_score}</td>
                    <td className="p-3 font-mono">{item.acreage}</td>
                    <td className="p-3 font-mono text-red-600 font-bold">{item.overdue_days}</td>
                  </tr>
                ))}
                {filteredAndSortedData.length === 0 && (
                  <tr><td colSpan="6" className="p-4 text-center">No overdue visits found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
