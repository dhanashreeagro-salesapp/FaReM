import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { getCurrentGpsPosition, calculateHaversineDistance, sortFarmersByDistance } from '../utils/gps';
import { compressImage } from '../utils/imageCompressor';
import { offlineQueue } from '../utils/offlineQueue';
import { MapPin, Camera, Clock, AlertTriangle, CheckCircle2, X, Loader2, Navigation, FileText } from 'lucide-react';

export default function LogVisitModal({ farmer: initialFarmer, onClose, onSuccess }) {
  const [farmers, setFarmers] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState(initialFarmer || null);
  const [plots, setPlots] = useState([]);
  const [selectedPlot, setSelectedPlot] = useState(null);
  
  const [mode, setMode] = useState('instant'); // 'instant' or 'checkin'
  const [checkInState, setCheckInState] = useState(null); // active checkin object
  
  const [purpose, setPurpose] = useState('Routine Visit');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  
  const [gps, setGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [config, setConfig] = useState({ visit_radius_meters: 150, gps_validation_mode: 'Warning' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const visitPurposes = [
    'Product Demonstration',
    'Crop Advisory',
    'Issue Resolution',
    'Routine Visit',
    'Complaint Investigation',
    'New Farmer Registration',
    'Collection',
    'Other'
  ];

  useEffect(() => {
    async function init() {
      setGpsLoading(true);
      try {
        const pos = await getCurrentGpsPosition();
        setGps(pos);

        // Fetch config
        const sysConfig = await api.getConfig();
        if (sysConfig) setConfig(sysConfig);

        // Fetch farmers if not provided
        if (!initialFarmer) {
          const resp = await api.getFarmers();
          const list = resp.results || resp || [];
          const sorted = sortFarmersByDistance(list, pos.latitude, pos.longitude);
          setFarmers(sorted);
          if (sorted.length > 0) setSelectedFarmer(sorted[0]);
        }
      } catch (err) {
        console.error("GPS Init Error:", err);
      }
      setGpsLoading(false);
    }
    init();
  }, [initialFarmer]);

  useEffect(() => {
    if (selectedFarmer) {
      api.getPlots({ farmer_id: selectedFarmer.id }).then(res => {
        const list = res.results || res || [];
        setPlots(list);
        if (list.length > 0) setSelectedPlot(list[0]);
        else setSelectedPlot(null);
      }).catch(() => setPlots([]));
    }
  }, [selectedFarmer]);

  const handlePhotoAdd = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setLoading(true);
    try {
      const compressedFiles = await Promise.all(files.map(f => compressImage(f)));
      setPhotos(prev => [...prev, ...compressedFiles]);
    } catch (err) {
      console.error("Image compression error:", err);
    }
    setLoading(false);
  };

  const handleLogVisit = async () => {
    if (!selectedFarmer) {
      setError("Please select a farmer");
      return;
    }
    if (notes.length < 10) {
      setError("Visit notes must be at least 10 characters long");
      return;
    }

    setLoading(true);
    setError(null);

    const lat = gps?.latitude || 18.5204;
    const lon = gps?.longitude || 73.8567;

    const payload = {
      farmer: selectedFarmer.id,
      plot: selectedPlot?.id || null,
      purpose,
      notes,
      latitude: lat,
      longitude: lon,
      gps_accuracy: gps?.accuracy || 10,
      is_check_in: mode === 'checkin'
    };

    try {
      if (!navigator.onLine) {
        // Save offline
        offlineQueue.saveVisit(payload);
        alert("Network offline: Visit recorded locally and will auto-sync when reconnected!");
        if (onSuccess) onSuccess();
        onClose();
        return;
      }

      const res = await api.createFieldVisit(payload);

      // Upload photos if any
      if (photos.length > 0 && res.id) {
        for (const photoFile of photos) {
          // Mock upload or blob url storage
          const fakeUrl = URL.createObjectURL(photoFile);
          await api.uploadVisitPhoto(res.id, { photo_url: fakeUrl });
        }
      }

      if (onSuccess) onSuccess(res);
      onClose();
    } catch (err) {
      setError(err.error || "Failed to log visit");
    }
    setLoading(false);
  };

  const calculateDistance = () => {
    if (!gps || !selectedPlot || !selectedPlot.location) return null;
    return calculateHaversineDistance(
      gps.latitude,
      gps.longitude,
      selectedPlot.location.y,
      selectedPlot.location.x
    );
  };

  const currentDistance = calculateDistance();
  const radiusLimit = config.visit_radius_meters || 150;
  const isOutside = currentDistance !== null && currentDistance > radiusLimit;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <MapPin size={22} />
            </div>
            <div>
              <h3 className="text-lg font-heading font-bold text-text">Log Field Visit</h3>
              <p className="text-xs text-text-muted">Record GPS verified farmer interaction</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text rounded-lg hover:bg-bg">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-danger text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* GPS Badge */}
        <div className="p-3.5 bg-bg border border-border rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Navigation size={16} className={gpsLoading ? "animate-spin text-primary" : "text-emerald-600"} />
            <div>
              <span className="font-semibold text-text">GPS Location: </span>
              {gpsLoading ? (
                <span className="text-text-muted">Acquiring satellite fix...</span>
              ) : (
                <span className="text-text font-mono">{gps?.latitude?.toFixed(4)}, {gps?.longitude?.toFixed(4)} (±{gps?.accuracy}m)</span>
              )}
            </div>
          </div>
          {currentDistance !== null && (
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
              isOutside ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {currentDistance}m from Plot ({isOutside ? 'Outside Radius' : 'Verified'})
            </span>
          )}
        </div>

        {/* Farmer Picker */}
        {!initialFarmer && (
          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">Select Farmer (Sorted by Proximity)</label>
            <select
              value={selectedFarmer?.id || ''}
              onChange={(e) => {
                const f = farmers.find(item => item.id === e.target.value);
                setSelectedFarmer(f);
              }}
              className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-sm font-medium text-text focus:ring-2 focus:ring-primary/20 outline-none"
            >
              {farmers.map(f => (
                <option key={f.id} value={f.id}>
                  {f.full_name} ({f.village || 'No Village'}) - {f.calculated_distance !== null ? `${f.calculated_distance}m away` : 'No GPS'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Plot Picker */}
        {plots.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">Associated Plot (Optional)</label>
            <select
              value={selectedPlot?.id || ''}
              onChange={(e) => {
                const p = plots.find(item => item.id === e.target.value);
                setSelectedPlot(p);
              }}
              className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-sm font-medium text-text focus:ring-2 focus:ring-primary/20 outline-none"
            >
              <option value="">-- No specific plot (General Visit) --</option>
              {plots.map(p => (
                <option key={p.id} value={p.id}>{p.plot_name} ({p.total_area_acres} Acres)</option>
              ))}
            </select>
          </div>
        )}

        {/* Purpose */}
        <div>
          <label className="block text-xs font-semibold text-text mb-1.5">Visit Purpose</label>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-sm font-medium text-text focus:ring-2 focus:ring-primary/20 outline-none"
          >
            {visitPurposes.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Multiline Notes */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-semibold text-text">Visit Notes & Observations</label>
            <span className={`text-[11px] ${notes.length < 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {notes.length} / 3000 chars (Min 10)
            </span>
          </div>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Record observations, crop growth status, pest issues, or recommendations discussed..."
            className="w-full p-3 bg-bg border border-border rounded-xl text-sm text-text focus:ring-2 focus:ring-primary/20 outline-none resize-none"
          />
        </div>

        {/* Photo Upload */}
        <div>
          <label className="block text-xs font-semibold text-text mb-1.5">Capture / Upload Visit Photos</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 cursor-pointer rounded-xl text-xs font-semibold transition-all">
              <Camera size={16} />
              <span>Add Photos ({photos.length})</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoAdd}
                className="hidden"
              />
            </label>
            <span className="text-xs text-text-muted">Auto-compressed before upload</span>
          </div>
          {photos.length > 0 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {photos.map((img, idx) => (
                <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0">
                  <img src={URL.createObjectURL(img)} alt="preview" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-3 border-t border-border flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-border text-text-muted hover:bg-bg rounded-xl text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || notes.length < 10}
            onClick={handleLogVisit}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-md transition-all"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            <span>Save & Log Visit</span>
          </button>
        </div>

      </div>
    </div>
  );
}
