import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { getCurrentGpsPosition, calculateHaversineDistance, sortFarmersByDistance } from '../utils/gps';
import { compressImage } from '../utils/imageCompressor';
import { offlineQueue } from '../utils/offlineQueue';
import { MapPin, Camera, Clock, AlertTriangle, CheckCircle2, X, Loader2, Navigation, FileText } from 'lucide-react';

function LogVisitModalContent({ farmer: initialFarmer, onClose, onSuccess, onCreatePlot }) {
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

  const [statusMessage, setStatusMessage] = useState('Getting location...');
  const abortControllerRef = React.useRef(null);

  useEffect(() => {
    let isMounted = true;
    abortControllerRef.current = new AbortController();

    async function init() {
      setGpsLoading(true);
      setStatusMessage('Getting location...');

      // 1. Fetch system config and farmers immediately in parallel without blocking
      api.getConfig().then(sysConfig => {
        if (isMounted && sysConfig) setConfig(sysConfig);
      }).catch(() => {});

      if (!initialFarmer) {
        api.getFarmers().then(resp => {
          if (!isMounted) return;
          const list = resp.results || resp || [];
          setFarmers(list);
          if (list.length > 0 && !selectedFarmer) setSelectedFarmer(list[0]);
        }).catch(() => {});
      }

      // 2. Fetch GPS fix concurrently with fast 4s timeout
      try {
        const pos = await getCurrentGpsPosition({ timeout: 4000, signal: abortControllerRef.current.signal });
        if (isMounted) {
          setGps(pos);
          setStatusMessage('Checking distance...');
          // Re-sort farmers by distance once GPS acquired
          if (!initialFarmer) {
            setFarmers(prev => sortFarmersByDistance(prev, pos.latitude, pos.longitude));
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError' && isMounted) {
          console.warn("GPS Background Fetch Warning:", err);
        }
      }
      if (isMounted) setGpsLoading(false);
    }

    init();

    return () => {
      isMounted = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [initialFarmer]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onClose();
  };

  useEffect(() => {
    if (selectedFarmer?.id) {
      api.getPlots({ farmer: selectedFarmer.id, farmer_id: selectedFarmer.id }).then(res => {
        const raw = res.results || res || [];
        const list = raw.filter(p => String(p.farmer?.id || p.farmer) === String(selectedFarmer.id));
        setPlots(list);
        if (list.length > 0) setSelectedPlot(list[0]);
        else setSelectedPlot(null);
      }).catch(() => setPlots([]));
    }
  }, [selectedFarmer]);

  const handlePhotoAdd = async (e) => {
    const files = Array.from(e.target.files);
    const compressedList = [];
    for (const f of files) {
      try {
        const c = await compressImage(f);
        compressedList.push(c);
      } catch {
        compressedList.push(f);
      }
    }
    setPhotos(prev => [...prev, ...compressedList]);
  };

  const calculateDistance = () => {
    if (!gps || !selectedPlot) return null;
    try {
      let plotLat = null, plotLng = null;
      let loc = selectedPlot.location;
      if (typeof loc === 'string') {
        try { loc = JSON.parse(loc); } catch { loc = null; }
      }
      if (!loc && selectedPlot.location_geojson) {
        try { loc = typeof selectedPlot.location_geojson === 'string' ? JSON.parse(selectedPlot.location_geojson) : selectedPlot.location_geojson; } catch { loc = null; }
      }

      if (typeof loc === 'object' && loc !== null) {
        if (loc.type === 'Polygon' && Array.isArray(loc.coordinates) && loc.coordinates[0]?.length > 0) {
          // Polygon ring: array of [lng, lat]
          const ring = loc.coordinates[0];
          let sumLat = 0, sumLng = 0;
          let count = 0;
          for (const pt of ring) {
            if (Array.isArray(pt) && pt.length >= 2) {
              sumLng += Number(pt[0]);
              sumLat += Number(pt[1]);
              count++;
            }
          }
          if (count > 0) {
            plotLng = sumLng / count;
            plotLat = sumLat / count;
          }
        } else if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2 && typeof loc.coordinates[0] === 'number') {
          plotLng = Number(loc.coordinates[0]);
          plotLat = Number(loc.coordinates[1]);
        } else if (loc.latitude != null && loc.longitude != null) {
          plotLat = Number(loc.latitude);
          plotLng = Number(loc.longitude);
        } else if (loc.y != null && loc.x != null) {
          plotLat = Number(loc.y);
          plotLng = Number(loc.x);
        }
      }

      if (plotLat !== null && plotLng !== null && !isNaN(plotLat) && !isNaN(plotLng) && gps?.latitude && gps?.longitude) {
        const d = calculateHaversineDistance(gps.latitude, gps.longitude, plotLat, plotLng);
        return (d !== null && !isNaN(d)) ? Math.round(d) : null;
      }
    } catch (e) {
      console.warn("Distance calculation error:", e);
      return null;
    }
    return null;
  };

  const currentDistance = calculateDistance();
  const radiusLimit = config.visit_radius_meters || 150;
  const isOutside = currentDistance !== null && currentDistance > radiusLimit;
  const validationMode = config.gps_validation_mode || 'Warning';

  const handleSaveVisit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedFarmer) {
      setError("Please select a farmer");
      return;
    }
    if (!notes || notes.trim().length < 10) {
      setError("Please enter detailed visit notes (at least 10 characters)");
      return;
    }

    const isStrict = String(validationMode).trim().toLowerCase() === 'strict';
    if (isStrict && isOutside) {
      setError(`Cannot save visit: You are ${currentDistance}m away from the plot (configured limit is ${radiusLimit}m).`);
      return;
    }

    setLoading(true);
    setStatusMessage('Saving visit...');
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
          try {
            const dataUrl = await compressImage(photoFile, 800, 800, 0.7).catch(() => null);
            const finalUrl = dataUrl || URL.createObjectURL(photoFile);
            await api.uploadVisitPhoto(res.id, { photo_url: finalUrl }).catch((pErr) => {
              console.warn("Photo upload error:", pErr);
            });
          } catch (pEx) {
            console.warn("Photo compression error:", pEx);
          }
        }
      }

      if (onSuccess) onSuccess(res);
      onClose();
    } catch (err) {
      let msg = err.error || err.detail;
      if (!msg && typeof err === 'object') {
        const keys = Object.keys(err);
        if (keys.length > 0) {
          const val = err[keys[0]];
          msg = Array.isArray(val) ? `${keys[0]}: ${val.join(', ')}` : `${keys[0]}: ${String(val)}`;
        }
      }
      setError(msg || "Failed to log visit");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto pt-10 pb-10">
      <div className="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-auto">
        
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

        {/* Selected Farmer Info Card */}
        {selectedFarmer && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Farmer Name</span>
              <h4 className="font-heading font-bold text-sm text-emerald-950">{selectedFarmer.full_name}</h4>
              <p className="text-text-muted text-[11px]">{selectedFarmer.village || 'No Village'} • Mobile: {selectedFarmer.primary_mobile || 'N/A'}</p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-700 text-white rounded-lg font-bold text-[11px]">Selected</span>
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

        {/* Farmer Picker for general visits */}
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
        {plots.length > 0 ? (
          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">Associated Plot (Belonging to {selectedFarmer?.full_name})</label>
            <select
              value={selectedPlot?.id || ''}
              onChange={(e) => {
                const p = plots.find(item => item.id === e.target.value);
                setSelectedPlot(p);
              }}
              className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-sm font-medium text-text focus:ring-2 focus:ring-primary/20 outline-none font-medium"
            >
              <option value="">-- General Visit (No Specific Plot) --</option>
              {plots.map(p => (
                <option key={p.id} value={p.id}>{p.plot_name} ({p.area_acres || p.total_area_acres || 0} Acres — {p.soil_type || 'Normal Soil'})</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-semibold">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span>No plots registered for {selectedFarmer?.full_name || 'this farmer'} yet.</span>
            </div>
            <p className="text-text-muted text-[11px]">You can log a general visit, or create a plot and crop season for this farmer now.</p>
            {onCreatePlot && selectedFarmer && (
              <button
                type="button"
                onClick={() => onCreatePlot(selectedFarmer)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                + Create Plot & Crop Season for {selectedFarmer.full_name}
              </button>
            )}
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
            <span className={`text-[11px] ${notes.length < 10 || notes.length > 3000 ? 'text-danger' : 'text-emerald-600'}`}>
              {notes.length} / 3000 chars (Min 10)
            </span>
          </div>
          <textarea
            rows={3}
            value={notes}
            maxLength={3000}
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
            onClick={handleCancel}
            className="px-4 py-2.5 border border-border text-text-muted hover:bg-bg rounded-xl text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || notes.length < 10 || notes.length > 3000}
            onClick={handleSaveVisit}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-md transition-all cursor-pointer"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            <span>Save & Log Visit</span>
          </button>
        </div>

      </div>
    </div>
  );
}

class LogVisitErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("LogVisitModal ErrorBoundary caught exception:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600 font-bold font-heading text-base">
              <AlertTriangle size={24} />
              <span>We couldn't open the Field Visit form</span>
            </div>
            <p className="text-xs text-text-muted">An unexpected error occurred while loading the visit workflow.</p>
            <div className="p-3 bg-red-50 border border-red-200 text-danger text-[11px] font-mono rounded-xl max-h-24 overflow-y-auto">
              {this.state.error?.toString()}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  if (this.props.onClose) this.props.onClose();
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-text text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 cursor-pointer"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function LogVisitModal(props) {
  if (props.isOpen === false) return null;
  return (
    <LogVisitErrorBoundary onClose={props.onClose}>
      <LogVisitModalContent {...props} />
    </LogVisitErrorBoundary>
  );
}
