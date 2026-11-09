import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Trash2, Tag, Bot, Search, ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { KnowledgeItem } from '../types';

export const Knowledge: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<KnowledgeItem['category']>('Company Profile');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('b2b, cloud, growth');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadKnowledge = async () => {
    try {
      const data = await api.getKnowledge();
      setItems(data);
    } catch (err) {
      console.error('Failed to load knowledge:', err);
    }
  };

  useEffect(() => {
    loadKnowledge();
  }, []);

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setIsSubmitting(true);
    try {
      const tags = newTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      await api.saveKnowledge({
        category: newCategory,
        title: newTitle.trim(),
        content: newContent.trim(),
        tags
      });

      setNewTitle('');
      setNewContent('');
      setIsModalOpen(false);
      await loadKnowledge();
    } catch (err: any) {
      alert('Failed to save knowledge item: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Delete this knowledge base item?')) return;
    try {
      await api.deleteKnowledge(id);
      await loadKnowledge();
    } catch (err: any) {
      alert('Failed to delete item: ' + err.message);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase()) ||
      (item.tags && item.tags.some(t => t.toLowerCase().includes(search.toLowerCase())));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Knowledge Base & Brand Memory</h1>
              <p className="text-xs text-slate-500">
                Store your company profiles, brand tone, ICP definitions, and strategic research for persistent agent context.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-sm transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Knowledge Item</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/90 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company profiles, ICPs, or guidelines..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {['All', 'Company Profile', 'Brand Guidelines', 'Target Audience & ICP', 'Product Offering'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition shrink-0 ${
                categoryFilter === cat
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Knowledge Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800">No knowledge items recorded</h3>
          <p className="mt-1 max-w-sm mx-auto">
            Add your company profile, brand voice, or ICP guidelines so that MarketMate AI incorporates your exact brand context into every prompt.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 px-3.5 py-2 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 transition"
          >
            Add First Item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm hover:border-violet-300 transition flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100">
                    {item.category}
                  </span>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-slate-100"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                <p className="text-xs text-slate-600 mt-2 line-clamp-4 whitespace-pre-wrap leading-relaxed">
                  {item.content}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <div className="flex flex-wrap gap-1">
                  {item.tags?.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() =>
                    navigate(`/workspace?prompt=${encodeURIComponent(`Using our saved knowledge for [${item.title}]:\n\n"""\n${item.content}\n"""\n\nPlease create a tailored marketing campaign.`)}`)
                  }
                  className="flex items-center gap-1 text-violet-600 font-semibold hover:underline"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Use in Chat</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Knowledge Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Add Business Knowledge</h3>
            <p className="text-xs text-slate-500 mb-4">
              Saved knowledge is permanently retained and can be injected into agent reasoning.
            </p>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Knowledge Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:outline-none focus:border-violet-500"
                >
                  <option value="Company Profile">Company Profile</option>
                  <option value="Brand Guidelines">Brand Guidelines</option>
                  <option value="Target Audience & ICP">Target Audience & ICP</option>
                  <option value="Product Offering">Product Offering</option>
                  <option value="Saved Research">Saved Research</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Acme Cloud Migration — Brand Tone & ICP Profile"
                  required
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Content & Details</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Paste company mission, target persona pain points, differentiators, or rules to abide by..."
                  rows={5}
                  required
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="b2b, cloud, enterprise, icp"
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTitle.trim() || !newContent.trim()}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Knowledge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
