import React from 'react';
import { X, ExternalLink, Send, FileText, Image as ImageIcon, Video, Link as LinkIcon, Download } from 'lucide-react';

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  try {
    // Check for youtube.com/shorts/ID
    const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch && shortsMatch[1]) {
      return `https://www.youtube.com/embed/${shortsMatch[1]}`;
    }
    // Check for youtu.be/ID
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (shortMatch && shortMatch[1]) {
      return `https://www.youtube.com/embed/${shortMatch[1]}`;
    }
    // Check for youtube.com/watch?v=ID
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    if (watchMatch && watchMatch[1]) {
      return `https://www.youtube.com/embed/${watchMatch[1]}`;
    }
    // Check if already an embed URL
    if (url.includes('youtube.com/embed/')) {
      return url;
    }
  } catch (e) {
    console.error('Error parsing YouTube URL:', e);
  }
  return null;
}

export default function PromotionPreviewModal({ promo, onClose, onSendWhatsApp }) {
  if (!promo) return null;

  const ytEmbed = promo.content_type === 'Video' ? getYouTubeEmbedUrl(promo.file_url) : null;
  const isDirectVideo = promo.content_type === 'Video' && !ytEmbed && (promo.file_url.endsWith('.mp4') || promo.file_url.endsWith('.webm'));
  const isImage = promo.content_type === 'Image';
  const isPdf = promo.content_type === 'PDF' || (promo.file_url && promo.file_url.toLowerCase().endsWith('.pdf'));

  return (
    <div className="fixed inset-0 bg-text/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-surface w-full max-w-3xl max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-border animate-scale-up">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-bg/40">
          <div className="flex items-center gap-2">
            <span className="text-xl">
              {promo.content_type === 'Video' ? '🎬' : promo.content_type === 'Image' ? '🖼️' : promo.content_type === 'PDF' ? '📄' : '🔗'}
            </span>
            <h3 className="font-heading font-bold text-text text-base md:text-lg line-clamp-1">{promo.title}</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Media Preview Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-bg/20">
          <div className="bg-black/5 dark:bg-black/30 rounded-xl overflow-hidden border border-border flex items-center justify-center min-h-[260px] max-h-[440px]">
            {ytEmbed ? (
              <div className="relative w-full aspect-video">
                <iframe
                  src={ytEmbed}
                  title={promo.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : isDirectVideo ? (
              <video src={promo.file_url} controls className="max-h-[420px] w-full rounded-lg" />
            ) : isImage ? (
              <img 
                src={promo.file_url} 
                alt={promo.title} 
                className="max-h-[420px] w-auto max-w-full object-contain rounded-lg shadow-sm"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://placehold.co/600x400?text=Preview+Not+Available';
                }}
              />
            ) : isPdf ? (
              <div className="p-8 text-center space-y-3">
                <FileText size={56} className="mx-auto text-primary" />
                <p className="font-heading font-semibold text-text text-sm">PDF Document Advisory</p>
                <p className="text-xs text-text-muted max-w-sm truncate">{promo.file_url}</p>
                <a
                  href={promo.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 btn-primary text-xs px-4 py-2 mt-2"
                >
                  <Download size={14} /> Open / Download PDF
                </a>
              </div>
            ) : (
              <div className="p-8 text-center space-y-3">
                <LinkIcon size={48} className="mx-auto text-primary" />
                <p className="font-heading font-semibold text-text text-sm">External Resource Link</p>
                <p className="text-xs text-text-muted max-w-md break-all">{promo.file_url}</p>
                <a
                  href={promo.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 btn-primary text-xs px-4 py-2 mt-2"
                >
                  <ExternalLink size={14} /> Visit Web Resource
                </a>
              </div>
            )}
          </div>

          {/* Details & Badges */}
          <div className="space-y-3 bg-surface p-4 rounded-xl border border-border">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                {promo.content_type}
              </span>
              {promo.category && (
                <span className="badge bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100">
                  🏷️ {promo.category}
                </span>
              )}
              <span className={`badge text-xs font-medium ${promo.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
                {promo.status}
              </span>
            </div>

            {/* Target Crops */}
            <div>
              <span className="text-xs font-bold text-text-muted block mb-1">Target Crops:</span>
              <div className="flex flex-wrap gap-1.5">
                {promo.crop_names && promo.crop_names.length > 0 ? (
                  promo.crop_names.map((cn, idx) => (
                    <span key={idx} className="badge bg-green-50 text-green-700 text-xs border border-green-100">🌱 {cn}</span>
                  ))
                ) : promo.crop_name ? (
                  <span className="badge bg-green-50 text-green-700 text-xs border border-green-100">🌱 {promo.crop_name}</span>
                ) : (
                  <span className="badge bg-emerald-50 text-emerald-700 text-xs border border-emerald-100">🌱 Applicable to All Crops</span>
                )}
              </div>
            </div>

            {/* Target Growth Stages */}
            {((promo.stage_names && promo.stage_names.length > 0) || (promo.target_stages && promo.target_stages.length > 0)) && (
              <div>
                <span className="text-xs font-bold text-text-muted block mb-1">Growth Stages:</span>
                <div className="flex flex-wrap gap-1.5">
                  {promo.stage_names && promo.stage_names.map((sn, idx) => (
                    <span key={`sn-${idx}`} className="badge bg-amber-50 text-amber-700 text-xs border border-amber-100">📅 {sn}</span>
                  ))}
                  {promo.target_stages && promo.target_stages.map((ts, idx) => (
                    <span key={`ts-${idx}`} className="badge bg-amber-100/80 text-amber-800 text-xs border border-amber-200">✨ {ts}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Related Products */}
            {promo.product_names && promo.product_names.length > 0 && (
              <div>
                <span className="text-xs font-bold text-text-muted block mb-1">Associated Products:</span>
                <div className="flex flex-wrap gap-1.5">
                  {promo.product_names.map((pn, idx) => (
                    <span key={idx} className="badge bg-purple-50 text-purple-700 text-xs border border-purple-100">📦 {pn}</span>
                  ))}
                </div>
              </div>
            )}

            {/* External URL Reference */}
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-text-muted">
              <span className="truncate max-w-[70%]">Source: {promo.file_url}</span>
              <a 
                href={promo.file_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-primary hover:underline flex items-center gap-1 shrink-0"
              >
                Open Original <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-bg/50 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-bg transition-colors"
          >
            Close
          </button>

          <button
            onClick={() => {
              onClose();
              if (onSendWhatsApp) onSendWhatsApp(promo);
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-medium shadow-sm hover:shadow transition-all btn-press"
          >
            <Send size={15} />
            <span>Send to Farmer via WhatsApp</span>
          </button>
        </div>

      </div>
    </div>
  );
}
