import api from '../services/api';
import { putItem, getItem } from './db';

const FARMERS_KEY = 'ffma_offline_farmers';
const PLOTS_KEY = 'ffma_offline_plots';
const SEASONS_KEY = 'ffma_offline_crop_seasons';
const VISITS_KEY = 'ffma_offline_visits';
const CALLS_KEY = 'ffma_offline_calls';
const RECS_KEY = 'ffma_offline_recommendations';

export const offlineQueue = {
  // Farmers
  getFarmers() {
    return JSON.parse(localStorage.getItem(FARMERS_KEY) || '[]');
  },
  saveFarmer(farmerData) {
    const farmers = this.getFarmers();
    const id = farmerData.id || `temp_f_${Date.now()}`;
    farmers.push({ ...farmerData, id, temp_id: id });
    localStorage.setItem(FARMERS_KEY, JSON.stringify(farmers));
    return id;
  },
  removeFarmer(id) {
    const filtered = this.getFarmers().filter(f => f.id !== id && f.temp_id !== id);
    localStorage.setItem(FARMERS_KEY, JSON.stringify(filtered));
  },

  // Plots
  getPlots() {
    return JSON.parse(localStorage.getItem(PLOTS_KEY) || '[]');
  },
  savePlot(plotData) {
    const plots = this.getPlots();
    const id = plotData.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `temp_p_${Date.now()}`);
    const plotWithId = { ...plotData, id, temp_id: id };
    plots.push(plotWithId);
    localStorage.setItem(PLOTS_KEY, JSON.stringify(plots));
    return id;
  },
  removePlot(id) {
    const filtered = this.getPlots().filter(p => p.id !== id && p.temp_id !== id);
    localStorage.setItem(PLOTS_KEY, JSON.stringify(filtered));
  },

  // Crop Seasons
  getCropSeasons() {
    return JSON.parse(localStorage.getItem(SEASONS_KEY) || '[]');
  },
  saveCropSeason(seasonData) {
    const seasons = this.getCropSeasons();
    const id = seasonData.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `temp_s_${Date.now()}`);
    const seasonWithId = { ...seasonData, id, temp_id: id };
    seasons.push(seasonWithId);
    localStorage.setItem(SEASONS_KEY, JSON.stringify(seasons));
    return id;
  },
  removeCropSeason(id) {
    const filtered = this.getCropSeasons().filter(s => s.id !== id && s.temp_id !== id);
    localStorage.setItem(SEASONS_KEY, JSON.stringify(filtered));
  },

  // Visits
  getVisits() {
    return JSON.parse(localStorage.getItem(VISITS_KEY) || '[]');
  },
  saveVisit(visitData) {
    const visits = this.getVisits();
    visits.push({ ...visitData, temp_id: `temp_v_${Date.now()}` });
    localStorage.setItem(VISITS_KEY, JSON.stringify(visits));
  },

  // Calls
  getCalls() {
    return JSON.parse(localStorage.getItem(CALLS_KEY) || '[]');
  },
  saveCall(callData) {
    const calls = this.getCalls();
    calls.push({ ...callData, temp_id: `temp_c_${Date.now()}` });
    localStorage.setItem(CALLS_KEY, JSON.stringify(calls));
  },

  // Recommendations
  getRecommendations() {
    return JSON.parse(localStorage.getItem(RECS_KEY) || '[]');
  },
  saveRecommendation(recData) {
    const recs = this.getRecommendations();
    recs.push({ ...recData, temp_id: `temp_r_${Date.now()}` });
    localStorage.setItem(RECS_KEY, JSON.stringify(recs));
  },

  clearAll() {
    localStorage.removeItem(FARMERS_KEY);
    localStorage.removeItem(PLOTS_KEY);
    localStorage.removeItem(SEASONS_KEY);
    localStorage.removeItem(VISITS_KEY);
    localStorage.removeItem(CALLS_KEY);
    localStorage.removeItem(RECS_KEY);
  },

  async syncNow() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const farmers = this.getFarmers();
    const plots = this.getPlots();
    const crop_seasons = this.getCropSeasons();
    const visits = this.getVisits();
    const calls = this.getCalls();
    const recommendations = this.getRecommendations();

    if (!farmers.length && !plots.length && !crop_seasons.length && !visits.length && !calls.length && !recommendations.length) {
      return;
    }

    try {
      const resp = await api.syncOfflineBatch({
        farmers,
        plots,
        crop_seasons,
        visits,
        calls,
        recommendations
      });

      if (resp) {
        // Mark synced items in IndexedDB
        if (resp.synced_plots > 0) {
          for (const p of plots) {
            try {
              const existing = await getItem('plots', p.id);
              if (existing) {
                await putItem('plots', { ...existing, _sync_status: 'synced' });
              }
            } catch (e) {
              console.warn("Error updating synced plot in IDB:", e);
            }
          }
        }

        if (resp.synced_seasons > 0) {
          for (const s of crop_seasons) {
            try {
              const existing = await getItem('crop_seasons', s.id);
              if (existing) {
                await putItem('crop_seasons', { ...existing, _sync_status: 'synced' });
              }
            } catch (e) {
              console.warn("Error updating synced season in IDB:", e);
            }
          }
        }

        this.clearAll();
        console.log("✅ Offline batch sync successful:", resp);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('localdb-synced'));
        }
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
