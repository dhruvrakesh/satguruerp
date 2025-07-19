
// Bridge function to match the expected generateItemCode interface
// This provides backward compatibility while handling null/undefined parameters

export const generateItemCode = (
  category_prefix: string | null | undefined,
  usage_type_prefix: string | null | undefined,
  thickness: number,
  width: number,
  length: number | null | undefined,
  material_type_code: string | null | undefined
): string => {
  // DEFENSIVE: Handle null/undefined inputs gracefully
  try {
    const catPrefix = (category_prefix || 'CAT').replace(/\s+/g, '').slice(0, 3);
    const usagePrefix = (usage_type_prefix || 'USE').replace(/\s+/g, '').slice(0, 3);
    
    // Validate numeric inputs
    const safeThickness = isNaN(thickness) ? 0 : Math.max(0, thickness);
    const safeWidth = isNaN(width) ? 0 : Math.max(0, width);
    const safeLength = (!length || isNaN(length)) ? 0 : Math.max(0, length);
    
    const thicknessStr = safeThickness.toString().padStart(3, '0');
    const widthStr = safeWidth.toString().padStart(4, '0');
    const lengthStr = safeLength.toString().padStart(4, '0');
    const materialStr = (material_type_code || 'MAT').slice(0, 3).toUpperCase();

    const generatedCode = `${catPrefix}-${usagePrefix}-${thicknessStr}T${widthStr}W${lengthStr}L-${materialStr}`;
    
    console.log('Generated item code:', generatedCode, {
      category_prefix,
      usage_type_prefix,
      thickness,
      width,
      length,
      material_type_code
    });
    
    return generatedCode;
  } catch (error) {
    console.error('Error generating item code:', error);
    // Return a safe fallback code
    return 'GEN-CODE-000T0000W0000L-MAT';
  }
};

// Export for backward compatibility
export default generateItemCode;
