import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

export default function ImportWizard({ onClose, onComplete, resource = 'farmers' }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [jobData, setJobData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      let resp;
      if (resource === 'users') {
        resp = await api.uploadUsersForValidation(file);
      } else if (resource === 'promotions') {
        resp = await api.uploadPromotionsForValidation(file);
      } else {
        resp = await api.uploadForValidation(file);
      }
      setJobId(resp.import_job_id);
      setStep(2);
    } catch (err) {
      alert(err.error || 'Upload failed');
    }
    setLoading(false);
  };

  useEffect(() => {
    let interval;
    if (step === 2 && jobId) {
      interval = setInterval(async () => {
        try {
          const data = await api.getImportJobStatus(jobId);
          if (data.status === 'Pending') {
            setJobData(data);
            setStep(3);
            clearInterval(interval);
          } else if (data.status === 'Failed') {
            setJobData(data);
            setStep(3);
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Polling failed', err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [step, jobId]);

  const handleCommit = async () => {
    setLoading(true);
    try {
      if (resource === 'users') {
        await api.commitImportUsers(jobId, acknowledged);
      } else if (resource === 'promotions') {
        await api.commitImportPromotions(jobId);
      } else {
        await api.commitImportFarmers(jobId, acknowledged);
      }
      onComplete();
      onClose();
    } catch (err) {
      alert(err.error || 'Commit failed');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-text/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-stagger-in">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-bg/50">
          <h3 className="font-heading font-bold text-text">Bulk Import Wizard ({resource === 'users' ? 'Users' : resource === 'promotions' ? 'Promotions' : 'Farmers'})</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">Upload your {resource === 'users' ? 'user' : resource === 'promotions' ? 'promotion' : 'farmer'} data Excel file for validation.</p>
              
              {resource === 'users' && (
                <div className="text-xs bg-bg p-3 rounded border border-border text-text-muted relative">
                  <button 
                    onClick={async () => {
                      try { await api.downloadUserTemplate(); }
                      catch (err) { alert('Failed to download template'); }
                    }} 
                    className="absolute top-3 right-3 text-primary font-medium hover:underline flex items-center gap-1"
                  >
                    Download Template
                  </button>
                  <p className="font-bold mb-1">Required Columns:</p>
                  <p>Employee ID, Name, Mobile Number, Designation</p>
                  <p className="mt-1 font-bold mb-1">Optional Columns:</p>
                  <p>Territory</p>
                </div>
              )}

              {resource === 'promotions' && (
                <div className="text-xs bg-bg p-3 rounded border border-border text-text-muted">
                  <p className="font-bold mb-1">Required Columns:</p>
                  <p>Title, ContentType, FileURL</p>
                  <p className="mt-1 font-bold mb-1">Optional Columns:</p>
                  <p>Crop, Stage, Product</p>
                </div>
              )}

              {resource === 'farmers' && (
                <div className="text-xs bg-bg p-3 rounded border border-border text-text-muted">
                  <p className="font-bold mb-1">Required Columns:</p>
                  <p>FullName, PrimaryMobile, Village, StaffMobile</p>
                  <p className="mt-1 font-bold mb-1">Tips:</p>
                  <p>StaffMobile must match an existing user's mobile number.</p>
                </div>
              )}

              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-bg/20">
                <input
                  type="file" accept=".xlsx,.xls"
                  onChange={e => setFile(e.target.files[0])}
                  className="hidden" id="import-file"
                />
                <label htmlFor="import-file" className="cursor-pointer">
                  <div className="text-primary font-heading font-medium mb-1">
                    {file ? file.name : `Click to select Excel file`}
                  </div>
                  <div className="text-xs text-text-muted">Only .xlsx or .xls accepted</div>
                </label>
              </div>
              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Upload for Validation
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="py-12 text-center space-y-4">
              <Loader2 size={40} className="mx-auto text-primary animate-spin" />
              <div>
                <p className="font-heading font-semibold text-text">Validating Data...</p>
                <p className="text-sm text-text-muted">We are checking potential records and duplicates.</p>
              </div>
            </div>
          )}

          {step === 3 && jobData && (
            <div className="space-y-6">
              {jobData.status === 'Failed' ? (
                <div className="bg-danger/10 p-4 rounded-lg flex gap-3 text-danger overflow-y-auto max-h-60">
                  <AlertTriangle size={20} className="shrink-0" />
                  <div className="text-sm">
                    <p className="font-bold mb-1">Validation Failed</p>
                    {jobData.error_report?.map((err, i) => (
                      <p key={i} className="mb-1">Row {err.row || 'N/A'}: {err.error}</p>
                    )) || <p>Unknown error</p>}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-bg p-3 rounded-lg border border-border">
                      <div className="text-xs text-text-muted mb-1">Total Rows</div>
                      <div className="text-xl font-heading font-bold text-text">{jobData.total_rows}</div>
                    </div>
                    <div className="bg-success/5 p-3 rounded-lg border border-success/20">
                      <div className="text-xs text-success mb-1">Ready to Import</div>
                      <div className="text-xl font-heading font-bold text-success">{jobData.valid_rows}</div>
                    </div>
                    <div className="bg-danger/5 p-3 rounded-lg border border-danger/20">
                      <div className="text-xs text-danger mb-1">Row Errors</div>
                      <div className="text-xl font-heading font-bold text-danger">{jobData.error_count}</div>
                    </div>
                    <div className="bg-accent/5 p-3 rounded-lg border border-accent/20">
                      <div className="text-xs text-accent mb-1">Duplicates</div>
                      <div className="text-xl font-heading font-bold text-accent">{jobData.duplicate_count}</div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setStep(1)} className="btn-secondary flex-1">Start Over</button>
                    <button
                      onClick={handleCommit}
                      disabled={loading}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      {loading && <Loader2 size={16} className="animate-spin" />}
                      Commit Import
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
