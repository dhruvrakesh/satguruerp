
export interface MaterialFlowEntry {
  id?: string;
  uiorn: string;
  process_stage: string;
  input_material_type: string;
  input_quantity: number;
  input_unit: string;
  input_source_process?: string;
  output_good_quantity: number;
  output_rework_quantity: number;
  output_waste_quantity: number;
  waste_classification: 'SETUP_WASTE' | 'EDGE_TRIM' | 'DEFECTIVE' | 'CONTAMINATED' | 'OTHER';
  rework_reason?: string;
  yield_percentage: number;
  material_cost_per_unit: number;
  total_input_cost: number;
  waste_cost_impact: number;
  quality_grade: 'GRADE_A' | 'GRADE_B' | 'REWORK' | 'WASTE';
  operator_id?: string;
  recorded_at: string;
  notes?: string;
  // Enhanced fields for process chain integration
  lot_number?: string;
  batch_id?: string;
  material_genealogy?: string; // JSON tracking material origins
  process_parameters?: any; // Process-specific parameters
  quality_checkpoints?: any; // Quality control data
}

export interface ProcessTransfer {
  id?: string;
  uiorn: string;
  from_process: string;
  to_process: string;
  material_type: string;
  quantity_sent: number;
  quantity_received?: number;
  unit_of_measure: string;
  transfer_status: 'INITIATED' | 'IN_TRANSIT' | 'RECEIVED' | 'DISCREPANCY';
  sent_by?: string;
  received_by?: string;
  sent_at: string;
  received_at?: string;
  discrepancy_notes?: string;
  quality_notes?: string;
  // Enhanced fields
  lot_number?: string;
  quality_grade?: 'GRADE_A' | 'GRADE_B' | 'REWORK' | 'WASTE';
  material_condition?: string;
  transfer_temperature?: number;
  transfer_humidity?: number;
}

export interface MaterialGenealogyTrace {
  material_id: string;
  uiorn: string;
  process_stage: string;
  input_materials: string[]; // Array of source material IDs
  output_materials: string[]; // Array of resulting material IDs
  transformation_data: any; // Process-specific transformation info
  timestamp: string;
}

export interface ProcessChainSummary {
  uiorn: string;
  total_input_cost: number;
  total_waste_cost: number;
  overall_yield_percentage: number;
  process_efficiencies: {
    [process: string]: {
      yield: number;
      waste_percentage: number;
      cost_per_kg: number;
    };
  };
  bottlenecks: string[];
  quality_issues: string[];
}

export interface RealTimeMaterialStatus {
  uiorn: string;
  current_process: string;
  available_materials: {
    material_type: string;
    quantity: number;
    unit: string;
    quality_grade: string;
    location: string;
  }[];
  pending_transfers: ProcessTransfer[];
  next_process_ready: boolean;
  estimated_completion: string;
}
