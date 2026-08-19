import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthProvider';
import { normalizeDashboardMetrics, normalizeHierarchyResponse } from '../services/dataAdapter';
import { Users, Phone, MapPin, TrendingUp, Download, AlertTriangle, X, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';

function StatCard({ icon: Icon, label, value, color, delay, onClick, to }) {
  const content = (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-text-muted uppercase tracking-wide font-heading">{label}</p>
        <p className="text-2xl font-heading font-bold text-text mt-1">{value ?? '—'}</p>
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={20} />
      </div>
    </div>
  );

  if (onClick) {
    return (
      <div onClick={onClick} className="card p-5 animate-stagger-in hover:shadow-md transition-all cursor-pointer border hover:border-emerald-500" style={{ animationDelay: `${delay}ms` }}>
        {content}
      </div>
    );
  }

  return to ? (
    <Link to={to} className="card p-5 animate-stagger-in hover:shadow-md transition-all block" style={{ animationDelay: `${delay}ms` }}>
      {content}
    </Link>
  ) : (
    <div className="card p-5 animate-stagger-in" style={{ animationDelay: `${delay}ms` }}>
      {content}
    </div>
  );
}

function HierarchyNode({ node, level = 0 }) {
  const [expanded, setExpanded] = useState(true);
  if (!node) return null;

  const children = node.children || [];
  const hasSub = children.length > 0;

  return (
    <div className="space-y-3">
      <div className={`p-4 rounded-2xl border transition-all shadow-sm ${level === 0 ? 'bg-emerald-900 text-white border-emerald-800' : level === 1 ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' : 'bg-surface border-border text-text'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5 border-current/15">
          <div className="flex items-center gap-2">
            {hasSub && (
              <button onClick={() => setExpanded(!expanded)} className="p-1 rounded hover:bg-black/10 font-bold text-xs">
                {expanded ? '▼' : '►'}
              </button>
            )}
            <div>
              <h4 className="font-heading font-bold text-sm leading-tight">{node.name}</h4>
              <p className="text-[11px] opacity-80 font-semibold">{node.role} • {node.territoryName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono font-bold">
            <span className="px-2.5 py-1 rounded-full bg-black/10 text-current border border-current/20">
              Perf: {node.performancePct}%
            </span>
            <span className="text-[10px] opacity-75">Live</span>
          </div>
        </div>

        {/* Node Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-3 text-center text-xs">
          <div className="p-1.5 rounded-lg bg-black/5">
            <p className="text-[10px] opacity-70 uppercase font-semibold">Farmers</p>
            <p className="font-bold text-sm font-mono mt-0.5">{node.farmerCount}</p>
          </div>
          <div className="p-1.5 rounded-lg bg-black/5">
            <p className="text-[10px] opacity-70 uppercase font-semibold">Plots</p>
            <p className="font-bold text-sm font-mono mt-0.5">{node.plotCount}</p>
          </div>
          <div className="p-1.5 rounded-lg bg-black/5">
            <p className="text-[10px] opacity-70 uppercase font-semibold">Crops</p>
            <p className="font-bold text-sm font-mono mt-0.5">{node.activeCropCount}</p>
          </div>
          <div className="p-1.5 rounded-lg bg-black/5">
            <p className="text-[10px] opacity-70 uppercase font-semibold">Visits</p>
            <p className="font-bold text-sm font-mono mt-0.5">{node.visitsCount}</p>
          </div>
          <div className="p-1.5 rounded-lg bg-black/5">
            <p className="text-[10px] opacity-70 uppercase font-semibold">Calls</p>
            <p className="font-bold text-sm font-mono mt-0.5">{node.callsCount}</p>
          </div>
          <div className="p-1.5 rounded-lg bg-black/5">
            <p className="text-[10px] opacity-70 uppercase font-semibold">Advisories</p>
            <p className="font-bold text-sm font-mono mt-0.5">{node.recommendationsCount}</p>
          </div>
          <div className="p-1.5 rounded-lg bg-black/5">
            <p className="text-[10px] opacity-70 uppercase font-semibold">WhatsApp</p>
            <p className="font-bold text-sm font-mono mt-0.5">{node.whatsappCount}</p>
          </div>
        </div>
      </div>

      {hasSub && expanded && (
        <div className="pl-4 sm:pl-6 border-l-2 border-emerald-500/30 space-y-3">
          {children.map(sub => (
            <HierarchyNode key={sub.id} node={sub} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [hierarchyData, setHierarchyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const [activeCropsList, setActiveCropsList] = useState([]);
  const [farmerPlotsList, setFarmerPlotsList] = useState([]);
  const [showActiveCropsModal, setShowActiveCropsModal] = useState(false);
  const [showPlotsModal, setShowPlotsModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await api.getDashboard({ refresh: 'true' });
      const normalized = normalizeDashboardMetrics(raw);
      setMetrics(normalized);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError("Unable to load live dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [user?.email]);

  const handleOpenActiveCropsModal = async () => {
    setShowActiveCropsModal(true);
    setModalLoading(true);
    try {
      const res = await api.getActiveCrops();
      const list = Array.isArray(res) ? res : (res?.results || []);
      setActiveCropsList(list);
    } catch (err) {
      console.error("Failed loading active crops:", err);
      setActiveCropsList([]);
    }
    setModalLoading(false);
  };

  const handleOpenPlotsModal = async () => {
    setShowPlotsModal(true);
    setModalLoading(true);
    try {
      const res = await api.getFarmerPlots();
      const list = Array.isArray(res) ? res : (res?.results || []);
      setFarmerPlotsList(list);
    } catch (err) {
      console.error("Failed loading farmer plots:", err);
      setFarmerPlotsList([]);
    }
    setModalLoading(false);
  };

  const handleLoadHierarchy = async () => {
    setActiveTab('hierarchy');
    setModalLoading(true);
    try {
      const res = await api.getHierarchy();
      const normalized = normalizeHierarchyResponse(res);
      setHierarchyData(normalized);
    } catch (err) {
      console.error("Failed loading hierarchy:", err);
      setHierarchyData([]);
    }
    setModalLoading(false);
  };

  const handleExport = async (type) => {
    try {
      const response = await api.exportReport(type);
      if (response instanceof Response) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report.${type === 'excel' ? 'xlsx' : 'pdf'}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export error:", err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-8 bg-border/40 rounded-xl w-64 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-surface border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center bg-red-50 border border-red-200 rounded-2xl space-y-4">
        <AlertTriangle size={32} className="mx-auto text-red-600" />
        <p className="text-sm font-semibold text-red-800">{error}</p>
        <button onClick={fetchDashboard} className="px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition-all">
          Retry Fetching Dashboard Data
        </button>
      </div>
    );
  }

  const isManager = ['Admin', 'ZonalManager', 'TerritoryManager'].includes(user?.role);

  return (
    <div className="space-y-6">
      {/* Top Header Branding Banner */}
      <div className="p-5 bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-950 text-white rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <img src="/agriamigo-logo.png" alt="Agri Amigo Logo" className="w-12 h-12 object-contain rounded-xl bg-white/10 p-1 shadow-inner shrink-0" />
          <div>
            <h2 className="text-xl font-heading font-bold tracking-tight">Agri Amigo – Together for Better Farms</h2>
            <p className="text-xs text-emerald-200 mt-0.5">
              Logged in as <span className="font-bold text-white">{user?.full_name || user?.email}</span> ({user?.role || 'Sales Director'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isManager && (
            <div className="flex bg-black/20 p-1 rounded-xl border border-white/10 text-xs font-semibold">
              <button 
                onClick={() => setActiveTab('overview')} 
                className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'overview' ? 'bg-white text-emerald-900 shadow-md font-bold' : 'text-emerald-100 hover:text-white'}`}
              >
                Metrics Overview
              </button>
              <button 
                onClick={handleLoadHierarchy} 
                className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'hierarchy' ? 'bg-white text-emerald-900 shadow-md font-bold' : 'text-emerald-100 hover:text-white'}`}
              >
                Org Hierarchy Tree
              </button>
            </div>
          )}

          <button onClick={() => handleExport('excel')} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border border-white/20">
            <Download size={14} /> Excel
          </button>
          <button onClick={() => handleExport('pdf')} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border border-white/20">
            <Download size={14} /> PDF
          </button>
        </div>
      </div>

      {/* Dev-only Diagnostic Trace Drawer Banner */}
      {(window.location.search.includes('debug=true') || metrics?.debugTrace) && (
        <details className="bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-700 text-xs font-mono" open>
          <summary className="font-bold cursor-pointer text-emerald-400">
            🔍 AUTHORITATIVE FRONTEND DATA TRACE — Auth: {user?.email} [{user?.role}]
          </summary>
          <div className="mt-3 space-y-1.5 text-[11px] border-t border-slate-800 pt-2.5">
            <p><strong>Auth User Email:</strong> {user?.email}</p>
            <p><strong>Auth User Role:</strong> {user?.role}</p>
            <p><strong>Canonical Metrics:</strong> Active Farmers: {metrics?.totalFarmers} | Total Plots: {metrics?.totalPlots} | Active Crops: {metrics?.activeCrops} | Visits: {metrics?.totalVisits} | Calls: {metrics?.totalCalls}</p>
            <p><strong>DB Total Farmers (Raw):</strong> {metrics?.debugTrace?.db_total_farmers_all ?? 'N/A'}</p>
            <p><strong>Filtered Scope Count:</strong> {metrics?.debugTrace?.filtered_farmers_count ?? metrics?.totalFarmers}</p>
          </div>
        </details>
      )}

      {/* Main Content Area */}
      {activeTab === 'overview' ? (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard icon={Users} label="Total Active Farmers" value={metrics?.totalFarmers?.toLocaleString()} color="bg-emerald-50 text-emerald-700" delay={0} to="/farmers" />
            <StatCard icon={MapPin} label="Total Plots (Click)" value={metrics?.totalPlots?.toLocaleString()} color="bg-blue-50 text-blue-700" delay={30} onClick={handleOpenPlotsModal} />
            <StatCard icon={TrendingUp} label="Active Crops (Click)" value={metrics?.activeCrops?.toLocaleString()} color="bg-amber-50 text-amber-700" delay={60} onClick={handleOpenActiveCropsModal} />
            <StatCard icon={MapPin} label="Total Visits" value={metrics?.totalVisits?.toLocaleString()} color="bg-purple-50 text-purple-700" delay={90} />
            <StatCard icon={Phone} label="Total Calls" value={metrics?.totalCalls?.toLocaleString()} color="bg-sky-50 text-sky-700" delay={120} />
            <StatCard icon={AlertTriangle} label="Overdue Visits" value={metrics?.overdueVisits?.toLocaleString()} color="bg-red-50 text-danger" delay={150} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard icon={Users} label="Enrolled This Month" value={metrics?.thisMonthFarmers?.toLocaleString()} color="bg-emerald-50 text-emerald-700" delay={240} to="/farmers?enrolled=this_month" />
            <StatCard icon={Users} label="Enrolled Last Month" value={metrics?.lastMonthFarmers?.toLocaleString()} color="bg-emerald-50 text-emerald-700" delay={300} to="/farmers?enrolled=last_month" />
            <StatCard icon={Users} label="Enrolled YTD (from Apr 1)" value={metrics?.ytdFarmers?.toLocaleString()} color="bg-emerald-50 text-emerald-700" delay={360} to="/farmers?enrolled=ytd" />
          </div>

          {/* Top Villages & Market Trends */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="card p-5">
              <h3 className="font-heading font-bold text-text mb-4 flex items-center gap-2 text-sm">
                <TrendingUp size={16} className="text-emerald-700" /> Top Villages by Farmer Count
              </h3>
              {metrics?.topVillages?.length > 0 ? (
                <div className="space-y-3">
                  {metrics.topVillages.map((v, i) => {
                    const maxCount = metrics.topVillages[0].count;
                    const pct = maxCount > 0 ? (v.count / maxCount * 100) : 0;
                    return (
                      <div key={i} className="flex items-center gap-4">
                        <span className="text-xs font-semibold text-text w-28 truncate">{v.village}</span>
                        <div className="flex-1 bg-bg rounded-full h-5 overflow-hidden">
                          <div className="bg-emerald-600 h-full rounded-full flex items-center px-2.5 transition-all duration-500" style={{ width: `${Math.max(pct, 12)}%` }}>
                            <span className="text-[10px] font-mono font-bold text-white">{v.count}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-text-muted">No village data available.</p>
              )}
            </div>

            {/* Active Crops by Stage Breakdown */}
            <div className="card p-5">
              <h3 className="font-heading font-bold text-text mb-4 flex items-center gap-2 text-sm">
                <Layers size={16} className="text-emerald-700" /> Active Crops Stage Distribution
              </h3>
              {metrics?.cropStageBreakup && Object.keys(metrics.cropStageBreakup).length > 0 ? (
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {Object.entries(metrics.cropStageBreakup).map(([crop, stages]) => (
                    <div key={crop} className="p-3 border border-border rounded-xl bg-surface space-y-1.5">
                      <p className="text-xs font-bold text-emerald-900 border-b border-border pb-1">{crop}</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {Object.entries(stages).map(([stage, count]) => (
                          <span key={stage} className="text-[11px] font-medium bg-bg border border-border px-2 py-0.5 rounded-lg">
                            {stage}: <strong className="text-emerald-700">{count}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted">No active crop stage breakdown data available.</p>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Hierarchy Tab */
        <div className="card p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-4">
            <div>
              <h3 className="text-base font-heading font-bold text-text">Organizational Hierarchy & Field Staff Performance</h3>
              <p className="text-xs text-text-muted">Interactive reporting hierarchy tree with real-time performance indicators</p>
            </div>
            <button onClick={handleLoadHierarchy} className="text-xs text-emerald-700 font-bold hover:underline">
              Refresh Hierarchy Data
            </button>
          </div>

          {modalLoading ? (
            <div className="py-12 text-center text-xs text-text-muted animate-pulse">Building organization reporting hierarchy tree...</div>
          ) : (
            <div className="space-y-4">
              {hierarchyData.map(node => (
                <HierarchyNode key={node.id} node={node} level={0} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Crops Modal */}
      {showActiveCropsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-border pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} className="text-emerald-700" />
                <h3 className="text-base font-heading font-bold text-text">Active Crop Listing</h3>
              </div>
              <button onClick={() => setShowActiveCropsModal(false)} className="p-1.5 text-text-muted hover:text-text rounded-lg">
                <X size={18} />
              </button>
            </div>

            {modalLoading ? (
              <div className="py-12 text-center text-xs text-text-muted">Loading active crops...</div>
            ) : (
              <div className="overflow-y-auto flex-1 border border-border rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-bg text-text-muted sticky top-0 border-b border-border font-semibold">
                    <tr>
                      <th className="p-3">Crop</th>
                      <th className="p-3">Growth Stage</th>
                      <th className="p-3">Area (Acres)</th>
                      <th className="p-3">Farmer</th>
                      <th className="p-3">Village</th>
                      <th className="p-3">Plot</th>
                      <th className="p-3">Mobile</th>
                      <th className="p-3 text-right">Advisories</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeCropsList.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-8 text-center text-text-muted italic">
                          No active crop seasons found for your team hierarchy.
                        </td>
                      </tr>
                    ) : (
                      activeCropsList.map(c => (
                        <tr key={c.id} className="hover:bg-bg/50">
                          <td className="p-3 font-bold text-text">{c.crop_name}</td>
                          <td className="p-3"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-full font-semibold">{c.stage_name}</span></td>
                          <td className="p-3 font-mono font-semibold">{c.area_acres}</td>
                          <td className="p-3 font-medium text-text">{c.farmer_name}</td>
                          <td className="p-3">{c.village}</td>
                          <td className="p-3 text-text-muted">{c.plot_name}</td>
                          <td className="p-3 font-mono">{c.mobile_number}</td>
                          <td className="p-3 text-right font-mono font-bold">{c.recommendation_count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Farmer Plots Modal */}
      {showPlotsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-border pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <MapPin size={20} className="text-blue-600" />
                <h3 className="text-base font-heading font-bold text-text">Farmer Plots Listing</h3>
              </div>
              <button onClick={() => setShowPlotsModal(false)} className="p-1.5 text-text-muted hover:text-text rounded-lg">
                <X size={18} />
              </button>
            </div>

            {modalLoading ? (
              <div className="py-12 text-center text-xs text-text-muted">Loading farmer plots...</div>
            ) : (
              <div className="overflow-y-auto flex-1 border border-border rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-bg text-text-muted sticky top-0 border-b border-border font-semibold">
                    <tr>
                      <th className="p-3">Plot Name</th>
                      <th className="p-3">Area (Acres)</th>
                      <th className="p-3">Soil Type</th>
                      <th className="p-3">Farmer</th>
                      <th className="p-3">Village</th>
                      <th className="p-3">Mobile</th>
                      <th className="p-3 text-right">Active Crop</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {farmerPlotsList.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-text-muted italic">
                          No farmer plots found for your team hierarchy.
                        </td>
                      </tr>
                    ) : (
                      farmerPlotsList.map(p => (
                        <tr key={p.id} className="hover:bg-bg/50">
                          <td className="p-3 font-bold text-text">{p.name || p.plot_name}</td>
                          <td className="p-3 font-mono font-semibold">{p.area_acres}</td>
                          <td className="p-3 text-text-muted">{p.soil_type || 'Medium Black'}</td>
                          <td className="p-3 font-medium text-text">{p.farmer_name}</td>
                          <td className="p-3">{p.village}</td>
                          <td className="p-3 font-mono">{p.mobile_number}</td>
                          <td className="p-3 text-right font-semibold text-emerald-700">{p.active_crop || 'Pomegranate'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
