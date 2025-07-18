
-- Create enhanced item master with realistic FG and RM data
INSERT INTO public.item_master (item_code, item_name, category_id, qualifier, gsm, size_mm, uom, usage_type, status, specifications) VALUES
-- Insert categories first if they don't exist
INSERT INTO public.categories (category_name, description) VALUES
('Paper', 'Various paper grades and types'),
('Film', 'Plastic films - BOPP, PET, etc'),
('Chemical', 'Chemicals and additives'),
('Adhesive', 'Adhesives and bonding agents'),
('Ink', 'Printing inks and colorants'),
('Solvent', 'Solvents and thinners'),
('Finished Goods', 'Final packaged products'),
('Packaging', 'Packaging materials')
ON CONFLICT (category_name) DO NOTHING;

-- Get category IDs for use in item master
WITH category_ids AS (
  SELECT id, category_name FROM categories
)
-- Insert realistic FG items based on screenshot patterns
INSERT INTO public.item_master (item_code, item_name, category_id, qualifier, gsm, size_mm, uom, usage_type, status, specifications) 
SELECT 
  item_code,
  item_name,
  cat.id,
  qualifier,
  gsm,
  size_mm,
  uom,
  usage_type,
  'active',
  specifications
FROM category_ids cat
CROSS JOIN (VALUES
  -- Finished Goods (matching screenshot complexity)
  ('FG_GCPL_SANTOOR_SOAP_75G', 'GCPL Santoor Soap Wrapper 75g', 'Finished Goods', 'GCPL_SANTOOR', 85, '180x120', 'PCS', 'FINISHED_GOOD', '{"customer": "GCPL", "product": "Santoor Soap", "size": "75g", "print_colors": 6, "structure": "BOPP/MDPE"}'),
  ('FG_GCPL_SANTOOR_SOAP_125G', 'GCPL Santoor Soap Wrapper 125g', 'Finished Goods', 'GCPL_SANTOOR', 90, '220x140', 'PCS', 'FINISHED_GOOD', '{"customer": "GCPL", "product": "Santoor Soap", "size": "125g", "print_colors": 6, "structure": "BOPP/MDPE"}'),
  ('FG_GCPL_VIM_LIQUID_500ML', 'GCPL Vim Liquid Pouch 500ml', 'Finished Goods', 'GCPL_VIM', 110, '200x280', 'PCS', 'FINISHED_GOOD', '{"customer": "GCPL", "product": "Vim Liquid", "size": "500ml", "print_colors": 8, "structure": "PET/PE/EVOH"}'),
  ('FG_FLEXIPACK_SNACK_POUCH', 'FlexiPack Snack Food Pouch', 'Finished Goods', 'FLEXIPACK', 95, '150x220', 'PCS', 'FINISHED_GOOD', '{"customer": "FlexiPack", "product": "Snack Pouch", "print_colors": 5, "structure": "BOPP/CPP"}'),
  ('FG_HIMALAYA_FACEWASH_100ML', 'Himalaya Face Wash Tube Label', 'Finished Goods', 'HIMALAYA', 75, '120x180', 'PCS', 'FINISHED_GOOD', '{"customer": "Himalaya", "product": "Face Wash", "size": "100ml", "print_colors": 4, "structure": "BOPP"}'),
  
  -- Raw Materials - Papers (matching screenshot patterns)
  ('PAPER_40_940_WHMGPOS', 'Paper 40 GSM 940mm White MG Poster', 'Paper', 'WHMGPOS', 40, '940', 'KG', 'RAW_MATERIAL', '{"grade": "MG Poster", "color": "White", "moisture": "7%", "cobb": "35"}'),
  ('PAPER_100_1020_CENT_AF', 'Paper 100 GSM 1020mm Centenary AF', 'Paper', 'CENT_AF', 100, '1020', 'KG', 'RAW_MATERIAL', '{"grade": "Centenary AF", "brightness": "82%", "smoothness": "120"}'),
  ('PAPER_80_940_MAPLE_WF', 'Paper 80 GSM 940mm Maple Writing/Printing', 'Paper', 'MAPLE_WF', 80, '940', 'KG', 'RAW_MATERIAL', '{"grade": "Writing/Printing", "opacity": "94%", "formation": "Good"}'),
  ('PAPER_120_1020_ROYAL_OFFSET', 'Paper 120 GSM 1020mm Royal Offset', 'Paper', 'ROYAL_OFFSET', 120, '1020', 'KG', 'RAW_MATERIAL', '{"grade": "Offset Printing", "brightness": "85%", "smoothness": "140"}'),
  
  -- Raw Materials - Films
  ('PET_14_940_UT', 'PET Film 14 Micron 940mm Untreated', 'Film', 'UT', 14, '940', 'KG', 'RAW_MATERIAL', '{"treatment": "Untreated", "clarity": "High", "tensile": "150 N/mm"}'),
  ('PET_12_1020_CORONA', 'PET Film 12 Micron 1020mm Corona Treated', 'Film', 'CORONA', 12, '1020', 'KG', 'RAW_MATERIAL', '{"treatment": "Corona", "surface_tension": "44 dynes", "haze": "1.5%"}'),
  ('BOPP_20_940_MATT', 'BOPP Film 20 Micron 940mm Matt Finish', 'Film', 'MATT', 20, '940', 'KG', 'RAW_MATERIAL', '{"finish": "Matt", "gloss": "15%", "cof": "0.4"}'),
  ('BOPP_25_1020_GLOSS', 'BOPP Film 25 Micron 1020mm Gloss Finish', 'Film', 'GLOSS', 25, '1020', 'KG', 'RAW_MATERIAL', '{"finish": "Gloss", "gloss": "85%", "transparency": "High"}'),
  ('CPP_30_940_SEALABLE', 'CPP Film 30 Micron 940mm Heat Sealable', 'Film', 'SEALABLE', 30, '940', 'KG', 'RAW_MATERIAL', '{"seal_temp": "130°C", "seal_strength": "2.5 N/15mm"}'),
  ('MDPE_40_1020_BARRIER', 'MDPE Film 40 Micron 1020mm Barrier Grade', 'Film', 'BARRIER', 40, '1020', 'KG', 'RAW_MATERIAL', '{"oxygen_transmission": "50 cc/m²/day", "moisture_transmission": "2 g/m²/day"}'),
  
  -- Raw Materials - Chemicals (matching screenshot patterns)
  ('CHEM_PEG_405', 'Chemical PEG 405 Grade', 'Chemical', 'PEG_405', null, null, 'KG', 'RAW_MATERIAL', '{"grade": "405", "molecular_weight": "405", "hydroxyl_value": "270-290"}'),
  ('CHEM_25KG_SUS_INTACE', 'Chemical 25kg SUS Interface Agent', 'Chemical', 'SUS_INTACE', null, null, 'KG', 'RAW_MATERIAL', '{"type": "Interface Agent", "package": "25kg", "solubility": "Water Soluble"}'),
  ('CHEM_TITANIUM_DIOXIDE', 'Titanium Dioxide Pigment', 'Chemical', 'TIO2', null, null, 'KG', 'RAW_MATERIAL', '{"grade": "Rutile", "tint_strength": "1900", "oil_absorption": "18"}'),
  ('CHEM_CALCIUM_CARBONATE', 'Calcium Carbonate Filler', 'Chemical', 'CACO3', null, null, 'KG', 'RAW_MATERIAL', '{"grade": "Precipitated", "particle_size": "0.7 micron", "brightness": "96%"}'),
  
  -- Raw Materials - Adhesives
  ('ADH_PU_2K_SOLVENT', 'Polyurethane 2K Solvent Based Adhesive', 'Adhesive', 'PU_2K', null, null, 'KG', 'RAW_MATERIAL', '{"type": "Two Component", "solids": "45%", "viscosity": "800 cps"}'),
  ('ADH_ACRYLIC_WB', 'Acrylic Water Based Adhesive', 'Adhesive', 'ACRYLIC_WB', null, null, 'KG', 'RAW_MATERIAL', '{"type": "Water Based", "solids": "38%", "ph": "8.5"}'),
  ('ADH_EVA_HOTMELT', 'EVA Hot Melt Adhesive', 'Adhesive', 'EVA_HM', null, null, 'KG', 'RAW_MATERIAL', '{"type": "Hot Melt", "softening_point": "95°C", "viscosity": "5000 cps"}'),
  
  -- Raw Materials - Inks
  ('INK_GRAVURE_CYAN', 'Gravure Ink Cyan Process', 'Ink', 'CYAN', null, null, 'KG', 'RAW_MATERIAL', '{"type": "Process Cyan", "viscosity": "18 sec", "color_strength": "100%"}'),
  ('INK_GRAVURE_MAGENTA', 'Gravure Ink Magenta Process', 'Ink', 'MAGENTA', null, null, 'KG', 'RAW_MATERIAL', '{"type": "Process Magenta", "viscosity": "18 sec", "color_strength": "100%"}'),
  ('INK_GRAVURE_YELLOW', 'Gravure Ink Yellow Process', 'Ink', 'YELLOW', null, null, 'KG', 'RAW_MATERIAL', '{"type": "Process Yellow", "viscosity": "18 sec", "color_strength": "100%"}'),
  ('INK_GRAVURE_BLACK', 'Gravure Ink Black Process', 'Ink', 'BLACK', null, null, 'KG', 'RAW_MATERIAL', '{"type": "Process Black", "viscosity": "18 sec", "color_strength": "100%"}'),
  ('INK_WHITE_OPAQUE', 'White Opaque Ink', 'Ink', 'WHITE_OP', null, null, 'KG', 'RAW_MATERIAL', '{"type": "White Opaque", "opacity": "98%", "viscosity": "20 sec"}'),
  
  -- Raw Materials - Solvents
  ('SOLVENT_ETHYL_ACETATE', 'Ethyl Acetate Solvent', 'Solvent', 'EA', null, null, 'LTR', 'RAW_MATERIAL', '{"purity": "99.5%", "boiling_point": "77°C", "evaporation_rate": "Fast"}'),
  ('SOLVENT_TOLUENE', 'Toluene Solvent', 'Solvent', 'TOLUENE', null, null, 'LTR', 'RAW_MATERIAL', '{"purity": "99.8%", "boiling_point": "111°C", "evaporation_rate": "Medium"}'),
  ('SOLVENT_IPA', 'Isopropyl Alcohol', 'Solvent', 'IPA', null, null, 'LTR', 'RAW_MATERIAL', '{"purity": "99.9%", "boiling_point": "82°C", "evaporation_rate": "Fast"}}')
) AS items(item_code, item_name, cat_name, qualifier, gsm, size_mm, uom, usage_type, specifications)
WHERE cat.category_name = items.cat_name
ON CONFLICT (item_code) DO NOTHING;

