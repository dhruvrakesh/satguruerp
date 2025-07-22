
import React, { createContext, useContext, useState, useEffect } from 'react';
import { MANUFACTURING_CONFIG } from '@/config/manufacturing';
import type { ProcessStage, ProcessStatus, ProductType } from '@/config/manufacturing';

interface ManufacturingState {
  activeOrders: any[];
  processParameters: Record<string, any>;
  qualityMetrics: Record<string, any>;
  materialSpecifications: Record<string, any>;
}

interface ManufacturingContextType {
  state: ManufacturingState;
  updateProcessStatus: (orderId: string, stage: ProcessStage, status: ProcessStatus) => void;
  updateProcessParameters: (orderId: string, stage: ProcessStage, parameters: any) => void;
  updateQualityMetrics: (orderId: string, stage: ProcessStage, metrics: any) => void;
  getQualityStandards: (productType: ProductType) => any;
  isStageCompleted: (orderId: string, stage: ProcessStage) => boolean;
}

const ManufacturingContext = createContext<ManufacturingContextType | undefined>(undefined);

export function ManufacturingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ManufacturingState>({
    activeOrders: [],
    processParameters: {},
    qualityMetrics: {},
    materialSpecifications: {}
  });

  const updateProcessStatus = (orderId: string, stage: ProcessStage, status: ProcessStatus) => {
    console.log(`Updating ${orderId} - ${stage} to ${status}`);
    // Implementation for real-time status updates
  };

  const updateProcessParameters = (orderId: string, stage: ProcessStage, parameters: any) => {
    setState(prev => ({
      ...prev,
      processParameters: {
        ...prev.processParameters,
        [`${orderId}-${stage}`]: parameters
      }
    }));
  };

  const updateQualityMetrics = (orderId: string, stage: ProcessStage, metrics: any) => {
    setState(prev => ({
      ...prev,
      qualityMetrics: {
        ...prev.qualityMetrics,
        [`${orderId}-${stage}`]: metrics
      }
    }));
  };

  const getQualityStandards = (productType: ProductType) => {
    return MANUFACTURING_CONFIG.QUALITY_STANDARDS[productType] || {};
  };

  const isStageCompleted = (orderId: string, stage: ProcessStage) => {
    // Logic to check if stage is completed
    return false;
  };

  return (
    <ManufacturingContext.Provider value={{
      state,
      updateProcessStatus,
      updateProcessParameters,
      updateQualityMetrics,
      getQualityStandards,
      isStageCompleted
    }}>
      {children}
    </ManufacturingContext.Provider>
  );
}

export function useManufacturing() {
  const context = useContext(ManufacturingContext);
  if (context === undefined) {
    throw new Error('useManufacturing must be used within a ManufacturingProvider');
  }
  return context;
}
