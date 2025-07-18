// Global type definitions
export interface AuthError {
  message: string;
  code?: string;
}

export interface AuthResponse {
  error?: AuthError | null;
}

export interface BulkUploadError {
  rowNumber: number;
  reason: string;
  data: Record<string, string>;
}

export interface BulkUploadResult {
  successCount: number;
  errorCount: number;
  errors: BulkUploadError[];
}

export interface CSVRowData {
  [key: string]: string;
}

export interface DatabaseError extends Error {
  code?: string;
  details?: string;
  hint?: string;
}

// Process Stage Types
export type ProcessStage = 'GRAVURE_PRINTING' | 'PRINTING' | 'LAMINATION' | 'ADHESIVE_COATING' | 'SLITTING' | 'DISPATCH';

// Artwork and Cylinder Data
export interface CylinderData {
  id?: string;
  cylinder_code: string;
  cylinder_name?: string;
  colour: string;
  cylinder_size?: number;
  type: string;
  manufacturer?: string;
  location?: string;
  mileage_m: number;
  last_run?: string;
  remarks?: string;
  item_code: string;
  customer_name?: string;
  created_at?: string;
}

// BOM and Material Consumption
export interface BOMGroup {
  id: string;
  group_name: string;
  group_code: string;
  description?: string;
  display_order: number;
  is_active: boolean;
}

export interface MaterialConsumption {
  id: string;
  uiorn: string;
  rm_item_code: string;
  process_stage: ProcessStage;
  planned_quantity: number;
  actual_quantity: number;
  wastage_quantity: number;
  unit_cost: number;
  total_cost: number;
  consumed_at: string;
  recorded_by?: string;
  notes?: string;
}

// Enhanced BOM with group reference
export interface BillOfMaterials {
  id: string;
  fg_item_code: string;
  rm_item_code: string;
  quantity_required: number;
  unit_of_measure: string;
  bom_group_id?: string;
  consumption_rate?: number;
  wastage_percentage?: number;
  specifications?: any;
}

// Satguru Cylinder Management
export interface SatguruCylinder {
  id: string;
  cylinder_code: string;
  item_code: string;
  cylinder_name: string;
  colour: string;
  cylinder_size?: number;
  type: string;
  manufacturer?: string;
  location?: string;
  mileage_m: number;
  last_run?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}