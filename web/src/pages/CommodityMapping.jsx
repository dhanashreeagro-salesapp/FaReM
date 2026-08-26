import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Database, Link2, XCircle } from 'lucide-react';
import api from '../services/api';

export default function CommodityMapping() {
  const [mappings, setMappings] = useState([]);
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCrop, setSelectedCrop] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mappingsData, cropsData] = await Promise.all([
        api.getUnmappedCommodities(),
        api.getCrops()
      ]);
      setMappings(mappingsData || []);
      setCrops(cropsData || []);
    } catch (error) {
      console.error("Failed to load mapping data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (mappingId, action) => {
    try {
      const cropId = selectedCrop[mappingId];
      if (action === 'link' && !cropId) {
        alert("Please select a crop to link.");
        return;
      }
      
      await api.mapCommodity(mappingId, cropId, action);
      alert(`Commodity successfully ${action === 'link' ? 'linked' : 'discarded'}!`);
      
      // Remove from list locally to avoid refetching everything
      setMappings(prev => prev.filter(m => m.id !== mappingId));
      
    } catch (error) {
      console.error(error);
      alert("Failed to update mapping: " + (error.error || error.message || 'Unknown error'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold font-heading text-text">Commodity Mapping</h1>
          <p className="text-sm text-text-muted mt-1">Rationalize external market commodity names with internal system crops and automate historical links.</p>
        </div>
        <button onClick={fetchData} className="px-4 py-2 bg-background border border-border rounded-lg text-sm flex items-center gap-2 hover:bg-muted font-medium text-text transition-colors">
          <Database className="w-4 h-4" /> Refresh List
        </button>
      </div>

      <Card className="border-border bg-surface shadow-sm">
        <CardHeader>
          <CardTitle>Unmapped Commodities Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="text-center py-8 text-text-muted">Loading queue...</div>
          ) : mappings.length === 0 ? (
             <div className="text-center py-8 text-text-muted">All loaded commodities are perfectly mapped! No pending rationalization needed.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-text-muted uppercase border-b border-border">
                  <tr>
                    <th className="px-4 py-3">External Commodity String</th>
                    <th className="px-4 py-3">System Crop</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr key={m.id} className="border-b border-border hover:bg-muted transition-colors">
                      <td className="px-4 py-3 font-medium text-text bg-red-500/10 rounded my-1 mx-2 inline-block border border-red-500/20">{m.commodity_name}</td>
                      <td className="px-4 py-3">
                        <select 
                          className="w-full p-2 rounded border border-border bg-background text-text focus:outline-none focus:ring-1 focus:ring-primary"
                          value={selectedCrop[m.id] || ''}
                          onChange={(e) => setSelectedCrop({...selectedCrop, [m.id]: e.target.value})}
                        >
                          <option value="">-- Select Master Crop --</option>
                          {crops.map(c => (
                            <option key={c.id} value={c.id}>{c.crop_name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                           <button 
                             onClick={() => handleAction(m.id, 'link')}
                             className="text-primary hover:text-primary-hover flex items-center gap-1 font-medium bg-primary/10 px-3 py-1.5 rounded transition-colors"
                           >
                             <Link2 className="w-4 h-4" /> Link 
                           </button>
                           <button 
                             onClick={() => handleAction(m.id, 'ignore')}
                             className="text-text-muted hover:text-red-500 flex items-center gap-1 font-medium bg-muted px-3 py-1.5 rounded transition-colors"
                           >
                             <XCircle className="w-4 h-4" /> Discard
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
