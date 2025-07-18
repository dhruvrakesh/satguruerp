
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

  // Initialize viscosity readings based on color count
  useEffect(() => {
    const colorNames = ['Cyan', 'Magenta', 'Yellow', 'Black', 'Blue', 'Green', 'Red', 'White'];
    const initialReadings = Array.from({ length: colorCount }, (_, index) => ({
      deck_id: `deck-${index + 1}`,
      viscosity_cps: 0,
      color_name: colorNames[index] || `Color ${index + 1}`
    }));
    setViscosityReadings(initialReadings);
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

      const { error } = await supabase
        .from('deck_viscosity_readings')
        .insert(dataToInsert);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Viscosity readings saved successfully!"
      });
    } catch (error) {
      console.error('Error saving viscosity readings:', error);
      toast({
        title: "Error",
        description: "Failed to save viscosity readings.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Viscosity Readings ({colorCount} Colors)</h3>
        <Button onClick={saveViscosityReadings} size="sm">
          Save Readings
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {viscosityReadings.map((reading, index) => (
          <Card key={reading.deck_id} className="p-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{reading.color_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground">Deck {index + 1}</label>
                <Input
                  type="number"
                  placeholder="Viscosity (cPs)"
                  value={reading.viscosity_cps || ''}
                  onChange={(e) => handleViscosityChange(reading.deck_id, e.target.value)}
                  className="text-sm"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
