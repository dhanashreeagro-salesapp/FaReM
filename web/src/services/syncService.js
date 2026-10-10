import api from './api';
import { bulkPut, setVal, getVal } from '../utils/db';

class SyncService {
  constructor() {
    this.syncInterval = null;
    this.isSyncing = false;
  }

  startSync(intervalMs = 5 * 60 * 1000) { // Default 5 mins
    if (this.syncInterval) clearInterval(this.syncInterval);
    // Initial sync
    this.performSync();
    // Schedule periodic sync
    this.syncInterval = setInterval(() => this.performSync(), intervalMs);
  }

  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async performSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      const lastSync = await getVal('meta', 'last_sync_time');
      const params = lastSync ? { last_sync: lastSync } : {};
      
      const response = await api.request(`/sync/downstream/${new URLSearchParams(params).toString() ? `?${new URLSearchParams(params).toString()}` : ''}`);
      if (!response) {
        this.isSyncing = false;
        return;
      }

      // Save App Data
      if (response.app_data) {
        await setVal('app_data', 'crops', response.app_data.crops || []);
        await setVal('app_data', 'crop_stages', response.app_data.crop_stages || []);
        await setVal('app_data', 'market_rates', response.app_data.market_rates || []);
      }

      // Save User Data
      if (response.user_data) {
        await bulkPut('farmers', response.user_data.farmers || []);
        await bulkPut('plots', response.user_data.plots || []);
        await bulkPut('crop_seasons', response.user_data.crop_seasons || []);
        await bulkPut('visits', response.user_data.visits || []);
        await bulkPut('calls', response.user_data.calls || []);
        await bulkPut('recommendations', response.user_data.recommendations || []);
      }

      // Update sync time
      if (response.timestamp) {
        await setVal('meta', 'last_sync_time', response.timestamp);
      }
      
      console.log('✅ LocalDB Delta Sync completed at', new Date().toISOString());
      
      // Dispatch event to notify components that local data is updated
      window.dispatchEvent(new CustomEvent('localdb-synced'));

    } catch (err) {
      console.error('❌ LocalDB Sync failed:', err);
    } finally {
      this.isSyncing = false;
    }
  }
}

const syncService = new SyncService();
export default syncService;
