
import { useState, useEffect } from 'react';
import { useManufacturing } from '@/contexts/ManufacturingContext';
import { MANUFACTURING_CONFIG } from '@/config/manufacturing';
import type { ProcessStage, ProcessStatus, ProductType } from '@/config/manufacturing';

interface ProcessData {
  stage: ProcessStage;
  status: ProcessStatus;
  progress: number;
  parameters: any;
  qualityMetrics: any;
  startedAt?: string;
  completedAt?: string;
}

export function useManufacturingProcess(orderId: string, productType: ProductType) {
  const { state, updateProcessStatus, updateProcessParameters, getQualityStandards } = useManufacturing();
  const [processData, setProcessData] = useState<Record<ProcessStage, ProcessData>>({} as any);

  // Initialize process data
  useEffect(() => {
    const stages = Object.values(MANUFACTURING_CONFIG.PROCESS_STAGES);
    const initialData: Record<ProcessStage, ProcessData> = {} as any;
    
    stages.forEach(stage => {
      initialData[stage] = {
        stage,
        status: MANUFACTURING_CONFIG.PROCESS_STATUS.PENDING,
        progress: 0,
        parameters: {},
        qualityMetrics: {}
      };
    });
    
    setProcessData(initialData);
  }, [orderId]);

  const updateStageStatus = (stage: ProcessStage, status: ProcessStatus) => {
    setProcessData(prev => ({
      ...prev,
      [stage]: {
        ...prev[stage],
        status,
        ...(status === MANUFACTURING_CONFIG.PROCESS_STATUS.IN_PROGRESS && { startedAt: new Date().toISOString() }),
        ...(status === MANUFACTURING_CONFIG.PROCESS_STATUS.COMPLETED && { completedAt: new Date().toISOString(), progress: 100 })
      }
    }));
    
    updateProcessStatus(orderId, stage, status);
  };

  const updateStageParameters = (stage: ProcessStage, parameters: any) => {
    setProcessData(prev => ({
      ...prev,
      [stage]: {
        ...prev[stage],
        parameters
      }
    }));
    
    updateProcessParameters(orderId, stage, parameters);
  };

  const validateQuality = (stage: ProcessStage, metrics: any) => {
    const standards = getQualityStandards(productType);
    // Quality validation logic
    return true;
  };

  const getNextStage = (currentStage: ProcessStage): ProcessStage | null => {
    const stages = Object.values(MANUFACTURING_CONFIG.PROCESS_STAGES);
    const currentIndex = stages.indexOf(currentStage);
    return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
  };

  const getOverallProgress = () => {
    const stages = Object.values(processData);
    const totalProgress = stages.reduce((sum, stage) => sum + stage.progress, 0);
    return Math.round(totalProgress / stages.length);
  };

  return {
    processData,
    updateStageStatus,
    updateStageParameters,
    validateQuality,
    getNextStage,
    getOverallProgress,
    qualityStandards: getQualityStandards(productType)
  };
}
