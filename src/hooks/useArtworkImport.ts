import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ArtworkItem {
  item_code: string;
  item_name: string | null;
  customer_name: string | null;
  dimensions: string | null;
  no_of_colours: string | null;
  circum: number | null;
  ups: number | null;
  length: string | null;
  coil_size: string | null;
  cut_length: string | null;
  location: string | null;
  remarks: string | null;
}

export function useArtworkImport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importArtworkItems = useMutation({
    mutationFn: async () => {
      // First, get all artwork items from staging table
      const { data: artworkItems, error: fetchError } = await supabase
        .from('_artworks_revised_staging')
        .select('*');

      if (fetchError) throw fetchError;

      // Get or create default categories
      const categoryMap = new Map();
      
      // Create default categories if they don't exist
      const defaultCategories = [
        { category_name: 'FINISHED_GOODS', description: 'Customer finished products' },
        { category_name: 'PACKAGING_FILMS', description: 'Packaging and film materials' },
        { category_name: 'LABELS', description: 'Label products' }
      ];

      for (const cat of defaultCategories) {
        const { data: existing } = await supabase
          .from('categories')
          .select('id')
          .eq('category_name', cat.category_name)
          .single();

        if (!existing) {
          const { data: newCat, error } = await supabase
            .from('categories')
            .insert(cat)
            .select('id')
            .single();
          
          if (!error && newCat) {
            categoryMap.set(cat.category_name, newCat.id);
          }
        } else {
          categoryMap.set(cat.category_name, existing.id);
        }
      }

      const defaultCategoryId = categoryMap.get('FINISHED_GOODS');

      // Process and import artwork items
      const importPromises = artworkItems.map(async (artwork: ArtworkItem) => {
        // Determine category based on dimensions or customer
        let categoryId = defaultCategoryId;
        if (artwork.dimensions?.includes('LABEL') || artwork.item_name?.includes('LABEL')) {
          categoryId = categoryMap.get('LABELS') || defaultCategoryId;
        } else if (artwork.dimensions?.includes('FILM') || artwork.customer_name?.includes('PACK')) {
          categoryId = categoryMap.get('PACKAGING_FILMS') || defaultCategoryId;
        }

        // Create item master entry
        const itemData = {
          item_code: artwork.item_code,
          item_name: artwork.item_name || `Product ${artwork.item_code}`,
          category_id: categoryId,
          qualifier: artwork.customer_name?.substring(0, 50),
          size_mm: artwork.dimensions,
          uom: 'PCS' as const,
          usage_type: 'FINISHED_GOOD' as const,
          status: 'active' as const,
          specifications: {
            customer_name: artwork.customer_name,
            dimensions: artwork.dimensions,
            colours: artwork.no_of_colours,
            circumference: artwork.circum,
            ups: artwork.ups,
            length: artwork.length,
            coil_size: artwork.coil_size,
            cut_length: artwork.cut_length,
            location: artwork.location,
            remarks: artwork.remarks
          }
        };

        // Check if item already exists
        const { data: existing } = await supabase
          .from('item_master')
          .select('id')
          .eq('item_code', artwork.item_code)
          .single();

        if (!existing) {
          const { error } = await supabase
            .from('item_master')
            .insert(itemData);
          
          if (error && !error.message.includes('duplicate')) {
            console.error(`Failed to import ${artwork.item_code}:`, error);
            throw error;
          }
        }
      });

      await Promise.all(importPromises);
      return artworkItems.length;
    },
    onSuccess: (count) => {
      toast({
        title: "Artwork Import Successful",
        description: `Successfully imported ${count} finished goods from artwork database.`
      });
      queryClient.invalidateQueries({ queryKey: ['itemMaster'] });
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: `Failed to import artwork items: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  return {
    importArtworkItems,
    isImporting: importArtworkItems.isPending
  };
}