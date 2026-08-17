import React, { useState, useEffect } from 'react';

export default function FrontendDataDiagnostic() {
  const [authData, setAuthData] = useState({
    token: localStorage.getItem('ffma_access_token'),
    role: localStorage.getItem('ffma_role'),
    email: localStorage.getItem('ffma_email'),
  });

  const [dashboardResponse, setDashboardResponse] = useState(null);
  const [hierarchyResponse, setHierarchyResponse] = useState(null);
  const [error, setError] = useState(null);

  const getBackendUrl = () => {
    // Mimic the exact logic from api.js but display it
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return 'https://farem-web.onrender.com/api';
    }
    let envUrl = import.meta.env.VITE_API_URL;
    if (!envUrl) return `http://${window.location.hostname}:8000/api`;
    envUrl = envUrl.trim().replace(/\/+$/, '');
    if (!envUrl.endsWith('/api')) {
      envUrl += '/api';
    }
    return envUrl;
  };

  const API_BASE = getBackendUrl();

  useEffect(() => {
    async function fetchData() {
      try {
        if (!authData.token) {
          setError("No authentication token found in localStorage.");
          return;
        }

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.token}`
        };

        const dashRes = await fetch(`${API_BASE}/dashboard/`, { headers });
        const dashData = await dashRes.json();
        setDashboardResponse({
          status: dashRes.status,
          data: dashData
        });

        const hierRes = await fetch(`${API_BASE}/hierarchy/`, { headers });
        const hierData = await hierRes.json();
        setHierarchyResponse({
          status: hierRes.status,
          data: hierData
        });

      } catch (err) {
        setError(err.toString());
      }
    }
    fetchData();
  }, [API_BASE, authData.token]);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', color: '#333' }}>
      <h1>Forensic Diagnostic Page</h1>
      
      <section style={{ marginBottom: '20px', border: '1px solid #ccc', padding: '10px' }}>
        <h2>1. Environment & Auth Runtime</h2>
        <p><strong>Window Hostname:</strong> {window.location.hostname}</p>
        <p><strong>VITE_API_URL:</strong> {import.meta.env.VITE_API_URL || 'undefined'}</p>
        <p><strong>Actual API Base Computed:</strong> {API_BASE}</p>
        <p><strong>Authenticated Email (localStorage):</strong> {authData.email}</p>
        <p><strong>Authenticated Role (localStorage):</strong> {authData.role}</p>
        <p><strong>Has Token:</strong> {authData.token ? 'Yes' : 'No'}</p>
      </section>

      {error && (
        <section style={{ marginBottom: '20px', border: '1px solid red', padding: '10px', color: 'red' }}>
          <h2>Error</h2>
          <pre>{error}</pre>
        </section>
      )}

      <section style={{ marginBottom: '20px', border: '1px solid #ccc', padding: '10px' }}>
        <h2>2. Raw Dashboard API Response</h2>
        {dashboardResponse ? (
          <div>
            <p><strong>HTTP Status:</strong> {dashboardResponse.status}</p>
            <pre style={{ background: '#f5f5f5', padding: '10px' }}>
              {JSON.stringify(dashboardResponse.data, null, 2)}
            </pre>
          </div>
        ) : <p>Loading...</p>}
      </section>

      <section style={{ marginBottom: '20px', border: '1px solid #ccc', padding: '10px' }}>
        <h2>3. Raw Hierarchy API Response</h2>
        {hierarchyResponse ? (
          <div>
            <p><strong>HTTP Status:</strong> {hierarchyResponse.status}</p>
            <pre style={{ background: '#f5f5f5', padding: '10px' }}>
              {JSON.stringify(hierarchyResponse.data, null, 2)}
            </pre>
          </div>
        ) : <p>Loading...</p>}
      </section>
    </div>
  );
}