-- Create comprehensive BOM structure matching screenshot complexity
INSERT INTO public.bill_of_materials (fg_item_code, rm_item_code, quantity_required, unit_of_measure, consumption_rate, wastage_percentage, specifications) VALUES
-- GCPL Santoor Soap 75g BOM (Complex multi-layer structure)
('FG_GCPL_SANTOOR_SOAP_75G', 'BOPP_20_940_MATT', 0.85, 'KG', 1.0, 3.0, '{"layer": "Print Layer", "gsm_contribution": 17, "process": "Gravure Printing"}'),
('FG_GCPL_SANTOOR_SOAP_75G', 'MDPE_40_1020_BARRIER', 1.15, 'KG', 1.0, 2.5, '{"layer": "Barrier Layer", "gsm_contribution": 46, "process": "Extrusion Lamination"}'),
('FG_GCPL_SANTOOR_SOAP_75G', 'ADH_PU_2K_SOLVENT', 0.25, 'KG', 1.0, 5.0, '{"layer": "Adhesive", "gsm_contribution": 2.5, "process": "Lamination", "dry_weight": "2.5 gsm"}'),
('FG_GCPL_SANTOOR_SOAP_75G', 'INK_GRAVURE_CYAN', 0.08, 'KG', 1.0, 8.0, '{"color": "Cyan", "coverage": "15%", "process": "Gravure Printing"}'),
('FG_GCPL_SANTOOR_SOAP_75G', 'INK_GRAVURE_MAGENTA', 0.06, 'KG', 1.0, 8.0, '{"color": "Magenta", "coverage": "12%", "process": "Gravure Printing"}'),
('FG_GCPL_SANTOOR_SOAP_75G', 'INK_GRAVURE_YELLOW', 0.05, 'KG', 1.0, 8.0, '{"color": "Yellow", "coverage": "10%", "process": "Gravure Printing"}'),
('FG_GCPL_SANTOOR_SOAP_75G', 'INK_WHITE_OPAQUE', 0.12, 'KG', 1.0, 8.0, '{"color": "White", "coverage": "25%", "process": "Gravure Printing"}'),
('FG_GCPL_SANTOOR_SOAP_75G', 'SOLVENT_ETHYL_ACETATE', 0.15, 'LTR', 1.0, 12.0, '{"usage": "Ink Dilution", "evaporation": "95%"}'),

