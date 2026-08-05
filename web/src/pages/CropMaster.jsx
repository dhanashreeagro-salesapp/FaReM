import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, X, ChevronDown, ChevronUp, Edit2, Trash2, Search, Upload } from 'lucide-react';

import { useAuth } from '../components/AuthProvider';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const HOST_BASE = API_BASE.replace('/api', '');

export default function CropMaster() {
  const { isAdmin } = useAuth();
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  
  // Crop UI State
  const [showForm, setShowForm] = useState(false);
  const [editingCrop, setEditingCrop] = useState(null);
  const [form, setForm] = useState({ crop_name: '', crop_category: '', scientific_name: '' });
  const [imageFile, setImageFile] = useState(null);
  const [expandedCrop, setExpandedCrop] = useState(null);

  // Stage UI State
  const [stageForm, setStageForm] = useState({ crop: '', stage_name: '', sequence_number: 1, days_from_previous_stage: 0, stage_description: '' });
  const [showStageForm, setShowStageForm] = useState(null);
  const [editingStage, setEditingStage] = useState(null);

  // Variety UI State
  const [varietyForm, setVarietyForm] = useState({ crop: '', variety_name: '', typical_duration_days: '' });
  const [showVarietyForm, setShowVarietyForm] = useState(null);
  const [editingVariety, setEditingVariety] = useState(null);

  const fetchCrops = async () => {
    try {
      const data = await api.getCrops();
      setCrops(Array.isArray(data) ? data : data.results || []);
    } catch { setCrops([]); }
    setLoading(false);
  };

  useEffect(() => { fetchCrops(); }, []);

  // --- CROP handlers --- //
  const handleCreateOrUpdateCrop = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('crop_name', form.crop_name);
      formData.append('crop_category', form.crop_category);
      if (form.scientific_name) formData.append('scientific_name', form.scientific_name);
      if (imageFile) formData.append('reference_image', imageFile);

      if (editingCrop) {
        await api.updateCrop(editingCrop.id, formData);
      } else {
        await api.createCrop(formData);
      }

      setShowForm(false);
      setEditingCrop(null);
      setForm({ crop_name: '', crop_category: '', scientific_name: '' });
      setImageFile(null);
      fetchCrops();
    } catch (err) {
      alert(err.message || 'Failed to save crop');
    }
  };

  const handleEditCrop = (crop) => {
    setEditingCrop(crop);
    setForm({
      crop_name: crop.crop_name,
      crop_category: crop.crop_category,
      scientific_name: crop.scientific_name || ''
    });
    setImageFile(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCrop = async (crop) => {
    if (window.confirm(`Are you sure you want to delete crop "${crop.crop_name}"?`)) {
      try {
        await api.deleteCrop(crop.id);
        fetchCrops();
      } catch {
        alert('Failed to delete crop. Ensure there are no dependent fields.');
      }
    }
  };

  // --- STAGE handlers --- //
  const handleCreateOrUpdateStage = async (e) => {
    e.preventDefault();
    try {
      if (editingStage) {
        await api.updateStage(editingStage.id, stageForm);
      } else {
        await api.createStage(stageForm);
      }
      setShowStageForm(null);
      setEditingStage(null);
      fetchCrops();
    } catch { alert('Failed to save stage'); }
  };

  const handleEditStage = (stage, cropId) => {
    setEditingStage(stage);
    setStageForm({
      crop: cropId,
      stage_name: stage.stage_name,
      sequence_number: stage.sequence_number,
      days_from_previous_stage: stage.days_from_previous_stage,
      stage_description: stage.stage_description || ''
    });
    setShowStageForm(cropId);
  };

  const handleDeleteStage = async (stage) => {
    if (window.confirm(`Delete stage "${stage.stage_name}"?`)) {
      try {
        await api.deleteStage(stage.id);
        fetchCrops();
      } catch { alert('Failed to delete stage'); }
    }
  };

  const openNewStageForm = (cropId) => {
    setEditingStage(null);
    const existingStages = crops.find(c => c.id === cropId)?.stages || [];
    const nextSeq = existingStages.length > 0 ? Math.max(...existingStages.map(s => s.sequence_number)) + 1 : 1;
    setStageForm({ crop: cropId, stage_name: '', sequence_number: nextSeq, days_from_previous_stage: 0, stage_description: '' });
    setShowStageForm(cropId);
  };

  // --- VARIETY handlers --- //
  const handleCreateOrUpdateVariety = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...varietyForm };
      if (!payload.typical_duration_days) payload.typical_duration_days = null;
      if (editingVariety) {
        await api.updateVariety(editingVariety.id, payload);
      } else {
        await api.createVariety(payload);
      }
      setShowVarietyForm(null);
      setEditingVariety(null);
      fetchCrops();
    } catch { alert('Failed to save variety'); }
  };

  const handleEditVariety = (variety, cropId) => {
    setEditingVariety(variety);
    setVarietyForm({
      crop: cropId,
      variety_name: variety.variety_name,
      typical_duration_days: variety.typical_duration_days || ''
    });
    setShowVarietyForm(cropId);
  };

  const handleDeleteVariety = async (variety) => {
    if (window.confirm(`Delete variety "${variety.variety_name}"?`)) {
      try {
        await api.deleteVariety(variety.id);
        fetchCrops();
      } catch { alert('Failed to delete variety'); }
    }
  };

  const openNewVarietyForm = (cropId) => {
    setEditingVariety(null);
    setVarietyForm({ crop: cropId, variety_name: '', typical_duration_days: '' });
    setShowVarietyForm(cropId);
  };

  // Filtering
  const filteredCrops = crops.filter(c => 
    c.crop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.crop_category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.scientific_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-heading font-bold text-text">Crop Master Configuration</h2>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <input 
              type="text" 
              placeholder="Search crops..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none w-64"
            />
          </div>
          {isAdmin && (
            <button onClick={() => {
              setEditingCrop(null);
              setForm({ crop_name: '', crop_category: '', scientific_name: '' });
              setImageFile(null);
              setShowForm(!showForm);
            }}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors btn-press">
              <Plus size={16} /> Add Crop
            </button>
          )}
        </div>
      </div>

      {/* Main Crop Form */}
      {isAdmin && showForm && (
        <div className="card p-6 mb-6 animate-stagger-in border-2 border-primary/20">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-heading font-semibold text-text">{editingCrop ? `Edit Crop: ${editingCrop.crop_name}` : 'New Crop'}</h3>
            <button onClick={() => { setShowForm(false); setEditingCrop(null); }} className="text-text-muted hover:text-text"><X size={18} /></button>
          </div>
          <form onSubmit={handleCreateOrUpdateCrop} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="col-span-1 md:col-span-1">
              <label className="block text-xs font-semibold text-text-muted mb-1">Crop Name</label>
              <input placeholder="e.g. Wheat" value={form.crop_name} onChange={e => setForm({...form, crop_name: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" required />
            </div>
            <div className="col-span-1 md:col-span-1">
              <label className="block text-xs font-semibold text-text-muted mb-1">Category</label>
              <input placeholder="e.g. Cereal" value={form.crop_category} onChange={e => setForm({...form, crop_category: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" required />
            </div>
            <div className="col-span-1 md:col-span-1">
              <label className="block text-xs font-semibold text-text-muted mb-1">Scientific Name (Optional)</label>
              <input placeholder="e.g. Triticum" value={form.scientific_name} onChange={e => setForm({...form, scientific_name: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div className="col-span-1 md:col-span-1">
              <label className="block text-xs font-semibold text-text-muted mb-1">Crop Photo</label>
              <label className="flex items-center justify-center gap-2 w-full px-3 py-2 border border-dashed border-primary rounded-lg text-sm bg-surface cursor-pointer hover:bg-primary/5 text-primary transition-colors">
                <Upload size={16} />
                <span className="truncate">{imageFile ? imageFile.name : 'Upload File'}</span>
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="hidden" />
              </label>
            </div>
            <div className="col-span-1 md:col-span-4 flex justify-end gap-3 mt-2">
              {editingCrop && editingCrop.reference_image && (
                <div className="mr-auto flex items-center gap-2">
                  <span className="text-xs text-text-muted">Current photo:</span>
                  <img src={editingCrop.reference_image.startsWith('http') ? editingCrop.reference_image : `${HOST_BASE}${editingCrop.reference_image}`} alt="Preview" className="h-8 w-8 object-cover rounded" />
                </div>
              )}
              <button type="submit" className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-medium text-sm btn-press">
                {editingCrop ? 'Update Crop' : 'Save Crop'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Crop List */}
      <div className="space-y-3">
        {loading ? (
          <div className="card p-12 text-center text-text-muted">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
            <p>Loading crops...</p>
          </div>
        ) : filteredCrops.length === 0 ? (
          <div className="card p-12 text-center text-text-muted bg-bg/50 border-dashed">
            {searchQuery ? `No crops found matching "${searchQuery}"` : "No crops configured. Add your first crop above."}
          </div>
        ) : filteredCrops.map((crop, i) => (
          <div key={crop.id} className="card animate-stagger-in overflow-hidden shadow-sm hover:shadow-md transition-shadow" style={{ animationDelay: `${i * 30}ms` }}>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => setExpandedCrop(expandedCrop === crop.id ? null : crop.id)}>
                {crop.reference_image ? (
                  <img src={crop.reference_image.startsWith('http') ? crop.reference_image : `${HOST_BASE}${crop.reference_image}`} alt={crop.crop_name} className="w-12 h-12 rounded-lg object-cover border border-border" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center border border-green-100">
                    <span className="text-primary text-xl">🌾</span>
                  </div>
                )}
                <div>
                  <h3 className="font-heading font-semibold text-text">{crop.crop_name}</h3>
                  <p className="text-xs text-text-muted">{crop.scientific_name && <em>{crop.scientific_name}</em>} · {crop.crop_category}</p>
                </div>
              </div>

              <div className="flex items-center gap-5">
                <div className="flex gap-4 text-sm text-text-muted mr-4">
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-text">{crop.stages?.length || 0}</span>
                    <span className="text-[10px] uppercase">Stages</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-text">{crop.varieties?.length || 0}</span>
                    <span className="text-[10px] uppercase">Varieties</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2 border-r border-border pr-5">
                    <button onClick={(e) => { e.stopPropagation(); handleEditCrop(crop); }} className="p-1.5 text-text-muted hover:text-primary transition-colors tooltip" data-tip="Edit Crop">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCrop(crop); }} className="p-1.5 text-text-muted hover:text-danger transition-colors tooltip" data-tip="Delete Crop">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
                <button className="text-text-muted hover:text-primary transition-colors" onClick={() => setExpandedCrop(expandedCrop === crop.id ? null : crop.id)}>
                  {expandedCrop === crop.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>
            </div>

            {/* Expanded Content: Stages & Varieties */}
            {expandedCrop === crop.id && (
              <div className="border-t border-border px-5 py-5 bg-bg/50 grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Stages Section */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-heading font-semibold text-text uppercase tracking-wide flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary"></div> Growth Stages
                    </h4>
                    {isAdmin && (
                      <button onClick={() => openNewStageForm(crop.id)} className="text-xs text-primary hover:text-primary-dark font-medium px-2 py-1 bg-primary/10 rounded">
                        + Add Stage
                      </button>
                    )}
                  </div>


                  {showStageForm === crop.id && (
                    <form onSubmit={handleCreateOrUpdateStage} className="bg-surface border border-primary/30 p-3 rounded-lg mb-3 shadow-sm animate-stagger-in">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold">{editingStage ? 'Edit Stage' : 'New Stage'}</span>
                        <X size={14} className="cursor-pointer text-text-muted" onClick={() => {setShowStageForm(null); setEditingStage(null);}} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input placeholder="Stage Name" value={stageForm.stage_name} onChange={e => setStageForm({...stageForm, stage_name: e.target.value})}
                          className="px-2 py-1.5 border border-border rounded text-sm focus:ring-1 focus:ring-primary w-full" required />
                        <input type="number" placeholder="Seq #" value={stageForm.sequence_number} onChange={e => setStageForm({...stageForm, sequence_number: parseInt(e.target.value)})}
                          className="px-2 py-1.5 border border-border rounded text-sm focus:ring-1 focus:ring-primary w-full" required />
                        <input type="number" placeholder="Days from prev" value={stageForm.days_from_previous_stage} onChange={e => setStageForm({...stageForm, days_from_previous_stage: parseInt(e.target.value)})}
                          className="px-2 py-1.5 border border-border rounded text-sm focus:ring-1 focus:ring-primary w-full col-span-2" required />
                      </div>
                      <div className="flex justify-end">
                        <button type="submit" className="bg-primary text-white px-3 py-1.5 rounded text-xs font-medium w-full">{editingStage ? 'Update' : 'Save'}</button>
                      </div>
                    </form>
                  )}

                  {crop.stages?.length > 0 ? (
                    <div className="space-y-2">
                      {crop.stages.sort((a,b) => a.sequence_number - b.sequence_number).map(stage => (
                        <div key={stage.id} className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2 text-sm hover:border-primary/30 transition-colors group">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{stage.sequence_number}</span>
                            <span className="font-medium text-text">{stage.stage_name}</span>
                            <span className="text-text-muted text-xs bg-bg px-2 py-0.5 rounded-full">+{stage.days_from_previous_stage}d</span>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEditStage(stage, crop.id)} className="p-1 hover:text-primary"><Edit2 size={14}/></button>
                              <button onClick={() => handleDeleteStage(stage)} className="p-1 hover:text-danger"><Trash2 size={14}/></button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : !showStageForm && <p className="text-xs text-text-muted p-3 bg-surface rounded border border-dashed border-border">No stages configured yet.</p>}
                </div>

                {/* Varieties Section */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-heading font-semibold text-text uppercase tracking-wide flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Varieties
                    </h4>
                    {isAdmin && (
                      <button onClick={() => openNewVarietyForm(crop.id)} className="text-xs text-amber-700 hover:text-amber-900 font-medium px-2 py-1 bg-amber-100 rounded">
                        + Add Variety
                      </button>
                    )}
                  </div>


                  {showVarietyForm === crop.id && (
                    <form onSubmit={handleCreateOrUpdateVariety} className="bg-amber-50 border border-amber-200 p-3 rounded-lg mb-3 shadow-sm animate-stagger-in">
                      <div className="flex justify-between items-center mb-2 text-amber-900">
                        <span className="text-xs font-semibold">{editingVariety ? 'Edit Variety' : 'New Variety'}</span>
                        <X size={14} className="cursor-pointer" onClick={() => {setShowVarietyForm(null); setEditingVariety(null);}} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input placeholder="Variety Name" value={varietyForm.variety_name} onChange={e => setVarietyForm({...varietyForm, variety_name: e.target.value})}
                          className="px-2 py-1.5 border border-amber-200 rounded text-sm focus:ring-1 focus:ring-amber-500 w-full" required />
                        <input type="number" placeholder="Duration (days)" value={varietyForm.typical_duration_days} onChange={e => setVarietyForm({...varietyForm, typical_duration_days: e.target.value})}
                          className="px-2 py-1.5 border border-amber-200 rounded text-sm focus:ring-1 focus:ring-amber-500 w-full" />
                      </div>
                      <div className="flex justify-end">
                        <button type="submit" className="bg-amber-600 text-white px-3 py-1.5 rounded text-xs font-medium w-full">{editingVariety ? 'Update' : 'Save'}</button>
                      </div>
                    </form>
                  )}

                  {crop.varieties?.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {crop.varieties.map(v => (
                        <div key={v.id} className="flex items-center justify-between border border-border bg-surface px-3 py-2 rounded-lg group hover:border-amber-300 transition-colors">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-text">{v.variety_name}</span>
                            {v.typical_duration_days && <span className="text-xs text-text-muted">{v.typical_duration_days} days</span>}
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEditVariety(v, crop.id)} className="p-1 hover:text-amber-600"><Edit2 size={14}/></button>
                              <button onClick={() => handleDeleteVariety(v)} className="p-1 hover:text-danger"><Trash2 size={14}/></button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : !showVarietyForm && <p className="text-xs text-text-muted p-3 bg-surface rounded border border-dashed border-border">No varieties configured yet.</p>}
                </div>


              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
