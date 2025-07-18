
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ViscosityTablesProps {
  uiorn: string;
  colorCount: number;
  onViscosityChange?: (deckId: string, viscosity: number) => void;
}

interface ViscosityReading {
  deck_id: string;
  viscosity_cps: number;
  color_name: string;
}

export function ViscosityTables({ uiorn, colorCount, onViscosityChange }: ViscosityTablesProps) {
  const [viscosityReadings, setViscosityReadings] = useState<ViscosityReading[]>([]);
  const { toast } = useToast();

  // Enhanced color names with more variety
  const colorNames = [
    'Cyan', 'Magenta', 'Yellow', 'Black', 
    'Blue', 'Green', 'Red', 'White', 
    'Orange', 'Purple', 'Pink', 'Brown',
    'Silver', 'Gold', 'Violet', 'Indigo'
  ];

  // Initialize viscosity readings based on color count
  useEffect(() => {
    console.log('Initializing viscosity tables for', colorCount, 'colors');
    
    // Validate and sanitize color count
    const validatedColorCount = Math.max(1, Math.min(colorCount || 4, 16));
    
    const initialReadings = Array.from({ length: validatedColorCount }, (_, index) => ({
      deck_id: `deck-${index + 1}`,
      viscosity_cps: 0,
      color_name: colorNames[index] || `Color ${index + 1}`
    }));
    
    setViscosityReadings(initialReadings);
    console.log('Initialized viscosity readings:', initialReadings);
  }, [colorCount]);

  const handleViscosityChange = (deckId: string, value: string) => {
    const viscosity = parseFloat(value) || 0;
    setViscosityReadings(prev => 
      prev.map(reading => 
        reading.deck_id === deckId 
          ? { ...reading, viscosity_cps: viscosity }
          : reading
      )
    );
    onViscosityChange?.(deckId, viscosity);
  };

  const saveViscosityReadings = async () => {
    try {
      const dataToInsert = viscosityReadings
        .filter(reading => reading.viscosity_cps > 0)
        .map(reading => ({
          deck_id: reading.deck_id,
          viscosity_cps: reading.viscosity_cps,
          job_id: uiorn, // Using UIORN as job_id for now
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
        <Button onClick={saveViscosityReadings} size="sm">
          Save Readings
        </Button>
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
                  placeholder="18.0"
                  value={reading.viscosity_cps || ''}
                  onChange={(e) => handleViscosityChange(reading.deck_id, e.target.value)}
                  className="text-sm"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
              {reading.viscosity_cps > 0 && (
                <div className="text-xs text-green-600">
                  ✓ Ready
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
