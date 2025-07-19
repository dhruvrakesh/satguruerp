
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user, profile, refreshProfile } = useAuth();

  const importArtworkItems = useMutation({
    mutationFn: async () => {
      console.log('🚀 Starting artwork import process...');
      console.log('Current user:', user?.id);
      console.log('Current profile:', profile);

      if (!user) {
        throw new Error('User not authenticated. Please sign in first.');
      }

      if (!profile) {
        console.log('Profile not found, attempting to refresh...');
        await refreshProfile();
        throw new Error('User profile not found. Please try again or contact support.');
      }

      if (!profile.is_approved) {
        throw new Error('User account not approved. Please contact administrator.');
      }

      console.log('✅ Authentication checks passed');

      // First, get all artwork items from staging table
      console.log('📦 Fetching artwork items from staging...');
      const { data: artworkItems, error: fetchError } = await supabase
        .from('_artworks_revised_staging')
        .select('*');

      if (fetchError) {
        console.error('❌ Failed to fetch artwork items:', fetchError);
        throw fetchError;
      }

      console.log(`📊 Found ${artworkItems.length} artwork items to import`);

      // Get or create default categories in satguru_categories
      const categoryMap = new Map();
      
      // Create default categories if they don't exist
      const defaultCategories = [
        { category_name: 'FINISHED_GOODS', description: 'Customer finished products' },
        { category_name: 'PACKAGING_FILMS', description: 'Packaging and film materials' },
        { category_name: 'LABELS', description: 'Label products' }
      ];

      console.log('🏷️ Setting up categories...');
      for (const cat of defaultCategories) {
        const { data: existing } = await supabase
          .from('satguru_categories')
          .select('id')
          .eq('category_name', cat.category_name)
          .single();

        if (!existing) {
          console.log(`Creating category: ${cat.category_name}`);
          const { data: newCat, error } = await supabase
            .from('satguru_categories')
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
      console.log('✅ Categories set up, default category ID:', defaultCategoryId);

      // Process and import artwork items in batches
      console.log('🔄 Processing artwork items...');
      let successCount = 0;
      let errorCount = 0;
      const batchSize = 50;
      
      for (let i = 0; i < artworkItems.length; i += batchSize) {
        const batch = artworkItems.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1} (${batch.length} items)`);
        
        const batchPromises = batch.map(async (artwork: ArtworkItem) => {
          try {
            // Determine category based on dimensions or customer
            let categoryId = defaultCategoryId;
            if (artwork.dimensions?.includes('LABEL') || artwork.item_name?.includes('LABEL')) {
              categoryId = categoryMap.get('LABELS') || defaultCategoryId;
            } else if (artwork.dimensions?.includes('FILM') || artwork.customer_name?.includes('PACK')) {
              categoryId = categoryMap.get('PACKAGING_FILMS') || defaultCategoryId;
            }

            // Create item master entry with all required fields in satguru_item_master
            const itemData = {
              item_code: artwork.item_code,
              item_name: artwork.item_name || `Product ${artwork.item_code}`,
              category_id: categoryId,
              qualifier: artwork.customer_name?.substring(0, 50),
              size_mm: artwork.dimensions,
              gsm: artwork.circum, // Using circum as GSM equivalent
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

            // Check if item already exists in satguru_item_master
            const { data: existing } = await supabase
              .from('satguru_item_master')
              .select('id')
              .eq('item_code', artwork.item_code)
              .single();

            if (!existing) {
              const { error } = await supabase
                .from('satguru_item_master')
                .insert(itemData);
              
              if (error) {
                console.error(`❌ Failed to import ${artwork.item_code}:`, error);
                errorCount++;
                throw error;
              } else {
                successCount++;
              }
            } else {
              console.log(`⚠️ Item ${artwork.item_code} already exists, skipping`);
            }
          } catch (error) {
            console.error(`❌ Error processing item ${artwork.item_code}:`, error);
            errorCount++;
          }
        });

        await Promise.all(batchPromises);
        
        // Small delay between batches to avoid overwhelming the database
        if (i + batchSize < artworkItems.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`✅ Import completed: ${successCount} successful, ${errorCount} errors`);
      return { successCount, errorCount, totalItems: artworkItems.length };
    },
    onSuccess: (result) => {
      console.log('🎉 Import successful:', result);
      toast({
        title: "Artwork Import Successful!",
        description: `Successfully imported ${result.successCount} finished goods from artwork database. ${result.errorCount > 0 ? `${result.errorCount} items had errors.` : 'All items imported successfully!'}`
      });
      queryClient.invalidateQueries({ queryKey: ['itemMaster'] });
    },
    onError: (error: any) => {
      console.error('💥 Import failed:', error);
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
