import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { BackgroundJob } from '../types';
import { api } from '../services/api';

interface JobContextType {
  jobs: BackgroundJob[];
  activeCount: number;
  isPanelOpen: boolean;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  startJob: (agentId: BackgroundJob['agentId'], input: any, options?: { companyId?: string; researchId?: string }) => Promise<BackgroundJob>;
  cancelJob: (jobId: string) => Promise<void>;
  retryJob: (jobId: string) => Promise<BackgroundJob>;
  getJob: (jobId: string) => BackgroundJob | undefined;
  getActiveJobForAgent: (agentId: BackgroundJob['agentId']) => BackgroundJob | undefined;
  refreshJobs: () => Promise<void>;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export const JobProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const refreshJobs = useCallback(async () => {
    try {
      const res = await api.listJobs();
      if (res && res.success && Array.isArray(res.data)) {
        setJobs(res.data);
      }
    } catch (err) {
      console.warn('[JobContext] Could not fetch jobs:', err);
    }
  }, []);

  // Real-time EventSource connection + polling resilience
  useEffect(() => {
    refreshJobs();

    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    try {
      eventSource = new EventSource(api.getAllJobsStreamUrl());

      eventSource.onmessage = (event) => {
        try {
          const updatedJob: BackgroundJob = JSON.parse(event.data);
          setJobs((prev) => {
            const index = prev.findIndex((j) => j.jobId === updatedJob.jobId);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = updatedJob;
              return updated;
            }
            return [updatedJob, ...prev];
          });
        } catch (e) {
          console.warn('[JobContext] SSE parse error:', e);
        }
      };

      eventSource.onerror = () => {
        // Fall back to polling every 3 seconds if SSE connection drops
        if (!pollInterval) {
          pollInterval = setInterval(refreshJobs, 3000);
        }
      };
    } catch {
      pollInterval = setInterval(refreshJobs, 3000);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [refreshJobs]);

  const startJob = async (
    agentId: BackgroundJob['agentId'],
    input: any,
    options?: { companyId?: string; researchId?: string }
  ): Promise<BackgroundJob> => {
    const res = await api.startJob(agentId, input, options);
    if (!res.success) {
      throw new Error('Failed to start background job');
    }
    const newJob = res.data;
    setJobs((prev) => [newJob, ...prev.filter((j) => j.jobId !== newJob.jobId)]);
    return newJob;
  };

  const cancelJob = async (jobId: string): Promise<void> => {
    await api.cancelJob(jobId);
    setJobs((prev) =>
      prev.map((j) =>
        j.jobId === jobId
          ? { ...j, status: 'cancelled', currentStage: 'Cancelled by user', completedAt: new Date().toISOString() }
          : j
      )
    );
  };

  const retryJob = async (jobId: string): Promise<BackgroundJob> => {
    const res = await api.retryJob(jobId);
    if (!res.success) throw new Error('Failed to retry job');
    const retried = res.data;
    setJobs((prev) => prev.map((j) => (j.jobId === jobId ? retried : j)));
    return retried;
  };

  const getJob = (jobId: string) => jobs.find((j) => j.jobId === jobId);

  const getActiveJobForAgent = (agentId: BackgroundJob['agentId']) =>
    jobs.find((j) => j.agentId === agentId && (j.status === 'running' || j.status === 'queued'));

  const activeCount = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length;

  return (
    <JobContext.Provider
      value={{
        jobs,
        activeCount,
        isPanelOpen,
        togglePanel: () => setIsPanelOpen((prev) => !prev),
        openPanel: () => setIsPanelOpen(true),
        closePanel: () => setIsPanelOpen(false),
        startJob,
        cancelJob,
        retryJob,
        getJob,
        getActiveJobForAgent,
        refreshJobs
      }}
    >
      {children}
    </JobContext.Provider>
  );
};

export const useJobs = (): JobContextType => {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error('useJobs must be used within a JobProvider');
  }
  return context;
};
