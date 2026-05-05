const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

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
  }

  clearTokens() {
    localStorage.removeItem('ffma_access_token');
    localStorage.removeItem('ffma_refresh_token');
    localStorage.removeItem('ffma_role');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { ...options.headers };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(url, { ...options, headers });

    // If 401, try to refresh
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
      return response.json();
    }
    return response;
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
  sendOtp(mobile_number) {
    return this.request('/auth/send-otp/', {
      method: 'POST',
      body: JSON.stringify({ mobile_number }),
    });
  }

  verifyOtp(mobile_number, otp) {
    return this.request('/auth/verify-otp/', {
      method: 'POST',
      body: JSON.stringify({ mobile_number, otp }),
    });
  }

  logout() {
    const refresh = this.getRefreshToken();
    this.clearTokens();
    if (refresh) {
      return this.request('/auth/invalidate-session/', {
        method: 'POST',
        body: JSON.stringify({ refresh }),
      }).catch(() => {});
    }
  }

  // Users
  getUsers() { return this.request('/users/'); }
  getUser(id) { return this.request(`/users/${id}/`); }
  createUser(data) { return this.request('/users/', { method: 'POST', body: JSON.stringify(data) }); }
  updateUser(id, data) { return this.request(`/users/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }); }
  deleteUser(id) { return this.request(`/users/${id}/`, { method: 'DELETE' }); }
  enableUser(id) { return this.request(`/users/${id}/enable/`, { method: 'PATCH' }); }
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
  getTerritories() { return this.request('/territories/'); }
  createTerritory(data) { return this.request('/territories/', { method: 'POST', body: JSON.stringify(data) }); }
  updateTerritory(id, data) { return this.request(`/territories/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }); }
  deleteTerritory(id) { return this.request(`/territories/${id}/`, { method: 'DELETE' }); }

  // Crops
  getCrops() { return this.request('/crops/'); }
  getCrop(id) { return this.request(`/crops/${id}/`); }
  createCrop(data) { 
    return this.request('/crops/', { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }); 
  }
  updateCrop(id, data) { 
    return this.request(`/crops/${id}/`, { method: 'PATCH', body: data instanceof FormData ? data : JSON.stringify(data) }); 
  }
  deleteCrop(id) { return this.request(`/crops/${id}/`, { method: 'DELETE' }); }
  createVariety(data) { return this.request('/crop-varieties/', { method: 'POST', body: JSON.stringify(data) }); }
  updateVariety(id, data) { return this.request(`/crop-varieties/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }); }
  deleteVariety(id) { return this.request(`/crop-varieties/${id}/`, { method: 'DELETE' }); }
  createStage(data) { return this.request('/crop-stages/', { method: 'POST', body: JSON.stringify(data) }); }
  updateStage(id, data) { return this.request(`/crop-stages/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }); }
  deleteStage(id) { return this.request(`/crop-stages/${id}/`, { method: 'DELETE' }); }

  // Farmers
  getFarmers() { return this.request('/farmers/'); }
  getFarmer(id) { return this.request(`/farmers/${id}/`); }
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
  approveBulkSend(id) { return this.request(`/bulk-sends/${id}/approve/`, { method: 'POST' }); }
  rejectBulkSend(id) { return this.request(`/bulk-sends/${id}/reject/`, { method: 'POST' }); }

  // Dashboard & Reports
  getDashboard() { return this.request('/dashboard/'); }
  exportReport(type = 'excel') { return this.request(`/export-report/?type=${type}`); }

  // Audit Logs
  getAuditLogs() { return this.request('/audit-logs/'); }

  // Config
  getConfig() { return this.request('/config/'); }
  updateConfig(data) { return this.request('/config/', { method: 'PUT', body: JSON.stringify(data) }); }
}

const api = new ApiClient();
export default api;
