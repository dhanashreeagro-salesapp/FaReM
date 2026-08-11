import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import api from '../services/api';
import { normalizeDashboardMetrics } from '../services/dataAdapter';

export default function DataDebug() {
  const { user } = useAuth();
  const [debugLog, setDebugLog] = useState([]);
  
  // Environment & Auth info
  const token = localStorage.getItem('ffma_access_token');
  const userEmail = localStorage.getItem('ffma_email');
  const userRole = localStorage.getItem('ffma_role');
  const fullName = localStorage.getItem('ffma_full_name');
  const territoryName = localStorage.getItem('ffma_territory_name');
  const apiBaseUrl = api.baseURL || 'https://farem-web.onrender.com/api';
  const gitCommitSha = '439d48f';
  const buildTimestamp = '2026-08-11 04:04 UTC';

  // Direct fetch state
  const [dashDirectStatus, setDashDirectStatus] = useState(null);
  const [dashDirectUrl, setDashDirectUrl] = useState('');
  const [dashDirectJson, setDashDirectJson] = useState(null);
  const [dashDirectError, setDashDirectError] = useState(null);

  const [hierDirectStatus, setHierDirectStatus] = useState(null);
  const [hierDirectJson, setHierDirectJson] = useState(null);

  const [farmersDirectStatus, setFarmersDirectStatus] = useState(null);
  const [farmersDirectJson, setFarmersDirectJson] = useState(null);

  // Application Pipeline state
  const [appApiDashReturn, setAppApiDashReturn] = useState(null);
  const [appNormalizedDashReturn, setAppNormalizedDashReturn] = useState(null);

  const [appApiFarmersReturn, setAppApiFarmersReturn] = useState(null);

  // Service Worker check
  const [swStatus, setSwStatus] = useState('Checking...');

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        if (regs.length > 0) {
          setSwStatus(`Active (${regs.length} registration(s))`);
        } else {
          setSwStatus('None (No active Service Worker)');
        }
      }).catch(e => setSwStatus(`Error: ${e.message}`));
    } else {
      setSwStatus('Not supported in this browser');
    }
  }, []);

  const runDirectFetchDiagnostics = async () => {
    setDashDirectStatus('Fetching...');
    setDashDirectError(null);
    const targetUrl = `${apiBaseUrl}/dashboard/?refresh=true`;
    setDashDirectUrl(targetUrl);

    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const correlationId = `debug_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    try {
      // 1. DIRECT BROWSER FETCH (Dashboard)
      const res = await window.fetch(targetUrl, {
        method: 'GET',
        headers: { ...headers, 'X-AgriAmigo-Debug-ID': correlationId }
      });
      setDashDirectStatus(res.status);
      const text = await res.text();
      try {
        const parsed = JSON.parse(text);
        setDashDirectJson(parsed);
      } catch (e) {
        setDashDirectJson(text);
      }
    } catch (err) {
      setDashDirectError(err.toString());
      setDashDirectStatus('FAILED (Network / CORS)');
    }

    // 2. DIRECT BROWSER FETCH (Hierarchy)
    try {
      const hRes = await window.fetch(`${apiBaseUrl}/dashboard/hierarchy/`, {
        method: 'GET',
        headers: { ...headers, 'X-AgriAmigo-Debug-ID': correlationId }
      });
      setHierDirectStatus(hRes.status);
      const hText = await hRes.text();
      try {
        setHierDirectJson(JSON.parse(hText));
      } catch (e) {
        setHierDirectJson(hText);
      }
    } catch (err) {
      setHierDirectStatus('FAILED');
    }

    // 3. DIRECT BROWSER FETCH (Farmers)
    try {
      const fRes = await window.fetch(`${apiBaseUrl}/farmers/`, {
        method: 'GET',
        headers: { ...headers, 'X-AgriAmigo-Debug-ID': correlationId }
      });
      setFarmersDirectStatus(fRes.status);
      const fText = await fRes.text();
      try {
        setFarmersDirectJson(JSON.parse(fText));
      } catch (e) {
        setFarmersDirectJson(fText);
      }
    } catch (err) {
      setFarmersDirectStatus('FAILED');
    }

    // 4. APPLICATION PIPELINE FETCH
    try {
      const rawApiDash = await api.getDashboard({ refresh: 'true' });
      setAppApiDashReturn(rawApiDash);
      const normDash = normalizeDashboardMetrics(rawApiDash);
      setAppNormalizedDashReturn(normDash);

      const rawApiFarmers = await api.getFarmers();
      setAppApiFarmersReturn(rawApiFarmers);
    } catch (err) {
      console.error("App pipeline diagnostic error:", err);
    }
  };

  useEffect(() => {
    runDirectFetchDiagnostics();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 font-sans bg-surface text-text">
      {/* HEADER */}
      <div className="border-b border-border pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold font-heading text-primary">🔬 AgriAmigo Frontend Diagnostic Inspector</h1>
          <p className="text-xs text-text-muted">Forensic Data Pipeline & Boundary Inspection Page (/data-debug)</p>
        </div>
        <button 
          onClick={runDirectFetchDiagnostics}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md hover:shadow-lg"
        >
          🔄 Re-run All Diagnostics
        </button>
      </div>

      {/* SECTION 1: HARDCODED RENDER TEST */}
      <div className="card p-5 border-2 border-emerald-500/30 bg-emerald-50/10 rounded-xl space-y-3">
        <h2 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
          <span>🧪 TEST 1: Hardcoded Constants UI Render Test</span>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">Purposely Hardcoded Data</span>
        </h2>
        <p className="text-xs text-text-muted">Proves whether the React layout/DOM is capable of rendering numbers on this device.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white border border-border rounded-xl shadow-sm">
            <div className="text-xs text-text-muted font-medium">TOTAL ACTIVE FARMERS</div>
            <div className="text-3xl font-extrabold text-primary mt-1">1,142</div>
            <div className="text-[10px] text-emerald-600 mt-1">✓ Hardcoded Constant Verified</div>
          </div>
          <div className="p-4 bg-white border border-border rounded-xl shadow-sm">
            <div className="text-xs text-text-muted font-medium">TOTAL PLOTS</div>
            <div className="text-3xl font-extrabold text-blue-600 mt-1">43</div>
            <div className="text-[10px] text-emerald-600 mt-1">✓ Hardcoded Constant Verified</div>
          </div>
          <div className="p-4 bg-white border border-border rounded-xl shadow-sm">
            <div className="text-xs text-text-muted font-medium">ACTIVE CROPS</div>
            <div className="text-3xl font-extrabold text-amber-600 mt-1">37</div>
            <div className="text-[10px] text-emerald-600 mt-1">✓ Hardcoded Constant Verified</div>
          </div>
        </div>
      </div>

      {/* SECTION 2: AUTH & ENVIRONMENT METADATA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-5 border border-border rounded-xl space-y-3 bg-surface">
          <h2 className="text-sm font-bold text-primary">🔑 SECTION 1: AUTHENTICATION CONTEXT</h2>
          <div className="text-xs space-y-1.5 font-mono">
            <div><span className="text-text-muted">LoggedIn User (React Context):</span> <b className="text-text">{user?.email || 'NULL'}</b></div>
            <div><span className="text-text-muted">LoggedIn Role (React Context):</span> <b className="text-text">{user?.role || 'NULL'}</b></div>
            <div><span className="text-text-muted">localStorage Email:</span> <b className="text-text">{userEmail || 'NONE'}</b></div>
            <div><span className="text-text-muted">localStorage Role:</span> <b className="text-text">{userRole || 'NONE'}</b></div>
            <div><span className="text-text-muted">localStorage Full Name:</span> <b className="text-text">{fullName || 'NONE'}</b></div>
            <div><span className="text-text-muted">localStorage Territory:</span> <b className="text-text">{territoryName || 'NONE'}</b></div>
            <div><span className="text-text-muted">JWT Token Present:</span> <b className={token ? "text-emerald-600" : "text-red-600"}>{token ? `YES (${token.length} chars)` : 'NO TOKEN'}</b></div>
          </div>
        </div>

        <div className="card p-5 border border-border rounded-xl space-y-3 bg-surface">
          <h2 className="text-sm font-bold text-primary">⚙️ SECTION 2: ENVIRONMENT & DEPLOYMENT</h2>
          <div className="text-xs space-y-1.5 font-mono">
            <div><span className="text-text-muted">Frontend Build Git SHA:</span> <b className="text-text">{gitCommitSha}</b></div>
            <div><span className="text-text-muted">Build Timestamp:</span> <b className="text-text">{buildTimestamp}</b></div>
            <div><span className="text-text-muted">Browser API Base URL:</span> <b className="text-blue-600">{apiBaseUrl}</b></div>
            <div><span className="text-text-muted">Browser User Agent:</span> <b className="text-text">{navigator.userAgent.substr(0, 50)}...</b></div>
            <div><span className="text-text-muted">Service Worker Status:</span> <b className="text-text">{swStatus}</b></div>
            <div><span className="text-text-muted">Current URL:</span> <b className="text-text">{window.location.href}</b></div>
          </div>
        </div>
      </div>

      {/* SECTION 3: DIRECT BROWSER HTTP RESPONSES (UN-TRANSFORMED) */}
      <div className="card p-5 border border-border rounded-xl space-y-4 bg-surface">
        <h2 className="text-sm font-bold text-primary flex items-center justify-between">
          <span>🌐 SECTION 3: DIRECT BROWSER HTTP RESPONSES (Raw fetch() Result)</span>
          <span className="text-xs font-normal text-text-muted">Bypasses all app stores, hooks, normalizers & caches</span>
        </h2>

        {/* DASHBOARD DIRECT */}
        <div className="border border-border rounded-lg p-3 bg-bg/50 space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <div><b>GET /api/dashboard/?refresh=true</b></div>
            <div>Status Code: <b className={dashDirectStatus === 200 ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>{dashDirectStatus || 'Pending...'}</b></div>
          </div>
          <div className="text-[11px] font-mono text-text-muted">Target URL: {dashDirectUrl}</div>
          {dashDirectError && <div className="text-xs text-red-600 font-mono">Fetch Error: {dashDirectError}</div>}
          <div className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
            EXTRACTED KEYS → total_farmers: <b>{dashDirectJson?.total_farmers ?? 'UNDEFINED'}</b> | total_plots: <b>{dashDirectJson?.total_plots ?? 'UNDEFINED'}</b> | active_crop_seasons: <b>{dashDirectJson?.active_crop_seasons ?? 'UNDEFINED'}</b>
          </div>
          <details className="text-xs font-mono">
            <summary className="cursor-pointer text-blue-600 font-medium">View Raw Un-transformed Dashboard JSON Response</summary>
            <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded text-[11px] overflow-x-auto max-h-60">
              {JSON.stringify(dashDirectJson, null, 2)}
            </pre>
          </details>
        </div>

        {/* HIERARCHY DIRECT */}
        <div className="border border-border rounded-lg p-3 bg-bg/50 space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <div><b>GET /api/dashboard/hierarchy/</b></div>
            <div>Status Code: <b className={hierDirectStatus === 200 ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>{hierDirectStatus || 'Pending...'}</b></div>
          </div>
          <div className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
            EXTRACTED HIERARCHY ROOT → Name: <b>{hierDirectJson?.name || (Array.isArray(hierDirectJson) ? hierDirectJson[0]?.name : 'UNDEFINED')}</b> | Direct Subordinates Count: <b>{hierDirectJson?.children?.length || (Array.isArray(hierDirectJson) ? hierDirectJson[0]?.subordinates?.length : 'UNDEFINED')}</b>
          </div>
          <details className="text-xs font-mono">
            <summary className="cursor-pointer text-blue-600 font-medium">View Raw Un-transformed Hierarchy JSON Response</summary>
            <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded text-[11px] overflow-x-auto max-h-60">
              {JSON.stringify(hierDirectJson, null, 2)}
            </pre>
          </details>
        </div>

        {/* FARMERS DIRECT */}
        <div className="border border-border rounded-lg p-3 bg-bg/50 space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <div><b>GET /api/farmers/</b></div>
            <div>Status Code: <b className={farmersDirectStatus === 200 ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>{farmersDirectStatus || 'Pending...'}</b></div>
          </div>
          <div className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
            EXTRACTED FARMERS COUNT → Total in response: <b>{farmersDirectJson?.count ?? (Array.isArray(farmersDirectJson) ? farmersDirectJson.length : 'UNDEFINED')}</b> | Results length: <b>{farmersDirectJson?.results?.length ?? 'N/A'}</b>
          </div>
          <details className="text-xs font-mono">
            <summary className="cursor-pointer text-blue-600 font-medium">View Raw Un-transformed Farmers JSON Response Sample</summary>
            <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded text-[11px] overflow-x-auto max-h-60">
              {JSON.stringify(farmersDirectJson?.results ? farmersDirectJson.results.slice(0, 3) : farmersDirectJson, null, 2)}
            </pre>
          </details>
        </div>
      </div>

      {/* SECTION 4: STEP-BY-STEP APPLICATION PIPELINE INSPECTOR */}
      <div className="card p-5 border border-border rounded-xl space-y-4 bg-surface">
        <h2 className="text-sm font-bold text-primary">📊 SECTION 4: APPLICATION PIPELINE STEP-BY-STEP TRACE</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
          
          <div className="p-3 border border-border rounded-lg bg-bg/40 space-y-1.5">
            <div className="font-bold text-text">[Step 1 & 2] Raw api.getDashboard() return:</div>
            <div className="p-2 bg-white rounded border border-border">
              <div>total_farmers: <b className="text-primary">{appApiDashReturn?.total_farmers ?? 'null'}</b></div>
              <div>total_plots: <b className="text-blue-600">{appApiDashReturn?.total_plots ?? 'null'}</b></div>
              <div>active_crops: <b className="text-amber-600">{appApiDashReturn?.active_crop_seasons ?? 'null'}</b></div>
            </div>
          </div>

          <div className="p-3 border border-border rounded-lg bg-bg/40 space-y-1.5">
            <div className="font-bold text-text">[Step 3] dataAdapter.js normalizeDashboardMetrics() return:</div>
            <div className="p-2 bg-white rounded border border-border">
              <div>totalFarmers: <b className="text-primary">{appNormalizedDashReturn?.totalFarmers ?? 'null'}</b></div>
              <div>totalPlots: <b className="text-blue-600">{appNormalizedDashReturn?.totalPlots ?? 'null'}</b></div>
              <div>activeCrops: <b className="text-amber-600">{appNormalizedDashReturn?.activeCrops ?? 'null'}</b></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
