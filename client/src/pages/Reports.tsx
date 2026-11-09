import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  Upload,
  FileText,
  FileSpreadsheet,
  Download,
  Trash2,
  Send,
  Loader2,
  Sparkles,
  Calculator,
  Bot
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api } from '../services/api';
import { UploadedDocument } from '../types';

export const Reports: React.FC = () => {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docQuery, setDocQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryAnswer, setQueryAnswer] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Marketing Metrics Calculator State
  const [impressions, setImpressions] = useState(25000);
  const [clicks, setClicks] = useState(850);
  const [conversions, setConversions] = useState(48);
  const [spend, setSpend] = useState(1200);
  const [revenue, setRevenue] = useState(4800);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    try {
      const data = await api.getDocuments();
      setDocuments(data);
      if (data.length > 0 && !selectedDocId) {
        setSelectedDocId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const newDoc = await api.uploadDocument(file);
      await loadDocuments();
      setSelectedDocId(newDoc.id);
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleQueryDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId || !docQuery.trim()) return;

    setIsQuerying(true);
    setQueryAnswer(null);

    try {
      const res = await api.queryDocument(selectedDocId, docQuery.trim());
      setQueryAnswer(res.answer);
    } catch (err: any) {
      setQueryAnswer('Error querying document: ' + err.message);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!window.confirm('Delete this uploaded document?')) return;
    try {
      await api.deleteDocument(id);
      await loadDocuments();
      if (selectedDocId === id) {
        setSelectedDocId(null);
        setQueryAnswer(null);
      }
    } catch (err: any) {
      alert('Failed to delete document: ' + err.message);
    }
  };

  // Real Calculated Metrics
  const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
  const convRate = clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : 0;
  const cpc = clicks > 0 && spend > 0 ? Number((spend / clicks).toFixed(2)) : 0;
  const cpa = conversions > 0 && spend > 0 ? Number((spend / conversions).toFixed(2)) : 0;
  const roas = spend > 0 && revenue > 0 ? Number((revenue / spend).toFixed(2)) : 0;

  const chartData = [
    { name: 'Impressions / 100', value: Math.round(impressions / 100) },
    { name: 'Clicks', value: clicks },
    { name: 'Conversions x 10', value: conversions * 10 },
    { name: 'Spend ($)', value: spend },
    { name: 'Revenue ($)', value: revenue }
  ];

  const exportPdfReport = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('MarketMate AI — Campaign Analytics Report', 14, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 28);

    doc.text(`Impressions: ${impressions.toLocaleString()}`, 14, 40);
    doc.text(`Clicks: ${clicks.toLocaleString()} (CTR: ${ctr}%)`, 14, 48);
    doc.text(`Conversions: ${conversions} (Conv Rate: ${convRate}%)`, 14, 56);
    doc.text(`Spend: $${spend.toLocaleString()} (CPC: $${cpc}, CPA: $${cpa})`, 14, 64);
    doc.text(`Revenue: $${revenue.toLocaleString()} (ROAS: ${roas}x)`, 14, 72);

    doc.save('MarketMate_Campaign_Report.pdf');
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Report & Data Analyst Agent</h1>
            <p className="text-xs text-slate-500">
              Upload documents (PDF, DOCX, CSV, XLSX, TXT), perform mathematical marketing calculations, and export reports.
            </p>
          </div>
        </div>
      </div>

      {/* Campaign Metrics Calculator & Visualizations */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-violet-600" />
            <h2 className="text-sm font-bold text-slate-900">Campaign Performance Metrics Calculator</h2>
          </div>
          <button
            onClick={exportPdfReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Analytics PDF</span>
          </button>
        </div>

        {/* Input Inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Impressions</label>
            <input
              type="number"
              value={impressions}
              onChange={(e) => setImpressions(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Clicks</label>
            <input
              type="number"
              value={clicks}
              onChange={(e) => setClicks(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Conversions</label>
            <input
              type="number"
              value={conversions}
              onChange={(e) => setConversions(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Spend ($)</label>
            <input
              type="number"
              value={spend}
              onChange={(e) => setSpend(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Revenue ($)</label>
            <input
              type="number"
              value={revenue}
              onChange={(e) => setRevenue(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* Calculated Results Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Click-Through (CTR)</span>
            <p className="text-lg font-bold text-slate-900 mt-1">{ctr}%</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Conversion Rate</span>
            <p className="text-lg font-bold text-slate-900 mt-1">{convRate}%</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Cost Per Click (CPC)</span>
            <p className="text-lg font-bold text-slate-900 mt-1">${cpc}</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Cost Per Acq (CPA)</span>
            <p className="text-lg font-bold text-slate-900 mt-1">${cpa}</p>
          </div>

          <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 text-center">
            <span className="text-[10px] text-violet-700 uppercase font-semibold">Return on Ad Spend</span>
            <p className="text-lg font-bold text-violet-900 mt-1">{roas}x</p>
          </div>
        </div>

        {/* Chart Visualization */}
        <div className="pt-2">
          <h3 className="text-xs font-bold text-slate-700 mb-3">Campaign Volume & Financial Distribution</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Document Intelligence Section */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Document Intelligence & File Parsing</h2>
            <p className="text-xs text-slate-500">
              Extract and reason over PDF audits, Word documents, Excel sheets, and CSV metrics.
            </p>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>Upload Document</span>
            </button>
          </div>
        </div>

        {/* Uploaded Documents List */}
        {documents.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p>No documents uploaded yet. Upload a PDF, CSV, or DOCX to analyze.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {documents.map((d) => (
                <div
                  key={d.id}
                  onClick={() => setSelectedDocId(d.id)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-start justify-between ${
                    selectedDocId === d.id
                      ? 'bg-violet-50 border-violet-300 shadow-sm'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 truncate">
                      {(d.fileType && (d.fileType.includes('xls') || d.fileType === 'csv')) ? (
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                      )}
                      <span className="truncate">{d.filename}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {d.wordCount || 0} words • {d.sizeBytes ? (d.sizeBytes / 1024).toFixed(1) : ((d.size || 0) / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDocument(d.id);
                    }}
                    className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Document Q&A Form */}
            {selectedDocId && (
              <form onSubmit={handleQueryDocument} className="pt-2 space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Ask Gemini About Selected Document
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={docQuery}
                    onChange={(e) => setDocQuery(e.target.value)}
                    placeholder="e.g. Summarize the executive findings and list key performance trends..."
                    required
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500"
                  />
                  <button
                    type="submit"
                    disabled={isQuerying || !docQuery.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition disabled:opacity-40 shadow-sm shrink-0"
                  >
                    {isQuerying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Analyze</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Query Answer Output */}
            {queryAnswer && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between text-violet-800 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                    AI Analysis Result
                  </span>
                </div>
                <div className="prose prose-xs max-w-none text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                  {queryAnswer}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
