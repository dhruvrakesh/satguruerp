
import { useState, useCallback } from 'react';

export interface ExportProgress {
  isExporting: boolean;
  progress: number;
  currentChunk: number;
  totalChunks: number;
  recordsProcessed: number;
  totalRecords: number;
  estimatedTimeRemaining?: number;
}

export function useExportProgress() {
  const [progress, setProgress] = useState<ExportProgress>({
    isExporting: false,
    progress: 0,
    currentChunk: 0,
    totalChunks: 0,
    recordsProcessed: 0,
    totalRecords: 0
  });

  const startExport = useCallback((totalRecords: number, chunkSize: number = 1000) => {
    const totalChunks = Math.ceil(totalRecords / chunkSize);
    setProgress({
      isExporting: true,
      progress: 0,
      currentChunk: 0,
      totalChunks,
      recordsProcessed: 0,
      totalRecords
    });
  }, []);

  const updateProgress = useCallback((currentChunk: number, recordsProcessed: number) => {
    setProgress(prev => {
      const progress = (currentChunk / prev.totalChunks) * 100;
      return {
        ...prev,
        currentChunk,
        recordsProcessed,
        progress: Math.min(progress, 100)
      };
    });
  }, []);

  const finishExport = useCallback(() => {
    setProgress(prev => ({
      ...prev,
      isExporting: false,
      progress: 100
    }));
  }, []);

  const resetProgress = useCallback(() => {
    setProgress({
      isExporting: false,
      progress: 0,
      currentChunk: 0,
      totalChunks: 0,
      recordsProcessed: 0,
      totalRecords: 0
    });
  }, []);

  return {
    progress,
    startExport,
    updateProgress,
    finishExport,
    resetProgress
  };
}