-- GCPL Santoor Soap 125g BOM (Similar but different quantities)
('FG_GCPL_SANTOOR_SOAP_125G', 'BOPP_25_1020_GLOSS', 1.05, 'KG', 1.0, 3.0, '{"layer": "Print Layer", "gsm_contribution": 26.25, "process": "Gravure Printing"}'),
('FG_GCPL_SANTOOR_SOAP_125G', 'MDPE_40_1020_BARRIER', 1.35, 'KG', 1.0, 2.5, '{"layer": "Barrier Layer", "gsm_contribution": 54, "process": "Extrusion Lamination"}'),
('FG_GCPL_SANTOOR_SOAP_125G', 'ADH_ACRYLIC_WB', 0.28, 'KG', 1.0, 4.0, '{"layer": "Adhesive", "gsm_contribution": 2.8, "process": "Lamination"}'),
('FG_GCPL_SANTOOR_SOAP_125G', 'INK_GRAVURE_CYAN', 0.09, 'KG', 1.0, 8.0, '{"color": "Cyan", "coverage": "15%"}'),
('FG_GCPL_SANTOOR_SOAP_125G', 'INK_GRAVURE_MAGENTA', 0.07, 'KG', 1.0, 8.0, '{"color": "Magenta", "coverage": "12%"}'),
('FG_GCPL_SANTOOR_SOAP_125G', 'INK_GRAVURE_YELLOW', 0.06, 'KG', 1.0, 8.0, '{"color": "Yellow", "coverage": "10%"}'),
('FG_GCPL_SANTOOR_SOAP_125G', 'INK_WHITE_OPAQUE', 0.14, 'KG', 1.0, 8.0, '{"color": "White", "coverage": "25%"}'),

