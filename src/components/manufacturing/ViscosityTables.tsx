
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ViscosityTablesProps {
  uiorn: string;
  colorCount: number;
  artworkData?: any;
  onViscosityChange?: (deckId: string, viscosity: number) => void;
  onParametersApplied?: (parameters: any) => void;
}

interface ViscosityReading {
  deck_id: string;
  viscosity_cps: number;
  color_name: string;
  target_viscosity?: number;
  variance?: number;
}

export function ViscosityTables({ 
  uiorn, 
  colorCount, 
  artworkData, 
  onViscosityChange,
  onParametersApplied 
}: ViscosityTablesProps) {
  const [viscosityReadings, setViscosityReadings] = useState<ViscosityReading[]>([]);
  const [isApplyingParameters, setIsApplyingParameters] = useState(false);
  const { toast } = useToast();

  // Enhanced color names with more variety
  const colorNames = [
    'Cyan', 'Magenta', 'Yellow', 'Black', 
    'Blue', 'Green', 'Red', 'White', 
    'Orange', 'Purple', 'Pink', 'Brown',
    'Silver', 'Gold', 'Violet', 'Indigo'
  ];

  // Initialize viscosity readings based on color count and artwork data
  useEffect(() => {
    console.log('Initializing viscosity tables for', colorCount, 'colors with artwork:', artworkData);
    
    // Validate and sanitize color count
    const validatedColorCount = Math.max(1, Math.min(colorCount || 4, 16));
    
    const initialReadings = Array.from({ length: validatedColorCount }, (_, index) => {
      const colorName = colorNames[index] || `Color ${index + 1}`;
      const targetViscosity = calculateTargetViscosity(colorName, artworkData);
      
      return {
        deck_id: `${uiorn}-deck-${index + 1}`,
        viscosity_cps: 0,
        color_name: colorName,
        target_viscosity: targetViscosity,
        variance: 0
      };
    });
    
    setViscosityReadings(initialReadings);
    console.log('Initialized viscosity readings with targets:', initialReadings);
  }, [colorCount, uiorn, artworkData]);

  // Calculate target viscosity based on color type and artwork specifications
  const calculateTargetViscosity = (colorName: string, artwork: any): number => {
    if (!artwork) return 18; // Default viscosity
    
    // Base viscosity calculations based on substrate and color type
    let baseViscosity = 18;
    
    // Adjust for substrate type
    if (artwork.dimensions?.includes('BOPP')) {
      baseViscosity = 16;
    } else if (artwork.dimensions?.includes('PET')) {
      baseViscosity = 20;
    }
    
    // Adjust for color type
    if (colorName === 'Black' || colorName === 'Cyan') {
      baseViscosity += 1; // Dense colors need slightly higher viscosity
    } else if (colorName === 'Yellow') {
      baseViscosity -= 1; // Yellow typically runs thinner
    }
    
    return baseViscosity;
  };

  const handleViscosityChange = (deckId: string, value: string) => {
    const viscosity = parseFloat(value) || 0;
    setViscosityReadings(prev => 
      prev.map(reading => {
        if (reading.deck_id === deckId) {
          const variance = reading.target_viscosity ? 
            Math.abs(viscosity - reading.target_viscosity) : 0;
          return { 
            ...reading, 
            viscosity_cps: viscosity,
            variance: variance
          };
        }
        return reading;
      })
    );
    onViscosityChange?.(deckId, viscosity);
  };

  const applyArtworkParameters = async () => {
    if (!artworkData) {
      toast({
        title: "No Artwork Data",
        description: "Please select an order with artwork data first.",
        variant: "destructive"
      });
      return;
    }

    setIsApplyingParameters(true);
    
    try {
      // Calculate optimal parameters based on artwork specifications
      const parameters = calculateOptimalParameters(artworkData, colorCount);
      
      // Apply target viscosities to all decks
      setViscosityReadings(prev => 
        prev.map(reading => ({
          ...reading,
          target_viscosity: calculateTargetViscosity(reading.color_name, artworkData)
        }))
      );

      // Record parameter application in database
      const { error } = await supabase
        .from('process_logs_se')
        .insert({
          uiorn: uiorn,
          stage: 'GRAVURE_PRINTING',
          metric: 'parameter_application',
          txt_value: `Applied artwork-based parameters: ${JSON.stringify(parameters)}`,
          captured_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      // Callback to parent component with calculated parameters
      onParametersApplied?.(parameters);
      
      toast({
        title: "Parameters Applied",
        description: `Applied optimal parameters for ${artworkData.item_code} (${colorCount} colors)`,
      });

    } catch (error) {
      console.error('Error applying artwork parameters:', error);
      toast({
        title: "Application Failed",
        description: "Failed to apply artwork parameters. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsApplyingParameters(false);
    }
  };

  const calculateOptimalParameters = (artwork: any, colors: number) => {
    // Base parameters
    let parameters = {
      line_speed_mpm: 120,
      drying_temp_c: 185,
      ink_viscosity_sec: 18,
      impression_pressure: 2.5,
      solvent_ratio: '70:30'
    };

    // Adjust for substrate type
    if (artwork.dimensions?.includes('BOPP')) {
      parameters.line_speed_mpm = 150;
      parameters.drying_temp_c = 175;
      parameters.ink_viscosity_sec = 16;
    } else if (artwork.dimensions?.includes('PET')) {
      parameters.line_speed_mpm = 130;
      parameters.drying_temp_c = 195;
      parameters.ink_viscosity_sec = 20;
    }

    // Adjust for color count
    if (colors > 4) {
      parameters.line_speed_mpm -= 20; // Slower for more colors
      parameters.impression_pressure += 0.2;
    }

    // Adjust for customer-specific requirements
    if (artwork.customer_name?.includes('Premium')) {
      parameters.line_speed_mpm -= 10; // Higher quality, slower speed
      parameters.drying_temp_c += 5;
    }

    return parameters;
  };

  const saveViscosityReadings = async () => {
    try {
      const dataToInsert = viscosityReadings
        .filter(reading => reading.viscosity_cps > 0)
        .map(reading => ({
          deck_id: reading.deck_id,
          viscosity_cps: reading.viscosity_cps,
          job_id: uiorn,
          captured_by: null // Will be set by RLS
        }));

      if (dataToInsert.length === 0) {
        toast({
          title: "No Data",
          description: "Please enter viscosity readings before saving.",
          variant: "destructive"
        });
        return;
      }

      console.log('Saving viscosity data:', dataToInsert);

      const { error } = await supabase
        .from('deck_viscosity_readings')
        .insert(dataToInsert);

      if (error) {
        console.error('Error saving viscosity readings:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: `Saved ${dataToInsert.length} viscosity readings successfully!`
      });
    } catch (error) {
      console.error('Error saving viscosity readings:', error);
      toast({
        title: "Error",
        description: "Failed to save viscosity readings. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (viscosityReadings.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Loading viscosity tables...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Viscosity Readings ({colorCount} Colors - {uiorn})
        </h3>
        <div className="flex gap-2">
          {artworkData && (
            <Button 
              onClick={applyArtworkParameters}
              disabled={isApplyingParameters}
              variant="outline"
              size="sm"
            >
              {isApplyingParameters ? "Applying..." : "Apply Artwork Parameters"}
            </Button>
          )}
          <Button onClick={saveViscosityReadings} size="sm">
            Save Readings
          </Button>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {viscosityReadings.map((reading, index) => (
          <Card key={reading.deck_id} className="p-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {reading.color_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Deck {index + 1} Viscosity (cPs)
                </label>
                <Input
                  type="number"
                  placeholder={reading.target_viscosity?.toString() || "18.0"}
                  value={reading.viscosity_cps || ''}
                  onChange={(e) => handleViscosityChange(reading.deck_id, e.target.value)}
                  className="text-sm"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
              
              {reading.target_viscosity && (
                <div className="text-xs text-muted-foreground">
                  Target: {reading.target_viscosity} cPs
                </div>
              )}
              
              {reading.viscosity_cps > 0 && (
                <div className={`text-xs ${
                  reading.variance && reading.variance <= 1 ? 'text-green-600' : 
                  reading.variance && reading.variance <= 2 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {reading.variance && reading.variance <= 1 ? '✓ Within spec' : 
                   reading.variance && reading.variance <= 2 ? '⚠ Close to limit' : 
                   reading.variance ? '❌ Out of spec' : '✓ Ready'}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {viscosityReadings.some(r => r.viscosity_cps > 0) && (
        <div className="text-sm text-muted-foreground">
          {viscosityReadings.filter(r => r.viscosity_cps > 0).length} of {viscosityReadings.length} readings entered
        </div>
      )}
    </div>
  );
}
