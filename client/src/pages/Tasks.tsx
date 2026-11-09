import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ListTodo,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  ArrowRight,
  Bot
} from 'lucide-react';
import { api } from '../services/api';
import { Task, TaskStatus } from '../types';

export const Tasks: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newInstruction, setNewInstruction] = useState('');
  const [newCategory, setNewCategory] = useState('Research & Market Analysis');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTasks = async () => {
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstruction.trim()) return;

    setIsSubmitting(true);
    try {
      await api.createTask(newInstruction.trim(), newCategory);
      setNewInstruction('');
      setIsModalOpen(false);
      await loadTasks();
    } catch (err: any) {
      alert('Failed to create task: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Completed
          </span>
        );
      case 'running':
      case 'planning':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
            <PlayCircle className="w-3 h-3 text-violet-600 animate-spin" />
            In Progress
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-3 h-3 text-red-600" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" />
            Pending
          </span>
        );
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'pending') return t.status === 'pending' || t.status === 'running';
    if (filter === 'completed') return t.status === 'completed';
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Tasks & Workflows</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">
              {tasks.length} total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track multi-step agent executions and saved task results in persistent storage.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-sm transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-md font-medium transition ${
            filter === 'all'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All ({tasks.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-3 py-1.5 rounded-md font-medium transition ${
            filter === 'pending'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Pending ({tasks.filter(t => t.status === 'pending' || t.status === 'running').length})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-3 py-1.5 rounded-md font-medium transition ${
            filter === 'completed'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Completed ({tasks.filter(t => t.status === 'completed').length})
        </button>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center">
          <ListTodo className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800">No tasks found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            You don't have any tasks in this view. Create one now or start a task from the AI Agent Workspace.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 px-3.5 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition"
          >
            Create Your First Task
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  {getStatusBadge(task.status)}
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {task.category}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(task.startTime).toLocaleDateString()} {new Date(task.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-slate-900 leading-snug">
                  {task.instruction}
                </h4>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() =>
                    navigate(`/workspace?prompt=${encodeURIComponent(task.instruction)}`)
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-violet-400 hover:bg-violet-50 text-slate-700 hover:text-violet-700 text-xs font-medium transition"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Execute in Chat</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Create New Marketing Task</h3>
            <p className="text-xs text-slate-500 mb-4">
              Save an instruction into MarketMate AI's persistent task registry.
            </p>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:outline-none focus:border-violet-500"
                >
                  <option value="Research & Market Analysis">Research & Market Analysis</option>
                  <option value="SEO & Technical Audit">SEO & Technical Audit</option>
                  <option value="Email Marketing Campaign">Email Marketing Campaign</option>
                  <option value="Content Creation & Social">Content Creation & Social</option>
                  <option value="Reporting & Analytics">Reporting & Analytics</option>
                  <option value="General Strategy">General Strategy</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Instruction
                </label>
                <textarea
                  value={newInstruction}
                  onChange={(e) => setNewInstruction(e.target.value)}
                  placeholder="e.g. Conduct a full keyword gap analysis against top 3 competitors in cloud cybersecurity..."
                  rows={4}
                  required
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
                  disabled={isSubmitting || !newInstruction.trim()}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
