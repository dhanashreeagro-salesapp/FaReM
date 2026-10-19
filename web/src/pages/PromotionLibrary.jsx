import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, X, Edit2, Trash2, Search, Upload, ExternalLink, Check, Sparkles, Filter, RotateCcw } from 'lucide-react';
import ImportWizard from '../components/ImportWizard';

const GENERIC_STAGES = [
  'Germination',
  'Vegetative Stage',
  'Flowering Stage',
  'Fruit Setting',
  'Fruit Development',
  'Fruit Maturity',
  'Harvesting'
];

export default function PromotionLibrary() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter states
  const [selectedCrop, setSelectedCrop] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  
  // Masters for dropdowns
  const [crops, setCrops] = useState([]);
  const [stages, setStages] = useState([]);
  const [products, setProducts] = useState([]);

  const categories = ['Product', 'Tagline', 'WhatsApp', 'Facebook', 'Instagram', 'LinkedIn', 'Schedule', 'Testimonial', 'YouTube Playlist'];

  const [form, setForm] = useState({ 
    title: '', 
    content_type: 'Image', 
    category: 'Product',
    file_url: '', 
    language_tags: ['English'], 
    expiry_date: '',
    crops: [],
    stages: [],
    target_stages: [],
    related_products: []
  });

  // Stages filtered to selected crops (if any crops are selected)
  const availableCropStages = form.crops.length > 0 
    ? stages.filter(s => form.crops.includes(s.crop))
    : stages;

  const fetchPromos = async () => {
    try {
      const data = await api.getPromotions();
      setPromos(Array.isArray(data) ? data : data.results || []);
    } catch { setPromos([]); }
    setLoading(false);
  };

  const fetchMasters = async () => {
    try {
      const [cropsData, stagesData, productsData] = await Promise.all([
        api.getCrops(),
        api.request('/crop-stages/'), 
        api.getProducts()
      ]);
      setCrops(Array.isArray(cropsData) ? cropsData : cropsData.results || []);
      setStages(Array.isArray(stagesData) ? stagesData : stagesData.results || []);
      setProducts(Array.isArray(productsData) ? productsData : productsData.results || []);
    } catch (err) { console.error('Failed to fetch masters', err); }
  };

  useEffect(() => { 
    fetchPromos(); 
    fetchMasters();
  }, []);

  const resetForm = () => {
    setForm({
      title: '',
      content_type: 'Image',
      category: 'Product',
      file_url: '',
      language_tags: ['English'],
      expiry_date: '',
      crops: [],
      stages: [],
      target_stages: [],
      related_products: []
    });
    setEditingPromo(null);
  };

  const toggleGenericStage = (stageName) => {
    setForm(prev => {
      const exists = prev.target_stages.includes(stageName);
      return {
        ...prev,
        target_stages: exists
          ? prev.target_stages.filter(s => s !== stageName)
          : [...prev.target_stages, stageName]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: form.title,
        content_type: form.content_type,
        category: form.category,
        file_url: form.file_url,
        language_tags: form.language_tags,
        expiry_date: form.expiry_date || null,
        crops: form.crops,
        stages: form.stages,
        target_stages: form.target_stages,
        related_products: form.related_products
      };

      if (editingPromo) {
        await api.updatePromotion(editingPromo.id, payload);
      } else {
        await api.createPromotion(payload);
      }
      
      setShowForm(false);
      resetForm();
      fetchPromos();
    } catch (err) { alert(err.error || 'Failed to save'); }
  };

  const handleEdit = (promo) => {
    setEditingPromo(promo);
    setForm({
      title: promo.title,
      content_type: promo.content_type,
      category: promo.category || 'Product',
      file_url: promo.file_url,
      language_tags: promo.language_tags || ['English'],
      expiry_date: promo.expiry_date || '',
      crops: promo.crops || (promo.crop ? [promo.crop] : []),
      stages: promo.stages || (promo.stage ? [promo.stage] : []),
      target_stages: promo.target_stages || [],
      related_products: promo.related_products || []
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this content?')) return;
    try {
      await api.deletePromotion(id);
      fetchPromos();
    } catch { /* handled */ }
  };

  const availableFilterStages = selectedCrop && selectedCrop !== '__general__'
    ? stages.filter(s => s.crop === selectedCrop)
    : stages;

  const hasActiveFilters = Boolean(
    searchTerm || selectedCrop || selectedStage || selectedProduct || selectedCategory || selectedType
  );

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCrop('');
    setSelectedStage('');
    setSelectedProduct('');
    setSelectedCategory('');
    setSelectedType('');
  };

  const filteredPromos = promos.filter(p => {
    // 1. Text Search
    if (searchTerm) {
      const low = searchTerm.toLowerCase();
      const matchTitle = (p.title || '').toLowerCase().includes(low);
      const matchCat = (p.category || '').toLowerCase().includes(low);
      const matchType = (p.content_type || '').toLowerCase().includes(low);
      const matchCrops = (p.crop_names && p.crop_names.some(c => c.toLowerCase().includes(low))) || (p.crop_name || '').toLowerCase().includes(low);
      const matchStages = (p.stage_names && p.stage_names.some(s => s.toLowerCase().includes(low))) || (p.stage_name || '').toLowerCase().includes(low);
      const matchGenericStages = (p.target_stages && p.target_stages.some(s => s.toLowerCase().includes(low)));
      const matchProds = (p.product_names && p.product_names.some(n => n.toLowerCase().includes(low)));
      if (!matchTitle && !matchCat && !matchType && !matchCrops && !matchStages && !matchGenericStages && !matchProds) {
        return false;
      }
    }

    // 2. Crop Filter
    if (selectedCrop) {
      if (selectedCrop === '__general__') {
        const isGeneral = (!p.crops || p.crops.length === 0) && !p.crop;
        if (!isGeneral) return false;
      } else {
        const hasCropId = (p.crops && p.crops.includes(selectedCrop)) || (p.crop === selectedCrop);
        const cropObj = crops.find(c => c.id === selectedCrop);
        const cropName = cropObj ? cropObj.crop_name.toLowerCase() : '';
        const hasCropName = cropName && (
          (p.crop_names && p.crop_names.some(c => c.toLowerCase() === cropName)) ||
          (p.crop_name && p.crop_name.toLowerCase() === cropName)
        );
        const isGeneral = (!p.crops || p.crops.length === 0) && !p.crop;
        if (!hasCropId && !hasCropName && !isGeneral) {
          return false;
        }
      }
    }

    // 3. Stage Filter
    if (selectedStage) {
      const sLow = selectedStage.toLowerCase();
      const matchesTargetStage = p.target_stages && p.target_stages.some(s => s.toLowerCase() === sLow || sLow.includes(s.toLowerCase()) || s.toLowerCase().includes(sLow));
      const matchesStageId = (p.stages && p.stages.includes(selectedStage)) || (p.stage === selectedStage);
      const matchesStageName = (p.stage_names && p.stage_names.some(s => s.toLowerCase() === sLow || sLow.includes(s.toLowerCase()))) || 
                               (p.stage_name && (p.stage_name.toLowerCase() === sLow || sLow.includes(p.stage_name.toLowerCase())));
      if (!matchesTargetStage && !matchesStageId && !matchesStageName) {
        return false;
      }
    }

    // 4. Product Filter
    if (selectedProduct) {
      const hasProdId = p.related_products && p.related_products.includes(selectedProduct);
      const prodObj = products.find(pr => pr.id === selectedProduct);
      const prodName = prodObj ? prodObj.name.toLowerCase() : '';
      const hasProdName = prodName && p.product_names && p.product_names.some(n => n.toLowerCase() === prodName);
      if (!hasProdId && !hasProdName) {
        return false;
      }
    }

    // 5. Category Filter
    if (selectedCategory) {
      if ((p.category || '').toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
    }

    // 6. Content Type Filter
    if (selectedType) {
      if ((p.content_type || '').toLowerCase() !== selectedType.toLowerCase()) {
        return false;
      }
    }

    return true;
  });

  const typeIcons = { Video: '🎬', Image: '🖼️', PDF: '📄', Link: '🔗' };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-heading font-bold text-text">Promotion Library</h2>
          <p className="text-xs text-text-muted mt-0.5">Manage promotional and technical advisory content across crops and growth stages.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors btn-press"
          >
            <Upload size={16} /> Bulk Import
          </button>
          <button onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors btn-press">
            <Plus size={16} /> Add Content
          </button>
        </div>
      </div>

      {showWizard && (
        <ImportWizard 
          resource="promotions"
          onClose={() => setShowWizard(false)}
          onComplete={fetchPromos}
        />
      )}

      {showForm && (
        <div className="card p-6 mb-6 animate-stagger-in border-2 border-primary/20">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-heading font-semibold text-text">{editingPromo ? 'Edit Content' : 'New Content Item'}</h3>
            <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-text-muted mb-1">Title*</label>
              <input placeholder="Content Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" required />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Content Type</label>
              <select value={form.content_type} onChange={e => setForm({...form, content_type: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none">
                <option value="Image">Image</option><option value="Video">Video</option>
                <option value="PDF">PDF</option><option value="Link">Link</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Category</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-text-muted mb-1">File/Content URL*</label>
              <input placeholder="https://..." value={form.file_url} onChange={e => setForm({...form, file_url: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface font-mono focus:ring-2 focus:ring-primary focus:outline-none" required />
            </div>

            {/* Target Crops (Multi-select) */}
            <div className="col-span-2">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-text-muted">
                  Target Crops (Hold Ctrl/Cmd to select multiple)
                </label>
                {form.crops.length > 0 ? (
                  <button 
                    type="button" 
                    onClick={() => setForm({...form, crops: [], stages: []})}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Clear selection (Apply to All Crops)
                  </button>
                ) : (
                  <span className="text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                    Currently applies to All Crops / General
                  </span>
                )}
              </div>
              <select 
                multiple
                value={form.crops} 
                onChange={e => {
                  const values = Array.from(e.target.selectedOptions, option => option.value);
                  setForm({...form, crops: values});
                }}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
                size={4}
              >
                {crops.map(c => <option key={c.id} value={c.id}>{c.crop_name}</option>)}
              </select>
            </div>

            {/* Generic Stages (Irrespective of crops) */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-text-muted mb-1 flex items-center gap-1.5">
                <Sparkles size={13} className="text-primary" />
                Growth Stages (Irrespective of crop)
              </label>
              <p className="text-[11px] text-text-muted mb-2">Click to tag common growth stages that this content applies to:</p>
              <div className="flex flex-wrap gap-1.5">
                {GENERIC_STAGES.map(sName => {
                  const isSelected = form.target_stages.includes(sName);
                  return (
                    <button
                      key={sName}
                      type="button"
                      onClick={() => toggleGenericStage(sName)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 ${
                        isSelected 
                          ? 'bg-primary text-white border-primary shadow-sm' 
                          : 'bg-surface text-text hover:bg-bg border-border'
                      }`}
                    >
                      {isSelected && <Check size={12} />}
                      {sName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Crop-Specific Stages (if crops selected) */}
            {form.crops.length > 0 && availableCropStages.length > 0 && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  Crop-Specific Stages (Optional — Hold Ctrl/Cmd to select multiple)
                </label>
                <select 
                  multiple
                  value={form.stages} 
                  onChange={e => {
                    const values = Array.from(e.target.selectedOptions, option => option.value);
                    setForm({...form, stages: values});
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
                  size={4}
                >
                  {availableCropStages.map(s => {
                    const cropObj = crops.find(c => c.id === s.crop);
                    return (
                      <option key={s.id} value={s.id}>
                        {cropObj ? `[${cropObj.crop_name}] ` : ''}{s.stage_name}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Related Products */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-text-muted mb-1">Related Products (Hold Ctrl/Cmd to select multiple)</label>
              <select 
                multiple
                value={form.related_products} 
                onChange={e => {
                  const values = Array.from(e.target.selectedOptions, option => option.value);
                  setForm({...form, related_products: values});
                }}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
                size={3}
              >
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Expiry Date</label>
              <input type="date" value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>

            <div className="flex justify-end items-end col-span-2 gap-3 mt-4">
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 rounded-lg font-medium text-sm text-text-muted border border-border hover:bg-surface">Cancel</button>
              <button type="submit" className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors btn-press shadow-md">
                {editingPromo ? 'Update Content' : 'Create Content'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search and Filters Toolbar */}
      <div className="card p-4 mb-6 shadow-sm border border-border">
        {/* Search Input Row */}
        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input 
            type="text" 
            placeholder="Search promotion titles, crops, stages, products, categories..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-8 py-2.5 border border-border rounded-lg text-sm bg-surface focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none transition-all"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 items-center">
          {/* Crop Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-text-muted mb-1">Crop</label>
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-border rounded-lg text-xs bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="">All Crops</option>
              <option value="__general__">🌐 Universal / All Crops</option>
              {crops.length > 0 && (
                <optgroup label="Specific Crops">
                  {crops.map(c => (
                    <option key={c.id} value={c.id}>{c.crop_name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Growth Stage Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-text-muted mb-1">Growth Stage</label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-border rounded-lg text-xs bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="">All Stages</option>
              <optgroup label="Generic Stages (Any Crop)">
                {GENERIC_STAGES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </optgroup>
              {availableFilterStages.length > 0 && (
                <optgroup label={selectedCrop && selectedCrop !== '__general__' ? "Crop Stages" : "All Crop Stages"}>
                  {availableFilterStages.map(s => {
                    const cropObj = crops.find(c => c.id === s.crop);
                    return (
                      <option key={s.id} value={s.stage_name}>
                        {cropObj ? `[${cropObj.crop_name}] ` : ''}{s.stage_name}
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </select>
          </div>

          {/* Product Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-text-muted mb-1">Product</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-border rounded-lg text-xs bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="">All Products</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-text-muted mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-border rounded-lg text-xs bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Content Type Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-text-muted mb-1">Content Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-border rounded-lg text-xs bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="Image">🖼️ Image</option>
              <option value="Video">🎬 Video</option>
              <option value="PDF">📄 PDF</option>
              <option value="Link">🔗 Link</option>
            </select>
          </div>
        </div>

        {/* Filter Summary & Reset Bar */}
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/60 text-xs">
          <div className="flex items-center gap-2 text-text-muted">
            <span className="font-medium text-text">
              Showing {filteredPromos.length} of {promos.length} items
            </span>
            {hasActiveFilters && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[11px] px-2 py-0.5 rounded-full font-medium">
                <Filter size={11} /> Filters Active
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-primary hover:text-primary-dark font-medium hover:underline text-xs"
            >
              <RotateCcw size={12} /> Reset all filters
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 card p-12 text-center text-text-muted">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
            <p>Loading library...</p>
          </div>
        ) : filteredPromos.length === 0 ? (
          <div className="col-span-3 card p-12 text-center text-text-muted border-dashed border-2">No content found matching your search.</div>
        ) : filteredPromos.map((promo, i) => (
          <div key={promo.id} className="card group overflow-hidden border border-border hover:border-primary/30 transition-all p-0 flex flex-col animate-stagger-in shadow-sm hover:shadow-md" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="p-5 flex-1">
              <div className="flex justify-between items-start mb-3">
                <span className="text-3xl bg-surface rounded-lg p-2 shadow-sm">{typeIcons[promo.content_type] || '📎'}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-surface rounded-lg p-1 shadow-sm">
                  <button onClick={() => handleEdit(promo)} className="p-1.5 text-text-muted hover:text-primary transition-colors"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(promo.id)} className="p-1.5 text-text-muted hover:text-danger transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
              
              <h4 className="font-heading font-bold text-text mb-1 line-clamp-2" title={promo.title}>{promo.title}</h4>
              
              <a 
                href={promo.file_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-xs text-primary hover:underline flex items-center gap-1 mb-4 w-fit"
              >
                {promo.file_url.length > 35 ? promo.file_url.substring(0, 35) + '...' : promo.file_url}
                <ExternalLink size={12} />
              </a>

              <div className="flex flex-wrap gap-1.5 mt-auto">
                <span className="badge bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-100">{promo.content_type}</span>
                {promo.category && <span className="badge bg-indigo-50 text-indigo-700 text-[10px] font-medium border border-indigo-100">🏷️ {promo.category}</span>}
                
                {/* Crops */}
                {promo.crop_names && promo.crop_names.length > 0 ? (
                  promo.crop_names.map((cn, idx) => (
                    <span key={idx} className="badge bg-green-50 text-green-700 text-[10px] border border-green-100">🌱 {cn}</span>
                  ))
                ) : promo.crop_name ? (
                  <span className="badge bg-green-50 text-green-700 text-[10px] border border-green-100">🌱 {promo.crop_name}</span>
                ) : (
                  <span className="badge bg-emerald-50 text-emerald-700 text-[10px] border border-emerald-100">🌱 All Crops</span>
                )}

                {/* Stages (Crop stages & Generic stages) */}
                {promo.stage_names && promo.stage_names.length > 0 && promo.stage_names.map((sn, idx) => (
                  <span key={`sn-${idx}`} className="badge bg-amber-50 text-amber-700 text-[10px] border border-amber-100">📅 {sn}</span>
                ))}
                {promo.target_stages && promo.target_stages.length > 0 && promo.target_stages.map((ts, idx) => (
                  <span key={`ts-${idx}`} className="badge bg-amber-100/70 text-amber-800 text-[10px] border border-amber-200">✨ {ts}</span>
                ))}
                {!promo.stage_names?.length && !promo.target_stages?.length && promo.stage_name && (
                  <span className="badge bg-amber-50 text-amber-700 text-[10px] border border-amber-100">📅 {promo.stage_name}</span>
                )}

                {/* Products */}
                {promo.product_names && promo.product_names.map((pn, idx) => (
                  <span key={idx} className="badge bg-purple-50 text-purple-700 text-[10px] font-medium border border-purple-100">📦 {pn}</span>
                ))}
                
                <span className={`badge text-[10px] ${promo.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>{promo.status}</span>
              </div>
            </div>
            
            {promo.expiry_date && (
              <div className="bg-surface px-5 py-2.5 border-t border-border text-[11px] text-text-muted flex justify-between items-center">
                <span>Expires on</span>
                <span className="font-semibold text-text">{new Date(promo.expiry_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
