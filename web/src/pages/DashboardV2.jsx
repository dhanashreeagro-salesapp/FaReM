import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../components/AuthProvider';
import { Users, MapPin, Sprout, Calendar, AlertTriangle, RefreshCw, Layers, CheckCircle2, ChevronRight, Award } from 'lucide-react';

const GIT_SHA = 'bd393dc';
const API_BASE_URL = 'https://farem-web.onrender.com/api';

export default function DashboardV2() {
  const { user, token } = useAuth();

  // Single State Container
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [requestCount, setRequestCount] = useState(0);
  const [responseTimeMs, setResponseTimeMs] = useState(null);
  const [httpStatus, setHttpStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('metrics'); // 'metrics' or 'hierarchy'

  // Hierarchy State (Loaded independently)
  const [hierarchyData, setHierarchyData] = useState(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchyError, setHierarchyError] = useState(null);

  // AbortController ref for race condition & unmount protection
  const abortControllerRef = useRef(null);

  const fetchDashboard = async () => {
    // 1. Auth Ready Check
    if (!user || !user.email) {
      console.log("[DashboardV2] User auth context not ready. Postponing fetch.");
      return;
    }

    const authToken = token || localStorage.getItem('ffma_access_token');
    if (!authToken) {
      console.log("[DashboardV2] No auth token available. Displaying Auth Error.");
      setLoading(false);
      setError({ message: "Authentication token missing. Please log in again.", status: 401 });
      return;
    }

    // 2. Abort previous pending request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      setRequestCount(prev => prev + 1);

      // Direct HTTP fetch - NO LOCAL STORAGE CACHE, NO SILENT FALLBACKS
      const response = await fetch(`${API_BASE_URL}/dashboard/?refresh=true`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        signal
      });

      const endTime = performance.now();
      setResponseTimeMs(Math.round(endTime - startTime));
      setHttpStatus(response.status);

      if (!response.ok) {
        let errBody = '';
        try { errBody = await response.text(); } catch (e) {}
        throw {
          status: response.status,
          message: `Server returned HTTP ${response.status}: ${response.statusText || 'Error'}`,
          body: errBody
        };
      }

      const json = await response.json();

      // Check if aborted before setting state
      if (signal.aborted) return;

      setData(json);
      setLoading(false);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log("[DashboardV2] Request aborted.");
        return;
      }
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
    const authToken = token || localStorage.getItem('ffma_access_token');
    if (!authToken) return;

    setHierarchyLoading(true);
    setHierarchyError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/dashboard/hierarchy/`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Cache-Control': 'no-cache'
        }
      });
      if (res.ok) {
        const json = await res.json();
        setHierarchyData(json);
      } else {
        setHierarchyError(`HTTP ${res.status}`);
      }
    } catch (err) {
      setHierarchyError(err.message || 'Failed to load hierarchy');
    } finally {
      setHierarchyLoading(false);
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

      {/* Diagnostic Inspector Panel (Dev Diagnostics) */}
      <div className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono border border-slate-800 space-y-1 shadow-inner">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5 font-sans">
          <span className="font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Diagnostic Inspector Mode (Deterministic Path)
          </span>
          <span className="text-[11px] text-slate-400">Build: {GIT_SHA}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
          <div><span className="text-slate-400">User:</span> {user?.email || 'Unauthenticated'}</div>
          <div><span className="text-slate-400">Role:</span> {user?.role || 'N/A'}</div>
          <div><span className="text-slate-400">API URL:</span> {API_BASE_URL}</div>
          <div><span className="text-slate-400">HTTP Status:</span> {httpStatus ? `${httpStatus} OK` : (loading ? 'Fetching...' : 'N/A')}</div>
          <div><span className="text-slate-400">Req Count:</span> #{requestCount}</div>
          <div><span className="text-slate-400">Latency:</span> {responseTimeMs ? `${responseTimeMs}ms` : 'N/A'}</div>
          <div><span className="text-slate-400">Cache Strategy:</span> Direct Network (No Cache)</div>
          <div><span className="text-slate-400">State:</span> {loading ? 'Loading' : error ? 'Error' : 'Success'}</div>
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
                  value={data.total_farmers ?? 0}
                  color="bg-emerald-50 text-emerald-700 border-emerald-200"
                />
                <StatCard
                  id="stat-plots"
                  icon={MapPin}
                  label="Total Plots"
                  value={data.total_plots ?? 0}
                  color="bg-blue-50 text-blue-700 border-blue-200"
                />
                <StatCard
                  id="stat-crops"
                  icon={Sprout}
                  label="Active Crops"
                  value={data.active_crop_seasons ?? 0}
                  color="bg-amber-50 text-amber-700 border-amber-200"
                />
                <StatCard
                  id="stat-visits"
                  icon={Calendar}
                  label="Total Visits"
                  value={data.total_visits ?? 0}
                  color="bg-purple-50 text-purple-700 border-purple-200"
                />
                <StatCard
                  id="stat-calls"
                  icon={Calendar}
                  label="Total Calls"
                  value={data.total_calls ?? 0}
                  color="bg-teal-50 text-teal-700 border-teal-200"
                />
                <StatCard
                  id="stat-overdue"
                  icon={AlertTriangle}
                  label="Overdue Visits"
                  value={data.overdue_visits ?? 0}
                  color="bg-red-50 text-red-700 border-red-200"
                />
              </div>

              {/* Secondary Visualizations Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Top Villages Widget */}
                <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-heading font-bold text-text flex items-center gap-2">
                    <MapPin size={16} className="text-primary" /> Top Villages Breakdown
                  </h3>
                  {data.top_villages && data.top_villages.length > 0 ? (
                    <div className="space-y-2.5">
                      {data.top_villages.map((v, i) => (
                        <div key={i} className="flex justify-between items-center p-2.5 bg-bg/60 rounded-xl text-xs">
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
                      <p className="text-lg font-bold text-text mt-1">{data.this_month_farmers ?? 0}</p>
                    </div>
                    <div className="p-3 bg-bg/60 rounded-xl text-center">
                      <p className="text-[10px] text-text-muted uppercase font-semibold">Last Month</p>
                      <p className="text-lg font-bold text-text mt-1">{data.last_month_farmers ?? 0}</p>
                    </div>
                    <div className="p-3 bg-bg/60 rounded-xl text-center">
                      <p className="text-[10px] text-text-muted uppercase font-semibold">Year To Date</p>
                      <p className="text-lg font-bold text-primary mt-1">{data.ytd_farmers ?? 0}</p>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}
        </>
      )}

      {/* TAB 2: ORG HIERARCHY TREE */}
      {activeTab === 'hierarchy' && (
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-5">
          <h3 className="text-base font-heading font-bold text-text flex items-center gap-2">
            <Layers size={18} className="text-primary" /> Organization Hierarchy Tree
          </h3>

          {hierarchyLoading && (
            <div className="p-6 text-center text-xs text-text-muted animate-pulse">
              Loading hierarchy tree...
            </div>
          )}

          {hierarchyError && (
            <div className="p-4 bg-red-50 border border-red-200 text-danger text-xs rounded-xl">
              Failed to load hierarchy: {hierarchyError}
            </div>
          )}

          {!hierarchyLoading && hierarchyData && (
            <div className="space-y-4">
              <HierarchyNode node={hierarchyData} isRoot={true} />
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function StatCard({ id, icon: Icon, label, value, color }) {
  return (
    <div
      id={id}
      className={`p-4 rounded-2xl border ${color} transition-all duration-200 shadow-sm flex flex-col justify-between h-28`}
    >
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-semibold tracking-wide uppercase opacity-80">{label}</span>
        <div className="p-1.5 rounded-lg bg-white/60">
          <Icon size={16} />
        </div>
      </div>
      <div className="text-2xl font-heading font-bold tracking-tight">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function HierarchyNode({ node, isRoot = false }) {
  const [expanded, setExpanded] = useState(true);
  if (!node) return null;

  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className={`space-y-2 ${!isRoot ? 'ml-6 pl-4 border-l-2 border-border/60' : ''}`}>
      <div className="flex items-center gap-3 p-3 bg-bg/80 border border-border rounded-xl max-w-lg">
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-surface rounded text-text-muted"
          >
            <ChevronRight size={16} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <div className="w-6" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-text truncate">{node.name}</span>
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-semibold rounded-full">
              {node.role || 'Staff'}
            </span>
          </div>
          <p className="text-[11px] text-text-muted">{node.email}</p>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            {node.farmer_count ?? 0} Farmers
          </span>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="space-y-2 pt-1">
          {node.children.map((child, idx) => (
            <HierarchyNode key={idx} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}
