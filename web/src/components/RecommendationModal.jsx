import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { offlineQueue } from '../utils/offlineQueue';
import { Sparkles, Award, Send, MessageSquare, CheckCircle2, AlertTriangle, X, Loader2, Info } from 'lucide-react';

export default function RecommendationModal({ farmer, onClose, onSuccess, onCreatePlot }) {
  const [allCrops, setAllCrops] = useState([]);
  const [stages, setStages] = useState([]);
  const [products, setProducts] = useState([]);

  const [farmerPlots, setFarmerPlots] = useState([]);
  const [selectedPlotId, setSelectedPlotId] = useState('');
  const [availableCrops, setAvailableCrops] = useState([]);

  const [selectedCrop, setSelectedCrop] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [productName, setProductName] = useState('');
  const [dose, setDose] = useState('2.5');
  const [doseUnit, setDoseUnit] = useState('ml/L');
  const [timing, setTiming] = useState('Early Morning');
  const [applicationMethod, setApplicationMethod] = useState('Foliar Spray');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('Normal');

  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [previewChannel, setPreviewChannel] = useState('WhatsApp');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load All Master Crops & Products
  useEffect(() => {
    async function loadData() {
      try {
        const [cList, pList] = await Promise.all([
          api.getCrops(),
          api.getProducts()
        ]);
        const crps = Array.isArray(cList) ? cList : (cList.results || []);
        const prods = Array.isArray(pList) ? pList : (pList.results || []);
        setAllCrops(crps);
        setAvailableCrops(crps);
        setProducts(prods);
      } catch (err) {
        console.error("Failed loading options:", err);
      }
    }
    loadData();
  }, []);

  // Load Farmer Plots
  useEffect(() => {
    async function loadFarmerPlots() {
      if (!farmer?.id) return;
      try {
        const res = await api.getPlots({ farmer_id: farmer.id });
        const plotsList = Array.isArray(res) ? res : (res.results || []);
        setFarmerPlots(plotsList);

        if (plotsList.length > 0) {
          const firstPlot = plotsList[0];
          setSelectedPlotId(firstPlot.id);
          updateCropsForPlot(firstPlot, allCrops);
        }
      } catch (err) {
        console.warn("Could not load farmer plots:", err);
      }
    }
    loadFarmerPlots();
  }, [farmer]);

  const updateCropsForPlot = (plot, masterCrops = allCrops) => {
    if (!plot) {
      // If no plot selected, restrict to crops active across all farmer's plots if available
      const allFarmerCropIds = setOfIds(
        farmerPlots.flatMap(p => (p.seasons || []).filter(s => s.status === 'Active').map(s => s.crop?.id || s.crop))
      );
      const farmerCrops = masterCrops.filter(c => allFarmerCropIds.has(String(c.id)));
      setAvailableCrops(farmerCrops.length > 0 ? farmerCrops : masterCrops);
      return;
    }

    const seasons = plot.seasons || [];
    const activeSeasons = seasons.filter(s => s.status === 'Active');
    const targetSeasons = activeSeasons.length > 0 ? activeSeasons : seasons;

    const plotCropIds = setOfIds(targetSeasons.map(s => s.crop?.id || s.crop));
    const filtered = masterCrops.filter(c => plotCropIds.has(String(c.id)));
    
    setAvailableCrops(filtered.length > 0 ? filtered : []);

    if (targetSeasons.length > 0) {
      const activeSeason = targetSeasons[0];
      if (activeSeason?.crop) {
        const cropId = activeSeason.crop.id || activeSeason.crop;
        setSelectedCrop(cropId);
        if (activeSeason.current_stage) {
          setSelectedStage(activeSeason.current_stage.id || activeSeason.current_stage);
        }
      }
    } else {
      setSelectedCrop('');
      setSelectedStage('');
    }
  };

  const setOfIds = (arr) => new Set(arr.filter(Boolean).map(x => String(x)));

  const handlePlotChange = (plotId) => {
    setSelectedPlotId(plotId);
    if (!plotId) {
      updateCropsForPlot(null, allCrops);
      return;
    }
    const targetPlot = farmerPlots.find(p => p.id === plotId);
    if (targetPlot) {
      updateCropsForPlot(targetPlot, allCrops);
    }
  };

  // Load Growth Stages specific to selectedCrop
  useEffect(() => {
    async function loadCropStages() {
      if (!selectedCrop) {
        setStages([]);
        setSelectedStage('');
        return;
      }
      try {
        const res = await api.getCropStages({ crop: selectedCrop, crop_id: selectedCrop });
        const stgs = Array.isArray(res) ? res : (res.results || []);
        setStages(stgs);
        if (stgs.length > 0 && !selectedStage) {
          setSelectedStage(stgs[0].id);
        }
      } catch (err) {
        console.error("Failed loading crop stages:", err);
        setStages([]);
        setSelectedStage('');
      }
    }
    loadCropStages();
  }, [selectedCrop]);

  const handleCropChange = (cropId) => {
    setSelectedCrop(cropId);
    setSelectedStage('');
  };

  const fetchAiSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const res = await api.getAiRecommendationSuggestions({
        farmer_id: farmer?.id,
        crop_id: selectedCrop,
        stage_id: selectedStage
      });
      setSuggestions(res || []);
    } catch (err) {
      console.error("AI Suggestions error:", err);
    }
    setLoadingSuggestions(false);
  };

  useEffect(() => {
    if (farmer?.id || selectedCrop) {
      fetchAiSuggestions();
    }
  }, [selectedCrop, selectedStage]);

  const applySuggestion = (sugg) => {
    if (sugg.product_id) setSelectedProduct(sugg.product_id);
    setProductName(sugg.product_name);
    setDose(sugg.dose ? sugg.dose.split(' ')[0] : '2.5');
    setDoseUnit(sugg.dose_unit || 'ml/L');
    setTiming(sugg.timing || 'Early Morning');
    setApplicationMethod(sugg.application_method || 'Foliar Spray');
    setNotes(sugg.notes || '');
  };

  const handleSaveRecommendation = async (channel = 'Internal') => {
    if (!farmer?.id) {
      setError("No farmer selected");
      return;
    }
    if (!selectedCrop) {
      setError("Please select a crop");
      return;
    }

    setLoading(true);
    setError(null);

    const targetChannel = channel === 'WhatsApp' ? 'WhatsApp' : channel === 'SMS' ? 'SMS' : 'Internal';
    const doseVal = String(dose || '2.5');
    const noteText = notes || `Apply ${productName || 'Dhanashree Product'} at ${doseVal} ${doseUnit} via ${applicationMethod}`;

    const payload = {
      farmer: farmer.id,
      plot: selectedPlotId || null,
      crop: selectedCrop,
      stage: selectedStage || null,
      growth_stage: selectedStage || null,
      product: selectedProduct || null,
      product_name: productName || 'General Recommendation',
      dose: doseVal,
      dosage: `${doseVal} ${doseUnit}`,
      dose_unit: doseUnit || 'ml/L',
      timing,
      application_method: applicationMethod,
      notes: noteText,
      recommendation_text: noteText,
      priority,
      channel: targetChannel
    };

    try {
      const rec = await api.createRecommendation(payload);

      let msgNotice = '';
      if (channel === 'WhatsApp') {
        await api.sendRecommendationWhatsApp(rec.id).catch(err => {
          msgNotice = ` (WhatsApp send info: ${err.detail || err.error || 'Saved internally'})`;
        });
      } else if (channel === 'SMS') {
        await api.sendRecommendationSms(rec.id).catch(err => {
          msgNotice = ` (SMS send info: ${err.detail || err.error || 'Saved internally'})`;
        });
      }

      if (msgNotice) {
        alert(`Recommendation saved internally!${msgNotice}`);
      }

      if (onSuccess) onSuccess(rec);
      onClose();
    } catch (err) {
      console.error("Save recommendation error:", err);
      const errMsg = err.error || err.detail || (typeof err === 'string' ? err : JSON.stringify(err));
      setError(errMsg || "Failed to save recommendation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
              <Award size={22} />
            </div>
            <div>
              <h3 className="text-lg font-heading font-bold text-text">AgriAmigo Advisory Recommendation</h3>
              <p className="text-xs text-text-muted">Farmer: <span className="font-semibold text-emerald-950 font-bold">{farmer?.full_name}</span> ({farmer?.village || 'No Village'} • Mobile: {farmer?.primary_mobile || 'N/A'})</p>
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

        {/* Farmer Plots / No Plot Prompt */}
        {farmerPlots.length === 0 ? (
          <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <AlertTriangle size={18} className="text-amber-600 shrink-0" />
              <span>No plot or active crop season defined for {farmer?.full_name}.</span>
            </div>
            <p className="text-text-muted text-xs">A registered plot and crop season are required to generate plot-specific advisory recommendations.</p>
            {onCreatePlot && farmer && (
              <button
                type="button"
                onClick={() => onCreatePlot(farmer)}
                className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-md"
              >
                + Create Plot & Crop Season for {farmer.full_name}
              </button>
            )}
          </div>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-950">📍 Registered Plots ({farmerPlots.length}): </span>
            <span className="text-text-muted font-medium">Select a plot below to filter associated crops & stages</span>
          </div>
        )}

        {/* AI Suggestions Box */}
        <div className="p-4 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-heading font-bold text-amber-900">
              <Sparkles size={16} className="text-amber-600 animate-pulse" />
              <span>AI Recommendation Engine Suggestions</span>
            </div>
            <button
              type="button"
              onClick={fetchAiSuggestions}
              className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 underline"
            >
              Refresh Suggestions
            </button>
          </div>

          {loadingSuggestions ? (
            <div className="flex items-center gap-2 text-xs text-amber-800 py-2">
              <Loader2 size={14} className="animate-spin text-amber-600" />
              <span>Evaluating weather, soil, growth stage, and org historical success data...</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {suggestions.map((s, idx) => (
                <div
                  key={idx}
                  onClick={() => applySuggestion(s)}
                  className="p-3 bg-surface border border-amber-200/80 hover:border-amber-500/50 rounded-xl cursor-pointer transition-all shadow-sm hover:shadow-md flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-heading font-bold text-text">{s.product_name}</span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
                        {s.confidence_score}% Confidence
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">{s.recommendation_reason}</p>
                  </div>
                  <button type="button" className="px-3 py-1 bg-amber-600 text-white rounded-lg text-[11px] font-bold shrink-0">
                    Apply
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manual Recommendation Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-semibold text-text">
          <div>
            <label className="block mb-1">Select Plot</label>
            <select
              value={selectedPlotId}
              onChange={(e) => handlePlotChange(e.target.value)}
              className="w-full px-3 py-2 bg-bg border border-border rounded-xl font-medium text-text outline-none"
            >
              <option value="">-- All Plots --</option>
              {farmerPlots.map(p => (
                <option key={p.id} value={p.id}>{p.plot_name} ({p.area_acres || 0} acres)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1">Crop</label>
            <select
              value={selectedCrop}
              onChange={(e) => handleCropChange(e.target.value)}
              className="w-full px-3 py-2 bg-bg border border-border rounded-xl font-medium text-text outline-none"
            >
              <option value="">-- Select Crop --</option>
              {availableCrops.map(c => (
                <option key={c.id} value={c.id}>{c.crop_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1">Growth Stage</label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full px-3 py-2 bg-bg border border-border rounded-xl font-medium text-text outline-none"
            >
              <option value="">-- Select Stage --</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.stage_name}</option>
              ))}
            </select>
          </div>
        </div>


        <div className="grid grid-cols-3 gap-3 text-xs font-semibold text-text">
          <div className="col-span-2">
            <label className="block mb-1">Product</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Dhanashree Growth Booster"
              className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-text outline-none"
            />
          </div>
          <div>
            <label className="block mb-1">Dose & Unit</label>
            <div className="flex gap-1">
              <input
                type="text"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                className="w-full px-2 py-2 bg-bg border border-border rounded-xl text-text outline-none"
              />
              <select
                value={doseUnit}
                onChange={(e) => setDoseUnit(e.target.value)}
                className="px-2 py-2 bg-bg border border-border rounded-xl text-text outline-none text-[11px]"
              >
                <option value="ml/L">ml/L</option>
                <option value="g/L">g/L</option>
                <option value="kg/acre">kg/acre</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-text">
          <div>
            <label className="block mb-1">Application Method</label>
            <select
              value={applicationMethod}
              onChange={(e) => setApplicationMethod(e.target.value)}
              className="w-full px-3 py-2 bg-bg border border-border rounded-xl font-medium text-text outline-none"
            >
              <option value="Foliar Spray">Foliar Spray</option>
              <option value="Drenching">Drenching</option>
              <option value="Drip Irrigation">Drip Irrigation</option>
              <option value="Soil Application">Soil Application</option>
            </select>
          </div>
          <div>
            <label className="block mb-1">Timing</label>
            <select
              value={timing}
              onChange={(e) => setTiming(e.target.value)}
              className="w-full px-3 py-2 bg-bg border border-border rounded-xl font-medium text-text outline-none"
            >
              <option value="Early Morning">Early Morning</option>
              <option value="Late Evening">Late Evening</option>
              <option value="Post-Rainfall">Post-Rainfall</option>
              <option value="Weekly Interval">Weekly Interval</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-border flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-border text-text-muted hover:bg-bg rounded-xl text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSaveRecommendation('Internal')}
            className="px-4 py-2 bg-bg border border-border text-text hover:bg-surface rounded-xl text-xs font-semibold shadow-sm"
          >
            Save Internal
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSaveRecommendation('SMS')}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-md"
          >
            <Send size={14} />
            <span>Send SMS</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSaveRecommendation('WhatsApp')}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 shadow-md"
          >
            <MessageSquare size={14} />
            <span>Send WhatsApp</span>
          </button>
        </div>

      </div>
    </div>
  );
}