-- GCPL Vim Liquid 500ml BOM (High barrier structure)
('FG_GCPL_VIM_LIQUID_500ML', 'PET_12_1020_CORONA', 0.95, 'KG', 1.0, 2.0, '{"layer": "Outer Layer", "gsm_contribution": 11.4, "process": "Gravure Printing"}'),
('FG_GCPL_VIM_LIQUID_500ML', 'ADH_PU_2K_SOLVENT', 0.35, 'KG', 1.0, 4.0, '{"layer": "Adhesive 1", "gsm_contribution": 3.5, "process": "Lamination"}'),
('FG_GCPL_VIM_LIQUID_500ML', 'MDPE_40_1020_BARRIER', 1.85, 'KG', 1.0, 2.0, '{"layer": "Barrier Layer", "gsm_contribution": 74, "process": "Extrusion"}'),
('FG_GCPL_VIM_LIQUID_500ML', 'CPP_30_940_SEALABLE', 1.25, 'KG', 1.0, 2.5, '{"layer": "Seal Layer", "gsm_contribution": 37.5, "process": "Extrusion Lamination"}'),
('FG_GCPL_VIM_LIQUID_500ML', 'INK_GRAVURE_CYAN', 0.12, 'KG', 1.0, 8.0, '{"color": "Cyan", "coverage": "18%"}'),
('FG_GCPL_VIM_LIQUID_500ML', 'INK_GRAVURE_MAGENTA', 0.10, 'KG', 1.0, 8.0, '{"color": "Magenta", "coverage": "15%"}'),
('FG_GCPL_VIM_LIQUID_500ML', 'INK_GRAVURE_YELLOW', 0.08, 'KG', 1.0, 8.0, '{"color": "Yellow", "coverage": "12%"}'),
('FG_GCPL_VIM_LIQUID_500ML', 'INK_GRAVURE_BLACK', 0.06, 'KG', 1.0, 8.0, '{"color": "Black", "coverage": "8%"}'),

