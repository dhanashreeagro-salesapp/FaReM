import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { offlineQueue } from '../utils/offlineQueue';
import { Sparkles, Award, Send, MessageSquare, CheckCircle2, AlertTriangle, X, Loader2, Info } from 'lucide-react';

export default function RecommendationModal({ farmer, onClose, onSuccess }) {
  const [crops, setCrops] = useState([]);
  const [stages, setStages] = useState([]);
  const [products, setProducts] = useState([]);

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
  const [showPreview, setShowPreview] = useState(false);
  const [previewChannel, setPreviewChannel] = useState('WhatsApp');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [cList, pList] = await Promise.all([
          api.getCrops(),
          api.getProducts()
        ]);
        const crps = cList.results || cList || [];
        const prods = pList.results || pList || [];
        setCrops(crps);
        setProducts(prods);

        if (crps.length > 0) {
          setSelectedCrop(crps[0].id);
          const stgsRes = await api.getCropStages({ crop_id: crps[0].id });
          const stgs = stgsRes.results || stgsRes || [];
          setStages(stgs);
          if (stgs.length > 0) setSelectedStage(stgs[0].id);
        }
      } catch (err) {
        console.error("Failed loading options:", err);
      }
    }
    loadData();
  }, []);

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
    setDose(sugg.dose.split(' ')[0] || '2.5');
    setDoseUnit(sugg.dose_unit || 'ml/L');
    setTiming(sugg.timing);
    setApplicationMethod(sugg.application_method);
    setNotes(sugg.notes);
  };

  const formattedWhatsAppContent = `Dear ${farmer?.full_name || 'Farmer'},

Recommended Product: ${productName || 'Dhanashree Growth Booster'}
Dose: ${dose} ${doseUnit}
Application Method: ${applicationMethod}
Timing: ${timing}
Notes: ${notes}

Regards,
Dhanashree Agro Team`;

  const handleSaveRecommendation = async (channel = 'Internal') => {
    if (!farmer) {
      setError("No farmer selected");
      return;
    }

    // Auto-fill product name if user selected a product dropdown or leave empty
    let pName = (productName || '').trim();
    if (!pName && selectedProduct) {
      const pObj = products.find(p => p.id === selectedProduct);
      if (pObj) pName = pObj.name;
    }
    if (!pName) {
      pName = "Dhanashree Growth Booster";
    }

    setLoading(true);
    setError(null);

    const payload = {
      farmer: farmer.id,
      crop: selectedCrop || null,
      stage: selectedStage || null,
      product: selectedProduct || null,
      product_name: pName,
      dose: String(dose || '2.5'),
      dose_unit: doseUnit || 'ml/L',
      timing: timing || 'Early Morning',
      application_method: applicationMethod || 'Foliar Spray',
      notes: notes || '',
      priority: priority || 'Normal',
      channel
    };

    try {
      if (!navigator.onLine) {
        offlineQueue.saveRecommendation(payload);
        alert("Offline mode: Recommendation saved locally and will auto-sync on reconnection!");
        if (onSuccess) onSuccess();
        onClose();
        return;
      }

      const rec = await api.createRecommendation(payload);

      let msgNotice = "";
      if (channel === 'WhatsApp' && rec?.id) {
        try {
          await api.sendRecommendationWhatsApp(rec.id, { content: formattedWhatsAppContent });
        } catch (wErr) {
          console.warn("WhatsApp dispatch notice:", wErr);
          msgNotice = " (WhatsApp integration pending; saved internally)";
        }
      } else if (channel === 'SMS' && rec?.id) {
        try {
          await api.sendRecommendationSms(rec.id, { content: formattedWhatsAppContent.slice(0, 160) });
        } catch (sErr) {
          console.warn("SMS dispatch notice:", sErr);
          msgNotice = " (SMS gateway pending; saved internally)";
        }
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
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Award size={22} />
            </div>
            <div>
              <h3 className="text-lg font-heading font-bold text-text">Create Advisory Recommendation</h3>
              <p className="text-xs text-text-muted">Farmer: {farmer?.full_name} ({farmer?.village || 'No Village'})</p>
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
        <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-text">
          <div>
            <label className="block mb-1">Crop</label>
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className="w-full px-3 py-2 bg-bg border border-border rounded-xl font-medium text-text outline-none"
            >
              <option value="">-- Select Crop --</option>
              {crops.map(c => (
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
