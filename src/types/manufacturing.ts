export interface Customer {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
}

export interface OrderSpecification {
  substrate_type: string;
  substrate_width: number;
  substrate_length: number;
  color_count: number;
  print_colors: string[];
  quantity: number;
  unit: string;
  dimensions: {
    width: number;
    height: number;
    thickness?: number;
  };
  special_instructions?: string;
}

export interface ManufacturingOrder {
  id: string;
  uiorn: string;
  customer_name: string;
  customer_code?: string;
  order_date: string;
  delivery_date?: string;
  order_quantity: number;
  unit_of_measure?: string;
  product_description: string;
  special_instructions?: string;
  priority_level?: string;
  status: 'PENDING' | 'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  assigned_to?: string;
}

export interface ProcessStage {
  stage: 'artwork_upload' | 'gravure_printing' | 'lamination' | 'adhesive_coating' | 'slitting' | 'packaging';
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold';
  started_at?: string;
  completed_at?: string;
  operator_id?: string;
  machine_id?: string;
  quality_checks?: QualityCheck[];
}

export interface QualityCheck {
  id: string;
  checkpoint_type: string;
  test_parameters: Record<string, any>;
  test_results: Record<string, any>;
  passed: boolean;
  inspector_id: string;
  remarks?: string;
  tested_at: string;
}

export interface Machine {
  id: string;
  machine_id: string;
  name: string;
  type: 'printing' | 'lamination' | 'slitting' | 'coating' | 'packaging';
  status: 'available' | 'busy' | 'maintenance' | 'offline';
  current_order_id?: string;
}

export interface Operator {
  id: string;
  name: string;
  employee_code: string;
  skills: string[];
  current_assignment?: {
    order_id: string;
    stage: string;
    machine_id?: string;
  };
}

export interface WorkflowBottleneck {
  stage: string;
  avg_processing_time: number;
  pending_orders: number;
  bottleneck_score: number;
}

export interface OrderProgress {
  uiorn: string;
  progress_percentage: number;
  current_stage: string;
  estimated_completion: string;
}