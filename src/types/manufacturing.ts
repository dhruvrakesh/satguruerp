
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

// Enhanced process stages for flexible packaging
export interface ProcessStage {
  stage: 'artwork_upload' | 'gravure_printing' | 'lamination' | 'adhesive_coating' | 'slitting' | 'packaging';
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold';
  started_at?: string;
  completed_at?: string;
  operator_id?: string;
  machine_id?: string;
  quality_checks?: QualityCheck[];
  // Enhanced for flexible packaging
  process_parameters?: FlexiblePackagingParameters;
  substrate_specifications?: SubstrateSpecification;
  quality_metrics?: QualityMetrics;
}

// New interfaces for flexible packaging industry
export interface SubstrateSpecification {
  material_type: 'BOPP' | 'PET' | 'PE' | 'PAPER' | 'FOIL' | 'LAMINATE';
  thickness_microns: number;
  width_mm: number;
  treatment: 'CORONA' | 'PRIMER' | 'NONE';
  grade: string;
  supplier: string;
  batch_number?: string;
  roll_diameter?: number;
  core_size?: number;
}

export interface FlexiblePackagingParameters {
  // Gravure printing parameters
  printing?: {
    line_speed_mpm: number;
    impression_pressure_bar: number;
    drying_temperature_c: number;
    ink_viscosity_sec: number;
    solvent_ratio: string;
    registration_tolerance_mm: number;
    cylinder_pressure: number;
  };
  
  // Lamination parameters
  lamination?: {
    nip_pressure_n_cm: number;
    laminating_temperature_c: number;
    line_speed_mpm: number;
    adhesive_coat_weight_gsm: number;
    curing_temperature_c: number;
    bond_strength_n_15mm: number;
  };
  
  // Coating parameters
  coating?: {
    coating_weight_gsm: number;
    drying_temperature_c: number;
    coating_speed_mpm: number;
    viscosity_sec: number;
    coat_thickness_microns: number;
  };
  
  // Slitting parameters
  slitting?: {
    slitting_speed_mpm: number;
    knife_pressure: number;
    rewind_tension_n: number;
    trim_width_mm: number;
    finished_width_mm: number;
    roll_length_m: number;
  };
}

export interface QualityMetrics {
  color_accuracy?: {
    delta_e: number;
    l_value: number;
    a_value: number;
    b_value: number;
  };
  
  lamination_quality?: {
    bond_strength_n_15mm: number;
    bubble_count_per_sqm: number;
    delamination_force_n: number;
  };
  
  coating_quality?: {
    coat_weight_gsm: number;
    coat_uniformity_percentage: number;
    adhesion_rating: number;
  };
  
  dimensional_accuracy?: {
    width_variance_mm: number;
    thickness_variance_microns: number;
    length_accuracy_percentage: number;
  };
  
  surface_quality?: {
    gloss_units: number;
    smoothness_rating: number;
    contamination_count: number;
  };
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
  // Enhanced for flexible packaging
  quality_metrics?: QualityMetrics;
  corrective_action?: string;
  deviation_approved_by?: string;
}

export interface Machine {
  id: string;
  machine_id: string;
  name: string;
  type: 'printing' | 'lamination' | 'slitting' | 'coating' | 'packaging';
  status: 'available' | 'busy' | 'maintenance' | 'offline';
  current_order_id?: string;
  // Enhanced for flexible packaging
  specifications?: {
    max_width_mm: number;
    max_speed_mpm: number;
    min_substrate_thickness_microns: number;
    max_substrate_thickness_microns: number;
    supported_materials: string[];
  };
  maintenance_schedule?: {
    last_maintenance: string;
    next_maintenance: string;
    maintenance_hours: number;
  };
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
  // Enhanced for flexible packaging
  certifications?: string[];
  skill_level: 'TRAINEE' | 'OPERATOR' | 'SENIOR_OPERATOR' | 'SPECIALIST';
  shift: 'DAY' | 'NIGHT' | 'GENERAL';
}

export interface WorkflowBottleneck {
  stage: string;
  avg_processing_time: number;
  pending_orders: number;
  bottleneck_score: number;
  // Enhanced analysis
  capacity_utilization: number;
  efficiency_percentage: number;
  suggested_action: string;
}

export interface OrderProgress {
  uiorn: string;
  progress_percentage: number;
  current_stage: string;
  estimated_completion: string;
  // Enhanced tracking
  material_consumption: {
    planned_kg: number;
    actual_kg: number;
    waste_kg: number;
    yield_percentage: number;
  };
  quality_status: 'PENDING' | 'PASSED' | 'FAILED' | 'UNDER_REVIEW';
  cost_tracking: {
    material_cost: number;
    labor_cost: number;
    overhead_cost: number;
    total_cost: number;
  };
}

// New interfaces for flexible packaging specific features
export interface PackagingProduct {
  type: 'SOAP_WRAPPER' | 'STIFFENER' | 'LAMINATE' | 'TAPE' | 'POUCH' | 'LABEL';
  specifications: {
    dimensions: {
      length_mm: number;
      width_mm: number;
      thickness_microns?: number;
    };
    barrier_properties?: {
      moisture_barrier: boolean;
      oxygen_barrier: boolean;
      aroma_barrier: boolean;
    };
    performance_requirements?: {
      heat_sealability: boolean;
      printability_grade: string;
      opacity_percentage?: number;
      gloss_level?: string;
    };
  };
}

export interface CylinderManagement {
  cylinder_id: string;
  job_code: string;
  circumference_mm: number;
  repeat_length_mm: number;
  depth_microns: number;
  chrome_thickness_microns: number;
  current_mileage_m: number;
  max_mileage_m: number;
  maintenance_due: boolean;
  storage_location: string;
  quality_grade: 'A' | 'B' | 'C';
}

export interface MaterialConsumption {
  uiorn: string;
  material_code: string;
  planned_consumption_kg: number;
  actual_consumption_kg: number;
  waste_kg: number;
  waste_reason?: string;
  yield_percentage: number;
  cost_per_kg: number;
  total_cost: number;
  stage: string;
  recorded_by: string;
  recorded_at: string;
}
