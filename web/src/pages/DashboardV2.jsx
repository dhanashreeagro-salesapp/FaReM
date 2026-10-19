import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../components/AuthProvider';
import api from '../services/api';
import { normalizeDashboardMetrics, normalizeHierarchyResponse } from '../services/dataAdapter';
import { Users, MapPin, Sprout, Calendar, AlertTriangle, RefreshCw, Layers, CheckCircle2, ChevronRight, Award, UserPlus, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PlotsModal, CropsModal, VisitsModal, CallsModal, OverdueModal } from '../components/DashboardModals';

const GIT_SHA = 'bd393dc';

export default function DashboardV2() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Single State Container
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [marketSnapshot, setMarketSnapshot] = useState(null);
  const [requestCount, setRequestCount] = useState(0);
  const [responseTimeMs, setResponseTimeMs] = useState(null);
  const [httpStatus, setHttpStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('metrics'); // 'metrics' or 'hierarchy'

  // Modal State
  const [modalType, setModalType] = useState(null);
  const [modalData, setModalData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Hierarchy State (Loaded independently)
  const [hierarchyData, setHierarchyData] = useState(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchyError, setHierarchyError] = useState(null);

  // AbortController ref for race condition & unmount protection
  const abortControllerRef = useRef(null);
  const dashboardRequestIdRef = useRef(0);
  const hierarchyRequestIdRef = useRef(0);

  const fetchDashboard = async () => {
    if (!user || !user.email) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const currentRequestId = ++dashboardRequestIdRef.current;

    setLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      setRequestCount(prev => prev + 1);

      const [json, snapshotJson] = await Promise.all([
        api.getDashboard({ refresh: 'true', _t: Date.now() }, { signal }),
        api.request('/market/snapshot/', { signal }).catch(() => [])
      ]);

      if (currentRequestId !== dashboardRequestIdRef.current) return;

      const endTime = performance.now();
      setResponseTimeMs(Math.round(endTime - startTime));
      setHttpStatus(200);

      setData(normalizeDashboardMetrics(json));
      setMarketSnapshot(snapshotJson);
      setLoading(false);
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (currentRequestId !== dashboardRequestIdRef.current) return;

      console.error("[DashboardV2] Fetch error:", err);
      const endTime = performance.now();
      setResponseTimeMs(Math.round(endTime - startTime));
      setError({
        status: err.status || 500,
        message: err.message || "Failed to load dashboard data. Network error or server timeout.",
        body: err.body || ''
      });
      setLoading(false);
    }
  };

  const fetchHierarchy = async () => {
    if (!user || !user.email) return;

    const currentRequestId = ++hierarchyRequestIdRef.current;

    setHierarchyLoading(true);
    setHierarchyError(null);

    try {
      const json = await api.getHierarchy();
      if (currentRequestId !== hierarchyRequestIdRef.current) return;

      if (json) {
        setHierarchyData(normalizeHierarchyResponse(json));
      } else {
        setHierarchyError("Empty response");
      }
    } catch (err) {
      if (currentRequestId !== hierarchyRequestIdRef.current) return;
      setHierarchyError(err.message || 'Failed to load hierarchy');
    } finally {
      if (currentRequestId === hierarchyRequestIdRef.current) {
        setHierarchyLoading(false);
      }
    }
  };

  const handleOpenModal = async (type) => {
    setModalType(type);
    setModalLoading(true);
    setModalData([]);
    
    try {
      let res;
      if (type === 'plots') {
        res = await api.getFarmerPlots();
      } else if (type === 'crops') {
        res = await api.getActiveCrops();
      } else if (type === 'visits') {
        res = await api.getFieldVisits();
      } else if (type === 'calls') {
        res = await api.getCallLogs();
      } else if (type === 'overdue') {
        res = await api.getOverdueVisits();
      }
      
      const list = Array.isArray(res) ? res : (res?.results || []);
      setModalData(list);
    } catch (err) {
      console.error(`Failed loading ${type}:`, err);
      setModalData([]);
    } finally {
      setModalLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [user?.email]);

  useEffect(() => {
    if (activeTab === 'hierarchy' && !hierarchyData && !hierarchyLoading) {
      fetchHierarchy();
    }
  }, [activeTab]);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text">Dashboard & Reports</h1>
          <p className="text-xs text-text-muted">Live real-time operational overview</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-surface border border-border p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'metrics'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Metrics Overview
            </button>
            <button
              onClick={() => setActiveTab('hierarchy')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'hierarchy'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Org Hierarchy Tree
            </button>
          </div>

          <button
            onClick={() => { fetchDashboard(); if (activeTab === 'hierarchy') fetchHierarchy(); }}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-surface border border-border hover:bg-bg rounded-xl text-xs font-semibold text-text shadow-sm transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-primary" : ""} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>


      {/* TAB 1: METRICS OVERVIEW */}
      {activeTab === 'metrics' && (
        <>
          {/* 1. LOADING STATE */}
          {loading && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/50 border border-emerald-200/60 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-medium animate-pulse">
                <RefreshCw size={16} className="animate-spin text-emerald-600" />
                <span>Fetching fresh live dashboard metrics directly from server...</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-28 bg-surface border border-border rounded-xl animate-pulse p-4 flex flex-col justify-between">
                    <div className="h-4 bg-border/50 rounded w-20" />
                    <div className="h-8 bg-border/70 rounded w-16" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. ERROR STATE */}
          {!loading && error && (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2.5 text-danger font-bold font-heading text-base">
                <AlertTriangle size={20} />
                <span>Failed to Load Dashboard Data</span>
              </div>
              <p className="text-xs text-text-muted">{error.message}</p>
              {error.body && (
                <div className="p-3 bg-white/80 border border-red-100 font-mono text-[11px] text-danger rounded-xl max-h-32 overflow-y-auto">
                  {error.body}
                </div>
              )}
              <button
                onClick={fetchDashboard}
                className="px-4 py-2 bg-danger text-white text-xs font-semibold rounded-xl hover:bg-danger/90 transition-all cursor-pointer"
              >
                Retry Request
              </button>
            </div>
          )}

          {/* 3. SUCCESS STATE */}
          {!loading && !error && data && (
            <div className="space-y-6">

              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard
                  id="stat-farmers"
                  icon={Users}
                  label="Total Active Farmers"
                  value={data.totalFarmers}
                  color="bg-emerald-50 text-emerald-700 border-emerald-200"
                  onClick={() => navigate('/farmers')}
                />
                <StatCard
                  id="stat-plots"
                  icon={MapPin}
                  label="Total Plots"
                  value={data.totalPlots}
                  color="bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-500 cursor-pointer"
                  onClick={() => handleOpenModal('plots')}
                />
                <StatCard
                  id="stat-crops"
                  icon={Sprout}
                  label="Active Crops"
                  value={data.activeCrops}
                  color="bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-500 cursor-pointer"
                  onClick={() => handleOpenModal('crops')}
                />
                <StatCard
                  id="stat-visits"
                  icon={Calendar}
                  label="Total Visits"
                  value={data.totalVisits}
                  color="bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-500 cursor-pointer"
                  onClick={() => handleOpenModal('visits')}
                />
                <StatCard
                  id="stat-calls"
                  icon={Calendar}
                  label="Total Calls"
                  value={data.totalCalls}
                  color="bg-teal-50 text-teal-700 border-teal-200 hover:border-teal-500 cursor-pointer"
                  onClick={() => handleOpenModal('calls')}
                />
                <StatCard
                  id="stat-overdue"
                  icon={AlertTriangle}
                  label="Overdue Visits"
                  value={data.overdueVisits}
                  color="bg-red-50 text-red-700 border-red-200 hover:border-red-500 cursor-pointer"
                  onClick={() => handleOpenModal('overdue')}
                />
              </div>

              {/* Secondary Visualizations Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Top Villages Widget */}
                <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-heading font-bold text-text flex items-center gap-2">
                    <MapPin size={16} className="text-primary" /> Top Villages Breakdown
                  </h3>
                  {data.topVillages && data.topVillages.length > 0 ? (
                    <div className="space-y-2.5">
                      {data.topVillages.map((v, i) => (
                        <div 
                          key={i} 
                          onClick={() => navigate(`/farmers?village=${encodeURIComponent(v.village)}`)}
                          className="flex justify-between items-center p-2.5 bg-bg/60 rounded-xl text-xs hover:bg-bg cursor-pointer transition-colors"
                        >
                          <span className="font-semibold text-text">{v.village}</span>
                          <span className="px-2.5 py-1 bg-primary/10 text-primary font-bold rounded-lg">
                            {v.count} Farmers
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">No village distribution data available.</p>
                  )}
                </div>

                {/* Enrollment Summary Widget */}
                <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-heading font-bold text-text flex items-center gap-2">
                    <Award size={16} className="text-primary" /> Farmer Enrollment Summary
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-bg/60 rounded-xl text-center">
                      <p className="text-[10px] text-text-muted uppercase font-semibold">This Month</p>
                      <p className="text-lg font-bold text-text mt-1">{data.thisMonthFarmers ?? '-'}</p>
                    </div>
                    <div className="p-3 bg-bg/60 rounded-xl text-center">
                      <p className="text-[10px] text-text-muted uppercase font-semibold">Last Month</p>
                      <p className="text-lg font-bold text-text mt-1">{data.lastMonthFarmers ?? '-'}</p>
                    </div>
                    <div className="p-3 bg-bg/60 rounded-xl text-center">
                      <p className="text-[10px] text-text-muted uppercase font-semibold">Year To Date</p>
                      <p className="text-lg font-bold text-primary mt-1">{data.ytdFarmers ?? '-'}</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Market Intelligence Snapshot Widget */}
              <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4 col-span-1 md:col-span-2">
                  <div className="flex justify-between items-center">
                      <h3 className="text-sm font-heading font-bold text-text flex items-center gap-2">
                        <Award size={16} className="text-primary" /> Market Intelligence Snapshot
                      </h3>
                      <button 
                          onClick={() => navigate('/market-intelligence')}
                          className="text-xs text-primary font-bold hover:underline flex items-center cursor-pointer"
                      >
                          View Full Dashboard <ChevronRight size={14} />
                      </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {marketSnapshot && marketSnapshot.length > 0 ? (
                        marketSnapshot.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="p-3 bg-bg/60 rounded-xl border border-border">
                            <p className="text-xs text-text-muted font-semibold">{item.commodity_name}</p>
                            <p className="text-lg font-bold text-text mt-1 flex justify-between items-center">
                                ₹{item.modal_price || 'N/A'} 
                                {item.change_7_day_percent !== null && item.change_7_day_percent !== undefined && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.change_7_day_percent >= 0 ? 'text-success bg-success/10' : 'text-danger bg-danger/10'}`}>
                                    {Math.abs(item.change_7_day_percent).toFixed(1)}% {item.change_7_day_percent >= 0 ? '↑' : '↓'}
                                  </span>
                                )}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-3 py-4 text-center text-xs text-text-muted">
                          No market snapshot data available.
                        </div>
                      )}
                  </div>
              </div>

            </div>
          )}
        </>
      )}

      {/* TAB 2: ORG HIERARCHY TREE */}
      {activeTab === 'hierarchy' && (
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-5 overflow-x-auto w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-border">
            <div>
              <h3 className="text-base font-heading font-bold text-text flex items-center gap-2">
                <Layers size={18} className="text-primary" /> Organization Hierarchy Tree
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Superior-subordinate reporting structure with aggregated field operations summary
              </p>
            </div>
            {hierarchyData && (
              <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                Reporting structure for: {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.email}
              </span>
            )}
          </div>

          {hierarchyLoading && (
            <div className="p-8 text-center text-xs text-text-muted animate-pulse">
              <RefreshCw size={20} className="animate-spin text-primary mx-auto mb-2" />
              Loading organization hierarchy tree...
            </div>
          )}

          {hierarchyError && (
            <div className="p-4 bg-red-50 border border-red-200 text-danger text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>Failed to load hierarchy: {hierarchyError}</span>
            </div>
          )}

          {!hierarchyLoading && hierarchyData && (
            <div className="space-y-4">
              {Array.isArray(hierarchyData) ? (
                hierarchyData.map((node, i) => <HierarchyNode key={node.id || i} node={node} isRoot={true} />)
              ) : (
                <HierarchyNode node={hierarchyData} isRoot={true} />
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Modals */}
      <PlotsModal isOpen={modalType === 'plots'} onClose={() => setModalType(null)} data={modalData} loading={modalLoading} />
      <CropsModal isOpen={modalType === 'crops'} onClose={() => setModalType(null)} data={modalData} loading={modalLoading} />
      <VisitsModal isOpen={modalType === 'visits'} onClose={() => setModalType(null)} data={modalData} loading={modalLoading} />
      <CallsModal isOpen={modalType === 'calls'} onClose={() => setModalType(null)} data={modalData} loading={modalLoading} />
      <OverdueModal isOpen={modalType === 'overdue'} onClose={() => setModalType(null)} data={modalData} loading={modalLoading} />

    </div>
  );
}

function StatCard({ id, icon: Icon, label, value, color, onClick }) {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`p-4 rounded-2xl border ${color} transition-all duration-200 shadow-sm flex flex-col justify-between h-28`}
    >
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-semibold tracking-wide uppercase opacity-80">{label}</span>
        <div className="p-1.5 rounded-lg bg-white/60">
          <Icon size={16} />
        </div>
      </div>
      <div className="text-2xl font-heading font-bold tracking-tight">
        {value === null || value === undefined ? '-' : (typeof value === 'number' ? value.toLocaleString() : value)}
      </div>
    </div>
  );
}

function HierarchyNode({ node, isRoot = false }) {
  const [expanded, setExpanded] = useState(true);
  if (!node) return null;

  const childrenNodes = node.children || [];
  const hasChildren = childrenNodes.length > 0;

  return (
    <div className={`space-y-3 ${!isRoot ? 'ml-4 sm:ml-8 pl-3 sm:pl-5 border-l-2 border-emerald-500/20' : ''}`}>
      <div className="card p-4 border border-border hover:border-primary/40 bg-surface/90 shadow-sm transition-all rounded-xl">
        {/* Header row: Expand button, Name, Role, Territory, Direct Reports */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            {hasChildren ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1 hover:bg-bg rounded-lg text-text-muted hover:text-text transition-colors cursor-pointer"
                title={expanded ? "Collapse team" : "Expand team"}
              >
                <ChevronRight size={18} className={`transition-transform duration-200 ${expanded ? 'rotate-90 text-primary' : ''}`} />
              </button>
            ) : (
              <div className="w-6 flex justify-center text-text-muted/40">•</div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-heading font-bold text-sm text-text">{node.name || 'Unnamed'}</span>
                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                  node.role === 'ZonalManager' ? 'bg-purple-100 text-purple-800' :
                  node.role === 'TerritoryManager' ? 'bg-emerald-100 text-emerald-800' :
                  node.role === 'Admin' ? 'bg-blue-100 text-blue-800' :
                  'bg-surface border border-border text-text-muted'
                }`}>
                  {node.role}
                </span>
                {hasChildren && (
                  <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {childrenNodes.length} direct report{childrenNodes.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5 flex-wrap">
                <span>{node.email}</span>
                {node.territoryName && (
                  <span className="flex items-center gap-1 text-[11px] text-text-muted">
                    <MapPin size={11} className="text-text-muted" /> {node.territoryName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
              👥 {node.farmerCount.toLocaleString()} Farmers
            </span>
          </div>
        </div>

        {/* Operational Summary Grid: Farmers, Crops, Visits, Overdue, New This Mo, Last Mo, This Year */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-3 text-xs">
          {/* 1. Total Farmers */}
          <div className="bg-bg/60 p-2 rounded-lg border border-border/50">
            <div className="text-[10px] text-text-muted font-medium uppercase tracking-wider flex items-center gap-1">
              <Users size={11} className="text-emerald-600" /> Total Farmers
            </div>
            <div className="font-bold text-text text-sm mt-0.5">
              {node.farmerCount.toLocaleString()}
            </div>
            {hasChildren && node.directFarmerCount > 0 && (
              <div className="text-[10px] text-text-muted">{node.directFarmerCount} direct</div>
            )}
          </div>

          {/* 2. Number of Crops */}
          <div className="bg-bg/60 p-2 rounded-lg border border-border/50">
            <div className="text-[10px] text-text-muted font-medium uppercase tracking-wider flex items-center gap-1">
              <Sprout size={11} className="text-amber-600" /> Active Crops
            </div>
            <div className="font-bold text-text text-sm mt-0.5">
              {node.cropCount}
            </div>
            <div className="text-[10px] text-text-muted">Mapped crops</div>
          </div>

          {/* 3. Total Visits Done */}
          <div className="bg-bg/60 p-2 rounded-lg border border-border/50">
            <div className="text-[10px] text-text-muted font-medium uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 size={11} className="text-purple-600" /> Total Visits
            </div>
            <div className="font-bold text-text text-sm mt-0.5">
              {node.visitsCount}
            </div>
            <div className="text-[10px] text-text-muted">Completed visits</div>
          </div>

          {/* 4. Overdue Visits */}
          <div className={`p-2 rounded-lg border ${
            node.overdueVisits > 0 
              ? 'bg-red-50/70 border-red-200 text-red-900' 
              : 'bg-bg/60 border-border/50 text-text'
          }`}>
            <div className="text-[10px] font-medium uppercase tracking-wider flex items-center gap-1 text-red-600">
              <AlertTriangle size={11} /> Overdue Visits
            </div>
            <div className="font-bold text-sm mt-0.5 text-danger">
              {node.overdueVisits}
            </div>
            <div className="text-[10px] text-text-muted">&gt; 30 days gap</div>
          </div>

          {/* 5. New Farmers (This Month / Last Month) */}
          <div className="bg-bg/60 p-2 rounded-lg border border-border/50">
            <div className="text-[10px] text-text-muted font-medium uppercase tracking-wider flex items-center gap-1">
              <UserPlus size={11} className="text-blue-600" /> This / Last Mo.
            </div>
            <div className="font-bold text-text text-sm mt-0.5">
              +{node.farmersAddedThisMonth} <span className="text-text-muted font-normal text-xs">/ {node.farmersAddedLastMonth}</span>
            </div>
            <div className="text-[10px] text-text-muted">Monthly added</div>
          </div>

          {/* 6. New Farmers (This Year) */}
          <div className="bg-bg/60 p-2 rounded-lg border border-border/50">
            <div className="text-[10px] text-text-muted font-medium uppercase tracking-wider flex items-center gap-1">
              <TrendingUp size={11} className="text-teal-600" /> This Year
            </div>
            <div className="font-bold text-text text-sm mt-0.5">
              +{node.farmersAddedThisYear}
            </div>
            <div className="text-[10px] text-text-muted">YTD additions</div>
          </div>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="space-y-3 pt-1">
          {childrenNodes.map((child, idx) => (
            <HierarchyNode key={child.id || idx} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}
