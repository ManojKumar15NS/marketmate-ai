import React from 'react';
import { CheckCircle2, Clock, Loader2, Wrench, ChevronDown, ChevronUp } from 'lucide-react';

interface TaskProgressProps {
  plan?: string[];
  toolCalls?: Array<{
    tool: string;
    args: any;
    success?: boolean;
    result?: any;
  }>;
  status?: string;
  isStreaming?: boolean;
}

export const TaskProgress: React.FC<TaskProgressProps> = ({
  plan = [],
  toolCalls = [],
  status,
  isStreaming
}) => {
  const [expanded, setExpanded] = React.useState(true);

  if (plan.length === 0 && toolCalls.length === 0) return null;

  return (
    <div className="my-4 rounded-xl border border-violet-200/80 bg-violet-50/50 overflow-hidden shadow-sm text-xs">
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="px-4 py-2.5 bg-violet-100/60 border-b border-violet-200/60 flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-violet-700" />
          <span className="font-bold text-violet-900">AI Agent Orchestrator</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-200 text-violet-800 font-semibold">
            {isStreaming ? 'Executing Workflow...' : 'Execution Plan'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-violet-700">
          <span className="text-[11px] font-medium">
            {toolCalls.length} tool{toolCalls.length === 1 ? '' : 's'} executed
          </span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </div>

      {/* Plan Steps */}
      {expanded && (
        <div className="p-4 space-y-3">
          {plan.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-800/80 mb-2">
                Execution Steps
              </p>
              <div className="space-y-1.5">
                {plan.map((step, idx) => {
                  const isDone = !isStreaming || idx < toolCalls.length;
                  const isCurrent = isStreaming && idx === toolCalls.length;

                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-2.5 p-2 rounded-lg transition ${
                        isCurrent
                          ? 'bg-white border border-violet-300 shadow-sm text-violet-950 font-semibold'
                          : isDone
                          ? 'bg-white/60 text-slate-700'
                          : 'text-slate-400'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : isCurrent ? (
                          <Loader2 className="w-3.5 h-3.5 text-violet-600 animate-spin" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-slate-300" />
                        )}
                      </div>
                      <span className="text-xs leading-relaxed">
                        <span className="font-mono text-[11px] opacity-70 mr-1.5">{idx + 1}.</span>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Executed Tools Details */}
          {toolCalls.length > 0 && (
            <div className="pt-2 border-t border-violet-200/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-800/80 mb-2">
                Tool Execution Audit
              </p>
              <div className="space-y-1.5">
                {toolCalls.map((tc, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-md bg-white border border-slate-200/80 text-[11px] space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-violet-700 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-600" />
                        {tc.tool}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                          tc.success !== false
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {tc.success !== false ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    {tc.args && (
                      <p className="text-slate-500 font-mono text-[10px] truncate">
                        args: {JSON.stringify(tc.args)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
