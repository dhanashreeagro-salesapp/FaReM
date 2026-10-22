import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthProvider';
import { 
  Plus, X, Edit2, Trash2, Search, Upload, ExternalLink, Check, Sparkles, Filter, 
  RotateCcw, Eye, Send, Sprout, Package, Layers, Grid, ChevronRight, CheckCircle2,
  RefreshCw, FileText, Video as VideoIcon, Image as ImageIcon, Link as LinkIcon
} from 'lucide-react';
import ImportWizard from '../components/ImportWizard';
import PromotionPreviewModal from '../components/PromotionPreviewModal';
import PromotionFarmerSelectModal from '../components/PromotionFarmerSelectModal';
import SendMessageModal from '../components/SendMessageModal';
import { sortPromotionsByRelevance } from '../utils/relevanceSorting';
import { getPromotionsFromDB, savePromotionsToDB } from '../utils/db';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const HOST_BASE = API_BASE.replace('/api', '');

const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('data:image')) return path;
  const baseUrl = HOST_BASE.replace(/\/$/, "");
  const imagePath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${imagePath}`;
};

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
  const { user, isAdmin } = useAuth();
  const canManage = Boolean(isAdmin || user?.role === 'ADMIN' || user?.is_superuser);

  // Core data states
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);

  // Navigation tab states: 'all' | 'hierarchy'
  const [activeTab, setActiveTab] = useState('all');
  const [hierarchySubTab, setHierarchySubTab] = useState('crop'); // 'crop' | 'product'

  // Hierarchical browsing states
  const [activeCropId, setActiveCropId] = useState(null);
  const [activeCropStage, setActiveCropStage] = useState('');
  const [activeProductId, setActiveProductId] = useState(null);

  // Search & Filter states for "All Promotions"
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCrop, setSelectedCrop] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  
  // Masters for dropdowns & hierarchy
  const [crops, setCrops] = useState([]);
  const [stages, setStages] = useState([]);
  const [products, setProducts] = useState([]);
  const [userCropIds, setUserCropIds] = useState(new Set());

  // Modal interactions
  const [previewPromo, setPreviewPromo] = useState(null);
  const [farmerSelectPromo, setFarmerSelectPromo] = useState(null);
  const [whatsappModalData, setWhatsappModalData] = useState(null); // { farmerIds, initialData }

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

  // Stages filtered to selected crops in form
  const availableCropStages = form.crops.length > 0 
    ? stages.filter(s => form.crops.includes(s.crop))
    : stages;

  // Stale-While-Revalidate caching via IndexedDB
  const fetchPromos = async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);

    try {
      // 1. Try local cache first for instantaneous rendering (<10ms)
      const cached = await getPromotionsFromDB();
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setPromos(cached);
        setLoading(false);
      }
    } catch (e) {
      console.warn('IndexedDB read error:', e);
    }

    try {
      // 2. Fetch fresh from backend and update local DB
      const data = await api.getPromotions();
      const list = Array.isArray(data) ? data : data.results || [];
      setPromos(list);
      savePromotionsToDB(list).catch(() => {});
    } catch (err) {
      console.error('Failed to fetch promotions from API:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMasters = async () => {
    try {
      const [cropsData, stagesData, productsData, snapshotData] = await Promise.all([
        api.getCrops().catch(() => []),
        api.request('/crop-stages/').catch(() => []), 
        api.getProducts().catch(() => []),
        api.request('/market/snapshot/').catch(() => [])
      ]);

      const rawCrops = Array.isArray(cropsData) ? cropsData : cropsData.results || [];
      const rawStages = Array.isArray(stagesData) ? stagesData : stagesData.results || [];
      const rawProducts = Array.isArray(productsData) ? productsData : productsData.results || [];

      // Determine user-managed crops from Market Snapshot
      const userIds = new Set();
      if (Array.isArray(snapshotData) && snapshotData.length > 0) {
        snapshotData.forEach(item => {
          if (item.crop_id) userIds.add(item.crop_id);
        });
        setUserCropIds(userIds);
      }

      // Prioritize user crops first, then sort alphabetically
      const sortedCrops = [...rawCrops].sort((a, b) => {
        const aUser = userIds.has(a.id);
        const bUser = userIds.has(b.id);
        if (aUser && !bUser) return -1;
        if (!aUser && bUser) return 1;
        return (a.crop_name || '').localeCompare(b.crop_name || '');
      });

      setCrops(sortedCrops);
      setStages(rawStages);
      setProducts(rawProducts);

      // Pre-select first user crop or first crop for the hierarchy view
      if (sortedCrops.length > 0 && !activeCropId) {
        setActiveCropId(sortedCrops[0].id);
      }
      if (rawProducts.length > 0 && !activeProductId) {
        setActiveProductId(rawProducts[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch masters', err);
    }
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
      fetchPromos(true);
    } catch (err) { 
      alert(err.error || 'Failed to save promotion item'); 
    }
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
    if (!confirm('Are you sure you want to delete this content item?')) return;
    try {
      await api.deletePromotion(id);
      fetchPromos(true);
    } catch { /* handled */ }
  };

  // WhatsApp Hand-off flow
  const handleInitiateWhatsApp = (promo) => {
    // Open farmer selection modal first
    setFarmerSelectPromo(promo);
  };

  const handleFarmersChosen = (selectedFarmers) => {
    const promo = farmerSelectPromo;
    setFarmerSelectPromo(null);
    setWhatsappModalData({
      farmerIds: selectedFarmers,
      initialData: {
        content: promo.id,
        channel: 'WhatsApp',
        scheduleMode: 'Immediate',
        filters: {
          crop: promo.crop_names?.[0] || promo.crop_name || '',
          stage: promo.stage_names?.[0] || promo.target_stages?.[0] || ''
        }
      }
    });
  };

  // ==========================================
  // ALL PROMOTIONS TAB: Filtering & Relevance Sort
  // ==========================================
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

  const allPromosFilteredAndSorted = useMemo(() => {
    const filtered = promos.filter(p => {
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

    // Mandatory Relevance-First Sorting
    return sortPromotionsByRelevance(filtered, {
      selectedCrop,
      selectedStage,
      selectedProduct,
      selectedCategory,
      selectedContentType: selectedType,
      searchTerm
    });
  }, [promos, searchTerm, selectedCrop, selectedStage, selectedProduct, selectedCategory, selectedType, crops, products]);

  // ==========================================
  // BY CROP TAB: Hierarchy & Stage Progression
  // ==========================================
  const activeCropObj = useMemo(() => {
    return crops.find(c => c.id === activeCropId) || null;
  }, [crops, activeCropId]);

  const activeCropStages = useMemo(() => {
    if (!activeCropId) return [];
    return stages.filter(s => s.crop === activeCropId);
  }, [stages, activeCropId]);

  // Promotions count per crop for badges
  const promoCountByCrop = useMemo(() => {
    const map = {};
    promos.forEach(p => {
      if (p.crops && Array.isArray(p.crops)) {
        p.crops.forEach(cid => { map[cid] = (map[cid] || 0) + 1; });
      } else if (p.crop) {
        map[p.crop] = (map[p.crop] || 0) + 1;
      }
    });
    return map;
  }, [promos]);

  // Promotions count per product for badges
  const promoCountByProduct = useMemo(() => {
    const map = {};
    promos.forEach(p => {
      if (p.related_products && Array.isArray(p.related_products)) {
        p.related_products.forEach(pid => { map[pid] = (map[pid] || 0) + 1; });
      }
    });
    return map;
  }, [promos]);

  const cropPromosSorted = useMemo(() => {
    if (!activeCropId) return [];
    const activeCropName = activeCropObj ? activeCropObj.crop_name.toLowerCase() : '';

    const matched = promos.filter(p => {
      // Must be either directly associated with this crop OR general/unassigned crop
      const isDirect = (p.crops && p.crops.includes(activeCropId)) || (p.crop === activeCropId) ||
        (activeCropName && p.crop_names && p.crop_names.some(cn => cn.toLowerCase() === activeCropName)) ||
        (activeCropName && p.crop_name && p.crop_name.toLowerCase() === activeCropName);
      
      const isGeneral = (!p.crops || p.crops.length === 0) && !p.crop && (!p.crop_names || p.crop_names.length === 0);

      if (!isDirect && !isGeneral) return false;

      // Filter by stage if selected
      if (activeCropStage) {
        const sLow = activeCropStage.toLowerCase();
        const matchesTarget = p.target_stages && p.target_stages.some(s => s.toLowerCase() === sLow || sLow.includes(s.toLowerCase()));
        const matchesStageName = (p.stage_names && p.stage_names.some(s => s.toLowerCase() === sLow || sLow.includes(s.toLowerCase()))) ||
                                 (p.stage_name && p.stage_name.toLowerCase() === sLow);
        if (!matchesTarget && !matchesStageName) return false;
      }

      // Filter by text search if present
      if (searchTerm) {
        const low = searchTerm.toLowerCase();
        const matchTitle = (p.title || '').toLowerCase().includes(low);
        const matchCat = (p.category || '').toLowerCase().includes(low);
        const matchProds = (p.product_names && p.product_names.some(n => n.toLowerCase().includes(low)));
        if (!matchTitle && !matchCat && !matchProds) return false;
      }

      return true;
    });

    return sortPromotionsByRelevance(matched, {
      selectedCrop: activeCropId,
      selectedStage: activeCropStage,
      searchTerm
    });
  }, [promos, activeCropId, activeCropObj, activeCropStage, searchTerm]);

  // ==========================================
  // BY PRODUCT TAB: Hierarchy
  // ==========================================
  const activeProductObj = useMemo(() => {
    return products.find(p => p.id === activeProductId) || null;
  }, [products, activeProductId]);

  const productPromosSorted = useMemo(() => {
    if (!activeProductId) return [];
    const prodName = activeProductObj ? activeProductObj.name.toLowerCase() : '';

    const matched = promos.filter(p => {
      const hasProdId = p.related_products && p.related_products.includes(activeProductId);
      const hasProdName = prodName && p.product_names && p.product_names.some(n => n.toLowerCase() === prodName);
      const isDirect = hasProdId || hasProdName;

      // Also allow general promotions that have no product restriction
      const isGeneralProduct = (!p.related_products || p.related_products.length === 0) && (!p.product_names || p.product_names.length === 0);

      if (!isDirect && !isGeneralProduct) return false;

      if (searchTerm) {
        const low = searchTerm.toLowerCase();
        const matchTitle = (p.title || '').toLowerCase().includes(low);
        const matchCat = (p.category || '').toLowerCase().includes(low);
        if (!matchTitle && !matchCat) return false;
      }

      return true;
    });

    return sortPromotionsByRelevance(matched, {
      selectedProduct: activeProductId,
      searchTerm
    });
  }, [promos, activeProductId, activeProductObj, searchTerm]);

  const typeIcons = { Video: '🎬', Image: '🖼️', PDF: '📄', Link: '🔗' };

  // Render Card for an Individual Promotion
  const renderPromotionCard = (promo, i) => {
    const isDirectCrop = activeTab === 'hierarchy' && hierarchySubTab === 'crop' && activeCropId && (
      (promo.crops && promo.crops.includes(activeCropId)) || (promo.crop === activeCropId)
    );
    const isDirectProduct = activeTab === 'hierarchy' && hierarchySubTab === 'product' && activeProductId && (
      promo.related_products && promo.related_products.includes(activeProductId)
    );

    return (
      <div 
        key={promo.id} 
        className="card group overflow-hidden border border-border hover:border-primary/40 transition-all p-0 flex flex-col animate-stagger-in shadow-sm hover:shadow-md bg-surface" 
        style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
      >
        <div className="p-5 flex-1 flex flex-col">
          {/* Header row with Type Icon & Action Buttons */}
          <div className="flex justify-between items-start mb-3">
            <span className="text-2xl bg-bg rounded-xl p-2.5 shadow-sm border border-border/50">
              {typeIcons[promo.content_type] || '📎'}
            </span>
            <div className="flex items-center gap-1.5">
              {/* WhatsApp Action Button */}
              <button 
                onClick={() => handleInitiateWhatsApp(promo)}
                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200 shadow-sm"
                title="Send via WhatsApp"
              >
                <Send size={15} />
              </button>
              {/* Preview Button */}
              <button 
                onClick={() => setPreviewPromo(promo)}
                className="p-1.5 rounded-lg bg-bg text-text-muted hover:text-primary hover:bg-surface transition-colors border border-border shadow-sm"
                title="Preview Content"
              >
                <Eye size={15} />
              </button>
              {/* Admin Actions */}
              {canManage && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(promo)} className="p-1.5 text-text-muted hover:text-primary transition-colors" title="Edit Content">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => handleDelete(promo.id)} className="p-1.5 text-text-muted hover:text-danger transition-colors" title="Delete Content">
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <h4 className="font-heading font-bold text-text text-sm mb-1.5 line-clamp-2" title={promo.title}>
            {promo.title}
          </h4>
          
          <div className="flex items-center gap-2 mb-3">
            <a 
              href={promo.file_url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs text-primary hover:underline flex items-center gap-1 line-clamp-1 max-w-[220px]"
            >
              {promo.file_url.length > 32 ? promo.file_url.substring(0, 32) + '...' : promo.file_url}
              <ExternalLink size={11} className="shrink-0" />
            </a>
            {isDirectCrop && (
              <span className="badge bg-emerald-100 text-emerald-800 text-[10px] font-semibold border border-emerald-300">
                ⭐ Directly Linked
              </span>
            )}
            {isDirectProduct && (
              <span className="badge bg-purple-100 text-purple-800 text-[10px] font-semibold border border-purple-300">
                ⭐ Directly Linked
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-auto pt-2 border-t border-border/40">
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

            {/* Stages */}
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
            
            <span className={`badge text-[10px] ${promo.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
              {promo.status || 'Active'}
            </span>
          </div>
        </div>
        
        {/* Footer info & WhatsApp Quick Trigger */}
        <div className="bg-bg/60 px-4 py-2 border-t border-border text-[11px] text-text-muted flex justify-between items-center">
          <span className="text-[10px]">
            {promo.created_at ? new Date(promo.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Advisory'}
          </span>
          <button
            onClick={() => handleInitiateWhatsApp(promo)}
            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold text-xs hover:underline"
          >
            <Send size={11} /> Send to Farmers
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Actions Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-heading font-bold text-text">Promotion Library</h2>
            {refreshing && (
              <span className="inline-flex items-center gap-1 text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-full animate-pulse">
                <RefreshCw size={10} className="animate-spin" /> Syncing
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Manage, discover, and deliver promotional and technical advisory content across crops, products, and growth stages.
          </p>
        </div>

        {/* Action Buttons for Authorized Users */}
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 bg-surface hover:bg-bg text-text border border-border px-3.5 py-2 rounded-xl font-semibold text-xs transition-colors shadow-sm"
          >
            <Upload size={15} /> Bulk Import
          </button>
          <button 
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl font-semibold text-xs transition-colors shadow-sm"
          >
            <Plus size={15} /> Add Content
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <Grid size={16} />
          <span>All Promotions</span>
          <span className="text-[11px] bg-bg px-2 py-0.5 rounded-full text-text-muted font-normal">
            {promos.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('hierarchy')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'hierarchy'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <Layers size={16} />
          <span>Browse by Crop / Product</span>
        </button>
      </div>

      {/* Bulk Import Modal */}
      {showWizard && (
        <ImportWizard 
          resource="promotions"
          onClose={() => setShowWizard(false)}
          onComplete={() => fetchPromos(true)}
        />
      )}

      {/* Add / Edit Form Modal / Accordion */}
      {showForm && (
        <div className="card p-6 mb-6 animate-stagger-in border-2 border-primary/20 bg-surface shadow-lg">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-border">
            <h3 className="font-heading font-semibold text-text text-base">
              {editingPromo ? 'Edit Promotion Item' : 'New Promotion Item'}
            </h3>
            <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-text-muted mb-1">Title*</label>
              <input 
                placeholder="e.g. Grape Flowering Nutrient Guide" 
                value={form.title} 
                onChange={e => setForm({...form, title: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Content Type</label>
              <select 
                value={form.content_type} 
                onChange={e => setForm({...form, content_type: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="Image">Image</option>
                <option value="Video">Video</option>
                <option value="PDF">PDF</option>
                <option value="Link">Link</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Category</label>
              <select 
                value={form.category} 
                onChange={e => setForm({...form, category: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-text-muted mb-1">File/Content URL*</label>
              <input 
                placeholder="https://... or YouTube video link" 
                value={form.file_url} 
                onChange={e => setForm({...form, file_url: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface font-mono focus:ring-2 focus:ring-primary focus:outline-none" 
                required 
              />
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

            {/* Crop-Specific Stages */}
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
              <input 
                type="date" 
                value={form.expiry_date} 
                onChange={e => setForm({...form, expiry_date: e.target.value})}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:ring-2 focus:ring-primary focus:outline-none" 
              />
            </div>

            <div className="flex justify-end items-end col-span-2 gap-3 mt-4">
              <button 
                type="button" 
                onClick={() => setShowForm(false)} 
                className="px-5 py-2 rounded-lg font-medium text-xs text-text-muted border border-border hover:bg-surface"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="bg-primary hover:bg-primary-dark text-white px-5 py-2 rounded-lg font-medium text-xs transition-colors shadow-md"
              >
                {editingPromo ? 'Update Content' : 'Create Content'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: ALL PROMOTIONS (Preserved Flat Grid & Filters)     */}
      {/* ========================================================= */}
      {activeTab === 'all' && (
        <div className="space-y-6">
          {/* Search and Filters Toolbar */}
          <div className="card p-4 shadow-sm border border-border bg-surface">
            {/* Search Input Row */}
            <div className="relative mb-3">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search promotions by title, crop, stage, product, category, or content type..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 border border-border rounded-xl text-sm bg-surface focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none transition-all"
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
                    <optgroup label="Crops">
                      {crops.map(c => (
                        <option key={c.id} value={c.id}>
                          {userCropIds.has(c.id) ? '⭐ ' : ''}{c.crop_name}
                        </option>
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
                  Showing {allPromosFilteredAndSorted.length} of {promos.length} items
                </span>
                {hasActiveFilters && (
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[11px] px-2 py-0.5 rounded-full font-medium">
                    <Filter size={11} /> Filters Active (Sorted by Relevance)
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

          {/* Promotions Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-3 card p-12 text-center text-text-muted">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
                <p>Loading promotion library...</p>
              </div>
            ) : allPromosFilteredAndSorted.length === 0 ? (
              <div className="col-span-3 card p-12 text-center text-text-muted border-dashed border-2">
                No promotion content found matching your search.
              </div>
            ) : (
              allPromosFilteredAndSorted.map((promo, i) => renderPromotionCard(promo, i))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BROWSE BY CROP / PRODUCT (Hierarchical Visual Navigation)          */}
      {/* ========================================================================= */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-6">
          {/* Sub-tab navigation: By Crop vs By Product */}
          <div className="flex items-center justify-between bg-surface p-2 rounded-xl border border-border shadow-sm">
            <div className="flex gap-2">
              <button
                onClick={() => setHierarchySubTab('crop')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  hierarchySubTab === 'crop'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text hover:bg-bg'
                }`}
              >
                <Sprout size={15} />
                <span>By Crop</span>
              </button>

              <button
                onClick={() => setHierarchySubTab('product')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  hierarchySubTab === 'product'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text hover:bg-bg'
                }`}
              >
                <Package size={15} />
                <span>By Product</span>
              </button>
            </div>

            {/* Quick Search across hierarchy */}
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Filter current view..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* SUB-TAB A: BY CROP */}
          {hierarchySubTab === 'crop' && (
            <div className="space-y-6">
              {/* Visual Crop Selector Bar (Market Intelligence Style) */}
              <div className="card p-4 bg-surface border border-border shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
                    Select Crop <span className="text-text-muted font-normal lowercase">({crops.length} available)</span>
                  </h3>
                  {userCropIds.size > 0 && (
                    <span className="text-[11px] text-text-muted flex items-center gap-1">
                      <span className="text-emerald-600">🍃</span> Prioritized by your managed farmers
                    </span>
                  )}
                </div>

                <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
                  {crops.map(c => {
                    const isSelected = activeCropId === c.id;
                    const pCount = promoCountByCrop[c.id] || 0;
                    const isUserCrop = userCropIds.has(c.id);

                    return (
                      <div 
                        key={c.id} 
                        onClick={() => {
                          setActiveCropId(c.id);
                          setActiveCropStage(''); // reset stage filter on crop change
                        }}
                        className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0"
                      >
                        <div className={`relative w-16 h-16 rounded-2xl overflow-hidden border-2 flex items-center justify-center p-1.5 transition-all ${
                          isSelected 
                            ? 'border-primary shadow-md bg-emerald-50 scale-105' 
                            : 'border-border bg-surface group-hover:border-primary/40'
                        }`}>
                          {c.reference_image ? (
                            <img 
                              src={getImageUrl(c.reference_image)} 
                              alt={c.crop_name} 
                              className="w-full h-full object-contain" 
                            />
                          ) : (
                            <Sprout className="text-primary/40" size={26} />
                          )}

                          {/* Badge for promotion count */}
                          {pCount > 0 && (
                            <span className="absolute top-1 right-1 bg-primary text-white text-[9px] font-bold px-1 rounded-full shadow-sm">
                              {pCount}
                            </span>
                          )}
                        </div>

                        <div className="text-center max-w-[80px]">
                          <p className={`text-xs font-bold truncate ${isSelected ? 'text-primary' : 'text-text group-hover:text-primary'}`}>
                            {c.crop_name}
                          </p>
                          {c.marathi_name && (
                            <p className="text-[10px] text-text-muted truncate">{c.marathi_name}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Crop Detail Bar & Growth Stage Progression */}
              {activeCropObj && (
                <div className="card p-4 bg-surface border border-border shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center overflow-hidden">
                        {activeCropObj.reference_image ? (
                          <img src={getImageUrl(activeCropObj.reference_image)} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <Sprout size={20} className="text-primary" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-heading font-bold text-text text-base">
                          {activeCropObj.crop_name}
                          {activeCropObj.marathi_name && <span className="text-text-muted text-xs font-normal ml-1.5">({activeCropObj.marathi_name})</span>}
                        </h3>
                        <p className="text-[11px] text-text-muted">
                          Showing {cropPromosSorted.length} promotions (Ranked: Directly Linked &gt; Universal Advisory)
                        </p>
                      </div>
                    </div>

                    {activeCropStage && (
                      <button 
                        onClick={() => setActiveCropStage('')}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                      >
                        <RotateCcw size={12} /> Clear stage filter
                      </button>
                    )}
                  </div>

                  {/* Growth Stage Progression Bar */}
                  <div>
                    <label className="block text-[11px] font-semibold text-text-muted mb-2">
                      Growth Stage Progression
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setActiveCropStage('')}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                          !activeCropStage 
                            ? 'bg-primary text-white border-primary shadow-sm' 
                            : 'bg-bg text-text hover:bg-surface border-border'
                        }`}
                      >
                        All Stages
                      </button>

                      {/* Crop-specific stages */}
                      {activeCropStages.map(s => {
                        const isSelected = activeCropStage === s.stage_name;
                        return (
                          <button
                            key={s.id}
                            onClick={() => setActiveCropStage(s.stage_name)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium flex items-center gap-1.5 ${
                              isSelected 
                                ? 'bg-primary text-white border-primary shadow-sm' 
                                : 'bg-surface text-text hover:bg-bg border-border'
                            }`}
                          >
                            <span>📅</span>
                            <span>{s.stage_name}</span>
                          </button>
                        );
                      })}

                      {/* Generic Stages (Irrespective of crop) */}
                      {GENERIC_STAGES.map(gs => {
                        const isSelected = activeCropStage === gs;
                        return (
                          <button
                            key={gs}
                            onClick={() => setActiveCropStage(gs)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium flex items-center gap-1.5 ${
                              isSelected 
                                ? 'bg-amber-600 text-white border-amber-600 shadow-sm' 
                                : 'bg-amber-50/60 text-amber-900 hover:bg-amber-100/60 border-amber-200'
                            }`}
                          >
                            <span>✨</span>
                            <span>{gs}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Promotions Grid for Selected Crop */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cropPromosSorted.length === 0 ? (
                  <div className="col-span-3 card p-12 text-center text-text-muted border-dashed border-2">
                    No promotions found for {activeCropObj ? activeCropObj.crop_name : 'this crop'}
                    {activeCropStage ? ` at stage "${activeCropStage}"` : ''}.
                  </div>
                ) : (
                  cropPromosSorted.map((promo, i) => renderPromotionCard(promo, i))
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB B: BY PRODUCT */}
          {hierarchySubTab === 'product' && (
            <div className="space-y-6">
              {/* Product Selector Catalog */}
              <div className="card p-4 bg-surface border border-border shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
                    Select Product <span className="text-text-muted font-normal lowercase">({products.length} products)</span>
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {products.map(p => {
                    const isSelected = activeProductId === p.id;
                    const pCount = promoCountByProduct[p.id] || 0;

                    return (
                      <div
                        key={p.id}
                        onClick={() => setActiveProductId(p.id)}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border bg-surface hover:border-primary/40 hover:bg-bg/40'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-lg">📦</span>
                            {pCount > 0 && (
                              <span className="badge bg-primary text-white text-[10px] font-bold">
                                {pCount}
                              </span>
                            )}
                          </div>
                          <p className={`text-xs font-bold line-clamp-2 ${isSelected ? 'text-primary' : 'text-text'}`}>
                            {p.name}
                          </p>
                        </div>
                        {p.category && (
                          <p className="text-[10px] text-text-muted mt-2 truncate">
                            {p.category}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Product Detail Banner */}
              {activeProductObj && (
                <div className="card p-4 bg-surface border border-border shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-xl">
                      📦
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-text text-base">
                        {activeProductObj.name}
                      </h3>
                      <p className="text-[11px] text-text-muted">
                        Showing {productPromosSorted.length} promotions (Ranked: Directly Linked &gt; General Content)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Promotions Grid for Selected Product */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {productPromosSorted.length === 0 ? (
                  <div className="col-span-3 card p-12 text-center text-text-muted border-dashed border-2">
                    No promotions found for {activeProductObj ? activeProductObj.name : 'this product'}.
                  </div>
                ) : (
                  productPromosSorted.map((promo, i) => renderPromotionCard(promo, i))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: Promotion Preview Modal                          */}
      {/* ========================================================= */}
      {previewPromo && (
        <PromotionPreviewModal
          promo={previewPromo}
          onClose={() => setPreviewPromo(null)}
          onSendWhatsApp={(p) => {
            setPreviewPromo(null);
            handleInitiateWhatsApp(p);
          }}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 2: Farmer Selection Step for WhatsApp Handoff       */}
      {/* ========================================================= */}
      {farmerSelectPromo && (
        <PromotionFarmerSelectModal
          promo={farmerSelectPromo}
          onClose={() => setFarmerSelectPromo(null)}
          onConfirmSelection={handleFarmersChosen}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 3: Existing SendMessageModal WhatsApp Dispatch      */}
      {/* ========================================================= */}
      {whatsappModalData && (
        <SendMessageModal
          farmerIds={whatsappModalData.farmerIds}
          initialData={whatsappModalData.initialData}
          onClose={() => setWhatsappModalData(null)}
          onSuccess={() => {
            setWhatsappModalData(null);
            alert('WhatsApp campaign scheduled/sent successfully!');
          }}
        />
      )}
    </div>
  );
}