-- FlexiPack Snack Pouch BOM
('FG_FLEXIPACK_SNACK_POUCH', 'BOPP_20_940_MATT', 0.75, 'KG', 1.0, 3.5, '{"layer": "Print Layer", "gsm_contribution": 15, "process": "Gravure Printing"}'),
('FG_FLEXIPACK_SNACK_POUCH', 'CPP_30_940_SEALABLE', 1.15, 'KG', 1.0, 2.0, '{"layer": "Seal Layer", "gsm_contribution": 34.5, "process": "Extrusion Lamination"}'),
('FG_FLEXIPACK_SNACK_POUCH', 'ADH_EVA_HOTMELT', 0.18, 'KG', 1.0, 3.0, '{"layer": "Adhesive", "gsm_contribution": 1.8, "process": "Hot Melt Application"}'),
('FG_FLEXIPACK_SNACK_POUCH', 'INK_GRAVURE_CYAN', 0.05, 'KG', 1.0, 8.0, '{"color": "Cyan", "coverage": "10%"}'),
('FG_FLEXIPACK_SNACK_POUCH', 'INK_GRAVURE_MAGENTA', 0.04, 'KG', 1.0, 8.0, '{"color": "Magenta", "coverage": "8%"}'),
('FG_FLEXIPACK_SNACK_POUCH', 'INK_GRAVURE_YELLOW', 0.06, 'KG', 1.0, 8.0, '{"color": "Yellow", "coverage": "12%"}'),
('FG_FLEXIPACK_SNACK_POUCH', 'INK_GRAVURE_BLACK', 0.03, 'KG', 1.0, 8.0, '{"color": "Black", "coverage": "5%"}'),

-- Himalaya Face Wash Tube Label BOM (Simple single layer)
('FG_HIMALAYA_FACEWASH_100ML', 'BOPP_25_1020_GLOSS', 1.0, 'KG', 1.0, 4.0, '{"layer": "Single Layer", "gsm_contribution": 25, "process": "Gravure Printing"}'),
('FG_HIMALAYA_FACEWASH_100ML', 'INK_GRAVURE_CYAN', 0.04, 'KG', 1.0, 8.0, '{"color": "Cyan", "coverage": "8%"}'),
('FG_HIMALAYA_FACEWASH_100ML', 'INK_GRAVURE_MAGENTA', 0.03, 'KG', 1.0, 8.0, '{"color": "Magenta", "coverage": "6%"}'),
('FG_HIMALAYA_FACEWASH_100ML', 'INK_GRAVURE_YELLOW', 0.02, 'KG', 1.0, 8.0, '{"color": "Yellow", "coverage": "4%"}'),
('FG_HIMALAYA_FACEWASH_100ML', 'INK_WHITE_OPAQUE', 0.08, 'KG', 1.0, 8.0, '{"color": "White", "coverage": "18%"}');

-- Create enhanced BOM groups for better organization
INSERT INTO public.bom_groups (group_name, group_code, description, display_order) VALUES
('GCPL Products', 'GCPL', 'GCPL customer specific products and variants', 1),
('FlexiPack Products', 'FLEXIPACK', 'FlexiPack customer specific products', 2),
('Himalaya Products', 'HIMALAYA', 'Himalaya customer specific products', 3),
('High Barrier Structures', 'BARRIER', 'Multi-layer high barrier packaging structures', 4),
('Simple Print Structures', 'SIMPLE', 'Single layer printed products', 5),
('Laminated Structures', 'LAMINATED', 'Multi-layer laminated structures', 6)
ON CONFLICT (group_code) DO NOTHING;

-- Update BOMs with group assignments
UPDATE public.bill_of_materials 
SET bom_group_id = (SELECT id FROM bom_groups WHERE group_code = 'GCPL')
WHERE fg_item_code LIKE 'FG_GCPL%';

UPDATE public.bill_of_materials 
SET bom_group_id = (SELECT id FROM bom_groups WHERE group_code = 'FLEXIPACK')
WHERE fg_item_code LIKE 'FG_FLEXIPACK%';

UPDATE public.bill_of_materials 
SET bom_group_id = (SELECT id FROM bom_groups WHERE group_code = 'HIMALAYA')
WHERE fg_item_code LIKE 'FG_HIMALAYA%';
