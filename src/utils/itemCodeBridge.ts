
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
  // FIX: Default to meaningful fallbacks if prefixes are null or undefined
  const catPrefix = (category_prefix || 'CAT').replace(/\s+/g, '');
  const usagePrefix = (usage_type_prefix || 'USE').replace(/\s+/g, '');
  
  const thicknessStr = thickness.toString().padStart(3, '0');
  const widthStr = width.toString().padStart(4, '0');
  // FIX: Handle null or zero length for items that don't have a length
  const lengthStr = length ? length.toString().padStart(4, '0') : '0000'; 
  const materialStr = (material_type_code || 'MAT').slice(0, 3).toUpperCase();

  return `${catPrefix}-${usagePrefix}-${thicknessStr}T${widthStr}W${lengthStr}L-${materialStr}`;
};

// Export for backward compatibility
export default generateItemCode;
