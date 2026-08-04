import api from '../services/api';

const VISITS_KEY = 'ffma_offline_visits';
const CALLS_KEY = 'ffma_offline_calls';
const RECS_KEY = 'ffma_offline_recommendations';

export const offlineQueue = {
  getVisits() {
    return JSON.parse(localStorage.getItem(VISITS_KEY) || '[]');
  },
  saveVisit(visitData) {
    const visits = this.getVisits();
    visits.push({ ...visitData, temp_id: `temp_v_${Date.now()}` });
    localStorage.setItem(VISITS_KEY, JSON.stringify(visits));
  },
  getCalls() {
    return JSON.parse(localStorage.getItem(CALLS_KEY) || '[]');
  },
  saveCall(callData) {
    const calls = this.getCalls();
    calls.push({ ...callData, temp_id: `temp_c_${Date.now()}` });
    localStorage.setItem(CALLS_KEY, JSON.stringify(calls));
  },
  getRecommendations() {
    return JSON.parse(localStorage.getItem(RECS_KEY) || '[]');
  },
  saveRecommendation(recData) {
    const recs = this.getRecommendations();
    recs.push({ ...recData, temp_id: `temp_r_${Date.now()}` });
    localStorage.setItem(RECS_KEY, JSON.stringify(recs));
  },
  clearAll() {
    localStorage.removeItem(VISITS_KEY);
    localStorage.removeItem(CALLS_KEY);
    localStorage.removeItem(RECS_KEY);
  },
  async syncNow() {
    if (!navigator.onLine) return;

    const visits = this.getVisits();
    const calls = this.getCalls();
    const recommendations = this.getRecommendations();

    if (!visits.length && !calls.length && !recommendations.length) {
      return;
    }

    try {
      const resp = await api.syncOfflineBatch({
        visits,
        calls,
        recommendations
      });

      if (resp && (resp.synced_visits > 0 || resp.synced_calls > 0 || resp.synced_recommendations > 0)) {
        this.clearAll();
        console.log("Offline batch sync successful:", resp);
      }
    } catch (err) {
      console.error("Offline sync error:", err);
    }
  }
};

// Automatic online event listener for auto-synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log("Network reconnected. Triggering offline batch sync...");
    offlineQueue.syncNow();
  });
}
