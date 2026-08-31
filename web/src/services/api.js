let getApiBase = () => {
  let envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    envUrl = envUrl.trim().replace(/\/+$/, '');
    if (!envUrl.endsWith('/api')) {
      envUrl += '/api';
    }
    return envUrl;
  }
  
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://farem-web.onrender.com/api';
  }
  
  return typeof window !== 'undefined' 
    ? `http://${window.location.hostname}:8000/api` 
    : 'http://localhost:8000/api';
};

const API_BASE = getApiBase();

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE;
  }

  getToken() {
    return localStorage.getItem('ffma_access_token');
  }

  getRefreshToken() {
    return localStorage.getItem('ffma_refresh_token');
  }

  setTokens(access, refresh) {
    localStorage.setItem('ffma_access_token', access);
    localStorage.setItem('ffma_refresh_token', refresh);
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('ffma_cache_') || k.startsWith('cache_')) {
        localStorage.removeItem(k);
      }
    });
  }

  clearTokens() {
    localStorage.removeItem('ffma_access_token');
    localStorage.removeItem('ffma_refresh_token');
    localStorage.removeItem('ffma_role');
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('ffma_cache_') || k.startsWith('cache_') || k.startsWith('ffma_')) {
        if (k !== 'ffma_access_token' && k !== 'ffma_refresh_token') {
          localStorage.removeItem(k);
        }
      }
    });
  }

  async requestWithCache(endpoint, options = {}, cacheKey = null) {
    const userEmail = localStorage.getItem('ffma_email') || 'anon';
    const rawKey = cacheKey || endpoint;
    const key = `ffma_cache_${userEmail}_${rawKey}`;
    const cachedStr = localStorage.getItem(key);
    
    // Background fresh fetch to update cache silently
    const networkPromise = this.request(endpoint, options).then(data => {
      if (data) {
        try {
          localStorage.setItem(key, JSON.stringify(data));
        } catch (e) { /* localstorage quota handler */ }
      }
      return data;
    }).catch(err => {
      console.warn(`Background fetch failed for ${endpoint}:`, err);
      return null;
    });

    if (cachedStr) {
      try {
        const cachedData = JSON.parse(cachedStr);
        return cachedData;
      } catch (e) {
        localStorage.removeItem(key);
      }
    }

    return await networkPromise;
  }


  async request(endpoint, options = {}, retries = 3) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { ...options.headers };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        let response = await fetch(url, { ...options, headers });

        // If gateway cold start error (502, 503, 504), wait and retry
        if ([502, 503, 504].includes(response.status) && attempt < retries) {
          await new Promise((res) => setTimeout(res, (attempt + 1) * 2000));
          continue;
        }

        // If 401, try to refresh token
        if (response.status === 401 && this.getRefreshToken()) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            headers['Authorization'] = `Bearer ${this.getToken()}`;
            response = await fetch(url, { ...options, headers });
          } else {
            this.clearTokens();
            window.location.href = '/login';
            throw new Error('Session expired');
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw { status: response.status, ...errorData };
        }

        if (response.status === 204) return null;

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
        return response;
      } catch (err) {
        lastError = err;
        // Auto retry network "Failed to fetch" errors up to retries count
        if (attempt < retries && (err.name === 'TypeError' || (err.message && err.message.includes('fetch')))) {
          await new Promise((res) => setTimeout(res, (attempt + 1) * 2000));
        } else {
          throw err;
        }
      }
    }
    throw lastError;
  }


  async refreshAccessToken() {
    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: this.getRefreshToken() }),
      });
      if (res.ok) {
        const data = await res.json();
        this.setTokens(data.access, data.refresh || this.getRefreshToken());
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Auth
  login(email, password) {
    return this.request('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  getMe() {
    return this.request('/auth/me/').catch(() => ({
      email: localStorage.getItem('ffma_email'),
      role: localStorage.getItem('ffma_role'),
      full_name: localStorage.getItem('ffma_full_name'),
      territory_name: localStorage.getItem('ffma_territory_name')
    }));
  }


  logout() {
    const refresh = this.getRefreshToken();
    this.clearTokens();
    if (refresh) {
      return this.request('/auth/invalidate-session/', {
        method: 'POST',
        body: JSON.stringify({ refresh }),
      }).catch(() => { });
    }
  }

  // Users
  getUsers(forceFresh = false) {
    if (forceFresh) {
      localStorage.removeItem('cache_users');
      return this.request('/users/').then(data => {
        if (data) localStorage.setItem('cache_users', JSON.stringify(data));
        return data;
      });
    }
    return this.requestWithCache('/users/', {}, 'cache_users');
  }
  getUser(id) { return this.request(`/users/${id}/`); }
  createUser(data) {
    localStorage.removeItem('cache_users');
    return this.request('/users/', { method: 'POST', body: JSON.stringify(data) });
  }
  updateUser(id, data) {
    localStorage.removeItem('cache_users');
    return this.request(`/users/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  deleteUser(id) {
    localStorage.removeItem('cache_users');
    return this.request(`/users/${id}/`, { method: 'DELETE' });
  }
  enableUser(id) {
    localStorage.removeItem('cache_users');
    return this.request(`/users/${id}/enable/`, { method: 'PATCH' });
  }

  uploadUsersForValidation(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/users/upload_for_validation/', { method: 'POST', body: formData });
  }
  commitImportUsers(jobId, acknowledged) {
    return this.request('/users/commit_import/', {
      method: 'POST',
      body: JSON.stringify({ import_job_id: jobId, is_acknowledged: acknowledged })
    });
  }
  downloadUserTemplate() {
    return fetch(`${this.baseUrl}/users/download_template/`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${this.getToken()}` }
    })
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'users_import_template.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      });
  }

  // Farmers
  downloadFarmerTemplate() {
    return fetch(`${this.baseUrl}/farmers/download_template/`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${this.getToken()}` }
    })
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'farmers_import_template.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      });
  }

  // Territories
  getTerritories(forceFresh = false) {
    if (forceFresh) {
      localStorage.removeItem('cache_territories');
      return this.request('/territories/').then(data => {
        if (data) localStorage.setItem('cache_territories', JSON.stringify(data));
        return data;
      });
    }
    return this.requestWithCache('/territories/', {}, 'cache_territories');
  }
  createTerritory(data) {
    localStorage.removeItem('cache_territories');
    return this.request('/territories/', { method: 'POST', body: JSON.stringify(data) });
  }
  updateTerritory(id, data) {
    localStorage.removeItem('cache_territories');
    return this.request(`/territories/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  deleteTerritory(id) {
    localStorage.removeItem('cache_territories');
    return this.request(`/territories/${id}/`, { method: 'DELETE' });
  }


  // Crops
  getCrops() { return this.requestWithCache('/crops/', {}, 'cache_crops'); }
  getCrop(id) { return this.request(`/crops/${id}/`); }
  createCrop(data) {
    return this.request('/crops/', { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) });
  }
  updateCrop(id, data) {
    return this.request(`/crops/${id}/`, { method: 'PATCH', body: data instanceof FormData ? data : JSON.stringify(data) });
  }
  deleteCrop(id) { return this.request(`/crops/${id}/`, { method: 'DELETE' }); }
  getCropStages(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/crop-stages/${qs ? `?${qs}` : ''}`);
  }
  createVariety(data) { return this.request('/crop-varieties/', { method: 'POST', body: JSON.stringify(data) }); }

  updateVariety(id, data) { return this.request(`/crop-varieties/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }); }
  deleteVariety(id) { return this.request(`/crop-varieties/${id}/`, { method: 'DELETE' }); }
  createStage(data) { return this.request('/crop-stages/', { method: 'POST', body: JSON.stringify(data) }); }
  updateStage(id, data) { return this.request(`/crop-stages/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }); }
  deleteStage(id) { return this.request(`/crop-stages/${id}/`, { method: 'DELETE' }); }

  // Farmers
  getFarmers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/farmers/${qs ? `?${qs}` : ''}`);
  }

  getVillages() { return this.request('/farmers/villages/'); }
  getFarmer(id) { return this.request(`/farmers/${id}/`); }
  getFarmerIds(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/farmers/all_ids/${qs ? `?${qs}` : ''}`);
  }
  createFarmer(data) { return this.request('/farmers/', { method: 'POST', body: JSON.stringify(data) }); }
  updateFarmer(id, data) { return this.request(`/farmers/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }); }
  disableFarmer(id) { return this.request(`/farmers/${id}/disable/`, { method: 'PATCH' }); }
  exportFarmers() {
    return fetch(`${this.baseUrl}/farmers/export/`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${this.getToken()}` }
    })
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'farmers_export.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      });
  }
  bulkImportFarmers(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/farmers/bulk_import/', { method: 'POST', body: formData });
  }
  uploadForValidation(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/farmers/upload_for_validation/', { method: 'POST', body: formData });
  }
  commitImportFarmers(jobId, acknowledged) {
    return this.request('/farmers/commit_import/', {
      method: 'POST',
      body: JSON.stringify({ import_job_id: jobId, is_acknowledged: acknowledged })
    });
  }
  bulkAssignFarmers(farmerIds, assignedStaffId) {
    return this.request('/farmers/bulk_assign/', {
      method: 'POST',
      body: JSON.stringify({ farmer_ids: farmerIds, assigned_staff_id: assignedStaffId })
    });
  }
  getImportJobStatus(id) {
    return this.request(`/import-jobs/${id}/`);
  }

  downloadImportJobResults(id) {
    return fetch(`${this.baseUrl}/import-jobs/${id}/download_results/`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${this.getToken()}` }
    })
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `import_results_${id}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      });
  }

  // Plots
  getPlots(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/plots/${qs ? `?${qs}` : ''}`);
  }
  createPlot(data) { return this.request('/plots/', { method: 'POST', body: JSON.stringify(data) }); }
  updatePlot(id, data) { return this.request(`/plots/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }); }
  deletePlot(id) { return this.request(`/plots/${id}/`, { method: 'DELETE' }); }

  // Crop Seasons
  getCropSeasons(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/crop-seasons/${qs ? `?${qs}` : ''}`);
  }
  createCropSeason(data) { return this.request('/crop-seasons/', { method: 'POST', body: JSON.stringify(data) }); }
  updateCropSeason(id, data) { return this.request(`/crop-seasons/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }); }
  advanceCropStage(id) { return this.request(`/crop-seasons/${id}/advance_stage/`, { method: 'POST' }); }

  // Promotions
  getPromotions() { return this.request('/promotions/'); }
  createPromotion(data) { return this.request('/promotions/', { method: 'POST', body: JSON.stringify(data) }); }
  updatePromotion(id, data) { return this.request(`/promotions/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }); }
  deletePromotion(id) { return this.request(`/promotions/${id}/`, { method: 'DELETE' }); }
  uploadPromotionsForValidation(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/promotions/upload_for_validation/', { method: 'POST', body: formData });
  }
  commitImportPromotions(jobId) {
    return this.request('/promotions/commit_import/', {
      method: 'POST',
      body: JSON.stringify({ import_job_id: jobId })
    });
  }

  // Products
  getProducts() { return this.request('/products/'); }

  // Bulk Sends
  getBulkSends() { return this.request('/bulk-sends/'); }
  createBulkSend(data) { return this.request('/bulk-sends/', { method: 'POST', body: JSON.stringify(data) }); }
  updateBulkSend(id, data) { return this.request(`/bulk-sends/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }); }
  cancelBulkSend(id) { return this.request(`/bulk-sends/${id}/cancel/`, { method: 'POST' }); }
  approveBulkSend(id) { return this.request(`/bulk-sends/${id}/approve/`, { method: 'POST' }); }
  rejectBulkSend(id) { return this.request(`/bulk-sends/${id}/reject/`, { method: 'POST' }); }

  async getDashboard(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await this.request(`/dashboard/${qs ? `?${qs}` : ''}`);
    if (typeof window !== 'undefined') {
      console.log('🔍 [DIAGNOSTIC TRACE] API getDashboard Response:', {
        url: `/dashboard/${qs ? `?${qs}` : ''}`,
        received_total_farmers: res?.total_farmers,
        received_total_plots: res?.total_plots,
        received_active_crop_seasons: res?.active_crop_seasons,
        received_total_visits: res?.total_visits,
        received_total_calls: res?.total_calls,
        debug_trace: res?.debug_trace
      });
    }
    return res;
  }
  getActiveCrops() {
    return this.request('/dashboard/active_crops/').catch(() => this.request('/active-crops/'));
  }
  getFarmerPlots() {
    return this.request('/dashboard/farmer_plots/').catch(() => this.request('/farmer-plots/'));
  }
  getOverdueVisits() {
    return this.request('/dashboard/overdue_visits/');
  }
  getHierarchy() {
    return this.request('/hierarchy/').catch(() => this.request('/dashboard/hierarchy/')).catch(() => this.request('/hierarchy'));
  }
  exportReport(type = 'excel') { return this.request(`/export-report/?type=${type}`); }


  // Planner
  getDailyPlan(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/planner/daily_plan/${qs ? `?${qs}` : ''}`);
  }

  getBigFarmers(village) {
    return this.request(`/route/big-farmers/?village=${encodeURIComponent(village)}`);
  }

  // Activities
  logActivity(data) {
    return this.request('/activities/', { method: 'POST', body: JSON.stringify(data) });
  }

  // Audit Logs
  getAuditLogs() { return this.request('/audit-logs/'); }

  // Config
  getConfig() { return this.request('/config/'); }
  updateConfig(data) { return this.request('/config/', { method: 'PUT', body: JSON.stringify(data) }); }

  // Field Visits
  getFieldVisits(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/field-visits/${qs ? `?${qs}` : ''}`);
  }
  createFieldVisit(data) { return this.request('/field-visits/', { method: 'POST', body: JSON.stringify(data) }); }
  checkOutFieldVisit(id, data = {}) { return this.request(`/field-visits/${id}/check_out/`, { method: 'POST', body: JSON.stringify(data) }); }
  uploadVisitPhoto(id, data) { return this.request(`/field-visits/${id}/upload_photo/`, { method: 'POST', body: JSON.stringify(data) }); }
  getWeeklyVisitSummary() { return this.request('/field-visits/weekly_summary/'); }

  // Call Logs
  getCallLogs(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/call-logs/${qs ? `?${qs}` : ''}`);
  }
  createCallLog(data) { return this.request('/call-logs/', { method: 'POST', body: JSON.stringify(data) }); }

  // Recommendations
  getRecommendations(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/recommendations/${qs ? `?${qs}` : ''}`);
  }
  createRecommendation(data) { return this.request('/recommendations/', { method: 'POST', body: JSON.stringify(data) }); }
  getAiRecommendationSuggestions(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/recommendations/suggestions/${qs ? `?${qs}` : ''}`);
  }
  sendRecommendationWhatsApp(id, data = {}) { return this.request(`/recommendations/${id}/send_whatsapp/`, { method: 'POST', body: JSON.stringify(data) }); }
  sendRecommendationSms(id, data = {}) { return this.request(`/recommendations/${id}/send_sms/`, { method: 'POST', body: JSON.stringify(data) }); }
  reviewRecommendation(id, data) { return this.request(`/recommendations/${id}/review/`, { method: 'POST', body: JSON.stringify(data) }); }
  getRecommendationAnalytics() { return this.request('/recommendations/analytics/'); }

  // Unified Farmer Timeline
  getFarmerTimeline(farmerId, page = 1) { return this.request(`/farmers/${farmerId}/timeline/?page=${page}`); }

  // Offline Sync
  syncOfflineBatch(data) { return this.request('/sync/offline_batch/', { method: 'POST', body: JSON.stringify(data) }); }

  // Market Intelligence
  importMarketData(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/market/import/', {
      method: 'POST',
      body: formData
    });
  }

  getUnmappedCommodities() {
    return this.request('/market/mappings/');
  }

  mapCommodity(mapping_id, crop_id, action = 'link') {
    return this.request('/market/mappings/', {
      method: 'POST',
      body: JSON.stringify({ mapping_id, crop_id, action })
    });
  }

  // Audience Targeting
  getFarmerIds(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/farmers/all_ids/${qs ? `?${qs}` : ''}`);
  }

  getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  }

}

const api = new ApiClient();
export default api;
