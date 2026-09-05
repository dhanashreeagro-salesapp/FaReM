import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, X, Edit2, Trash2, Search, Upload, ExternalLink } from 'lucide-react';
import ImportWizard from '../components/ImportWizard';

export default function PromotionLibrary() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
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
    crop: '',
    stage: '',
    related_products: []
  });

  // Derived filtered stages
  const filteredStages = stages.filter(s => s.crop === form.crop);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (!payload.expiry_date) delete payload.expiry_date;
      if (!payload.crop) payload.crop = null;
      if (!payload.stage) payload.stage = null;

      if (editingPromo) {
        await api.updatePromotion(editingPromo.id, payload);
      } else {
        await api.createPromotion(payload);
      }
      
      setShowForm(false);
      setEditingPromo(null);
      setForm({ title: '', content_type: 'Image', category: 'Product', file_url: '', language_tags: ['English'], expiry_date: '', crop: '', stage: '', related_products: [] });
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
      crop: promo.crop || '',
      stage: promo.stage || '',
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

  const filteredPromos = promos.filter(p => {
    const lowSearch = searchTerm.toLowerCase();
    return (
      (p.title || '').toLowerCase().includes(lowSearch) ||
      (p.category || '').toLowerCase().includes(lowSearch) ||
      (p.content_type || '').toLowerCase().includes(lowSearch) ||
      (p.product_names && p.product_names.some(n => n.toLowerCase().includes(lowSearch))) ||
      (p.crop_name || '').toLowerCase().includes(lowSearch) ||
      (p.stage_name || '').toLowerCase().includes(lowSearch)
    );
  });

  const typeIcons = { Video: '🎬', Image: '🖼️', PDF: '📄', Link: '🔗' };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-heading font-bold text-text">Promotion Library</h2>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors btn-press"
          >
            <Upload size={16} /> Bulk Import
          </button>
          <button onClick={() => {
            setEditingPromo(null);
            setForm({ title: '', content_type: 'Image', category: 'Product', file_url: '', language_tags: ['English'], expiry_date: '', crop: '', stage: '', related_products: [] });
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

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-text-muted mb-1">Products (Hold Ctrl/Cmd to select multiple)</label>
              <select 
                multiple
                value={form.related_products} 
                onChange={e => {
                  const values = Array.from(e.target.selectedOptions, option => option.value);
                  setForm({...form, related_products: values});
                }}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
                size={4}
              >
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Crop (Optional)</label>
              <select 
                value={form.crop} 
                onChange={e => setForm({...form, crop: e.target.value, stage: ''})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface"
              >
                <option value="">-- Select Crop --</option>
                {crops.map(c => <option key={c.id} value={c.id}>{c.crop_name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Stage (Optional)</label>
              <select 
                value={form.stage} 
                onChange={e => setForm({...form, stage: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface"
                disabled={!form.crop}
              >
                <option value="">-- Select Stage --</option>
                {filteredStages.map(s => <option key={s.id} value={s.id}>{s.stage_name}</option>)}
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

      {/* Global Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input 
          type="text" 
          placeholder="Search by title, product, crop, stage, category or type..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-sm bg-white shadow-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all"
        />
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

              <div className="flex flex-wrap gap-2 mt-auto">
                <span className="badge bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-100">{promo.content_type}</span>
                {promo.category && <span className="badge bg-indigo-50 text-indigo-700 text-[10px] font-medium border border-indigo-100">🏷️ {promo.category}</span>}
                {promo.product_names && promo.product_names.map((pn, idx) => (
                  <span key={idx} className="badge bg-purple-50 text-purple-700 text-[10px] font-medium border border-purple-100">📦 {pn}</span>
                ))}
                {promo.crop_name && <span className="badge bg-green-50 text-green-700 text-[10px] border border-green-100">🌱 {promo.crop_name}</span>}
                {promo.stage_name && <span className="badge bg-amber-50 text-amber-700 text-[10px] border border-amber-100">📅 {promo.stage_name}</span>}
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
