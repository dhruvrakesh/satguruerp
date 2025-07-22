
// Manufacturing Configuration - Single Source of Truth
export const MANUFACTURING_CONFIG = {
  // Process Stage Mappings
  PROCESS_STAGES: {
    ARTWORK_UPLOAD: 'artwork_upload',
    GRAVURE_PRINTING: 'gravure_printing', 
    LAMINATION: 'lamination',
    ADHESIVE_COATING: 'adhesive_coating',
    SLITTING: 'slitting',
    PACKAGING: 'packaging'
  } as const,

  // Status Enums aligned with database
  PROCESS_STATUS: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    ON_HOLD: 'on_hold',
    CANCELLED: 'cancelled'
  } as const,

  // Product Types for Flexible Packaging
  PRODUCT_TYPES: {
    SOAP_WRAPPER: 'SOAP_WRAPPER',
    STIFFENER: 'STIFFENER', 
    LAMINATE: 'LAMINATE',
    TAPE: 'TAPE',
    POUCH: 'POUCH',
    LABEL: 'LABEL'
  } as const,

  // Substrate Materials
  SUBSTRATE_MATERIALS: {
    BOPP: 'BOPP',
    PET: 'PET',
    PE: 'PE',
    PAPER: 'PAPER',
    FOIL: 'FOIL',
    LAMINATE: 'LAMINATE'
  } as const,

  // Quality Parameters by Product Type
  QUALITY_STANDARDS: {
    SOAP_WRAPPER: {
      thickness_tolerance_microns: 2,
      width_tolerance_mm: 0.5,
      color_delta_e_max: 2.0,
      moisture_barrier_required: true
    },
    STIFFENER: {
      thickness_tolerance_microns: 5,
      rigidity_min_mpa: 1500,
      surface_smoothness_ra_max: 1.6
    },
    LAMINATE: {
      bond_strength_min_n_15mm: 3.0,
      delamination_force_min_n: 5.0,
      thickness_tolerance_microns: 3
    },
    TAPE: {
      adhesion_strength_min_n_inch: 12,
      release_force_max_n: 2.0,
      thickness_tolerance_microns: 2
    }
  } as const,

  // Machine Specifications
  MACHINE_TYPES: {
    GRAVURE_PRINTING: {
      max_width_mm: 1200,
      max_speed_mpm: 300,
      min_substrate_thickness: 12,
      max_substrate_thickness: 100
    },
    LAMINATION: {
      max_width_mm: 1100,
      max_speed_mpm: 250,
      temperature_range_c: [40, 120]
    },
    SLITTING: {
      max_width_mm: 1200,
      max_speed_mpm: 500,
      min_finished_width_mm: 10
    }
  } as const
};

// Type definitions derived from config
export type ProcessStage = typeof MANUFACTURING_CONFIG.PROCESS_STAGES[keyof typeof MANUFACTURING_CONFIG.PROCESS_STAGES];
export type ProcessStatus = typeof MANUFACTURING_CONFIG.PROCESS_STATUS[keyof typeof MANUFACTURING_CONFIG.PROCESS_STATUS];
export type ProductType = typeof MANUFACTURING_CONFIG.PRODUCT_TYPES[keyof typeof MANUFACTURING_CONFIG.PRODUCT_TYPES];
export type SubstrateMaterial = typeof MANUFACTURING_CONFIG.SUBSTRATE_MATERIALS[keyof typeof MANUFACTURING_CONFIG.SUBSTRATE_MATERIALS];
