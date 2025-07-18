
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Droplets, Package, AlertTriangle, TrendingUp } from "lucide-react";

interface RMConsumptionTrackerProps {
  uiorn: string;
  processStage: string;
  artworkData?: any;
  onConsumptionUpdate?: (consumption: MaterialConsumption[]) => void;
}

interface MaterialConsumption {
  id?: string;
  rm_item_code: string;
  material_name: string;
  material_type: 'INK' | 'SOLVENT' | 'ADHESIVE' | 'SUBSTRATE' | 'OTHER';
  planned_quantity: number;
  actual_quantity: number;
  wastage_quantity: number;
  unit_cost: number;
  total_cost: number;
  unit_of_measure: string;
  notes?: string;
}

export function RMConsumptionTracker({ 
  uiorn, 
  processStage, 
  artworkData, 
  onConsumptionUpdate 
}: RMConsumptionTrackerProps) {
  const [consumptionData, setConsumptionData] = useState<MaterialConsumption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalPlannedCost, setTotalPlannedCost] = useState(0);
  const [totalActualCost, setTotalActualCost] = useState(0);
  const { toast } = useToast();

  // Initialize consumption data based on BOM and process stage
  useEffect(() => {
    if (uiorn && processStage) {
      initializeConsumptionData();
    }
  }, [uiorn, processStage, artworkData]);

  const initializeConsumptionData = async () => {
    setIsLoading(true);
    try {
      // Get BOM data for the item code
      const itemCode = artworkData?.item_code;
      if (!itemCode) {
        console.log('No item code available, using default materials');
        setConsumptionData(getDefaultMaterials(processStage));
        return;
      }

      const { data: bomData, error } = await supabase
        .from('bill_of_materials')
        .select(`
          *,
          rm_item_code,
          quantity_required,
          unit_of_measure,
          consumption_rate,
          wastage_percentage
        `)
        .eq('fg_item_code', itemCode);

      if (error) throw error;

      let materials: MaterialConsumption[] = [];

      if (bomData && bomData.length > 0) {
        // Convert BOM data to consumption tracking
        materials = bomData.map(bom => ({
          rm_item_code: bom.rm_item_code,
          material_name: getMaterialName(bom.rm_item_code),
          material_type: getMaterialType(bom.rm_item_code),
          planned_quantity: bom.quantity_required * (bom.consumption_rate || 1),
          actual_quantity: 0,
          wastage_quantity: 0,
          unit_cost: 10, // Default unit cost - should be fetched from item master
          total_cost: 0,
          unit_of_measure: bom.unit_of_measure || 'KG',
          notes: ''
        }));
      } else {
        // Use default materials if no BOM exists
        materials = getDefaultMaterials(processStage);
      }

      setConsumptionData(materials);
      calculateTotals(materials);

    } catch (error) {
      console.error('Error initializing consumption data:', error);
      toast({
        title: "Initialization Error",
        description: "Failed to load BOM data. Using default materials.",
        variant: "destructive"
      });
      setConsumptionData(getDefaultMaterials(processStage));
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultMaterials = (stage: string): MaterialConsumption[] => {
    const materials: MaterialConsumption[] = [];
    
    if (stage === 'GRAVURE_PRINTING') {
      const colorCount = extractColorCount(artworkData?.no_of_colours) || 4;
      
      // Add ink for each color
      for (let i = 0; i < colorCount; i++) {
        materials.push({
          rm_item_code: `INK_${['C', 'M', 'Y', 'K', 'B1', 'B2'][i]}`,
          material_name: `${['Cyan', 'Magenta', 'Yellow', 'Black', 'Blue', 'Green'][i]} Ink`,
          material_type: 'INK',
          planned_quantity: 25, // kg per color
          actual_quantity: 0,
          wastage_quantity: 0,
          unit_cost: 450, // INR per kg
          total_cost: 0,
          unit_of_measure: 'KG'
        });
      }
      
      // Add solvents
      materials.push({
        rm_item_code: 'SOLVENT_EA',
        material_name: 'Ethyl Acetate',
        material_type: 'SOLVENT',
        planned_quantity: 100,
        actual_quantity: 0,
        wastage_quantity: 0,
        unit_cost: 120,
        total_cost: 0,
        unit_of_measure: 'LTR'
      });
      
      materials.push({
        rm_item_code: 'SOLVENT_IPA',
        material_name: 'Isopropyl Alcohol',
        material_type: 'SOLVENT',
        planned_quantity: 50,
        actual_quantity: 0,
        wastage_quantity: 0,
        unit_cost: 85,
        total_cost: 0,
        unit_of_measure: 'LTR'
      });
    }
    
    return materials;
  };

  const extractColorCount = (colorString: string): number => {
    if (!colorString) return 4;
    const match = colorString.match(/(\d+)/);
    return match ? parseInt(match[1]) : 4;
  };

  const getMaterialName = (itemCode: string): string => {
    // Simple mapping - should be enhanced with actual item master lookup
    if (itemCode.includes('INK')) return `${itemCode} Ink`;
    if (itemCode.includes('SOLVENT')) return `${itemCode} Solvent`;
    if (itemCode.includes('ADHESIVE')) return `${itemCode} Adhesive`;
    return itemCode;
  };

  const getMaterialType = (itemCode: string): MaterialConsumption['material_type'] => {
    if (itemCode.includes('INK')) return 'INK';
    if (itemCode.includes('SOLVENT')) return 'SOLVENT';
    if (itemCode.includes('ADHESIVE')) return 'ADHESIVE';
    if (itemCode.includes('FILM') || itemCode.includes('SUBSTRATE')) return 'SUBSTRATE';
    return 'OTHER';
  };

  const updateConsumption = (index: number, field: keyof MaterialConsumption, value: any) => {
    const updated = [...consumptionData];
    updated[index] = { ...updated[index], [field]: value };
    
    // Calculate total cost
    if (field === 'actual_quantity' || field === 'wastage_quantity' || field === 'unit_cost') {
      const item = updated[index];
      item.total_cost = (item.actual_quantity + item.wastage_quantity) * item.unit_cost;
    }
    
    setConsumptionData(updated);
    calculateTotals(updated);
    onConsumptionUpdate?.(updated);
  };

  const calculateTotals = (data: MaterialConsumption[]) => {
    const plannedTotal = data.reduce((sum, item) => sum + (item.planned_quantity * item.unit_cost), 0);
    const actualTotal = data.reduce((sum, item) => sum + item.total_cost, 0);
    
    setTotalPlannedCost(plannedTotal);
    setTotalActualCost(actualTotal);
  };

  const saveConsumptionData = async () => {
    setIsLoading(true);
    try {
      const user = await supabase.auth.getUser();
      const dataToInsert = consumptionData
        .filter(item => item.actual_quantity > 0 || item.wastage_quantity > 0)
        .map(item => ({
          uiorn: uiorn,
          rm_item_code: item.rm_item_code,
          process_stage: processStage as any,
          planned_quantity: item.planned_quantity,
          actual_quantity: item.actual_quantity,
          wastage_quantity: item.wastage_quantity,
          unit_cost: item.unit_cost,
          total_cost: item.total_cost,
          notes: item.notes,
          recorded_by: user.data.user?.id
        }));

      if (dataToInsert.length === 0) {
        toast({
          title: "No Data",
          description: "Please enter consumption quantities before saving.",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('uiorn_material_consumption')
        .insert(dataToInsert);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Saved consumption data for ${dataToInsert.length} materials.`
      });

    } catch (error) {
      console.error('Error saving consumption data:', error);
      toast({
        title: "Error",
        description: "Failed to save consumption data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getMaterialIcon = (type: MaterialConsumption['material_type']) => {
    switch (type) {
      case 'INK': return <Droplets className="h-4 w-4 text-blue-500" />;
      case 'SOLVENT': return <Package className="h-4 w-4 text-green-500" />;
      case 'ADHESIVE': return <Package className="h-4 w-4 text-orange-500" />;
      default: return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  const getVarianceColor = (planned: number, actual: number) => {
    const variance = Math.abs(actual - planned) / planned;
    if (variance <= 0.05) return 'text-green-600';
    if (variance <= 0.15) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-muted-foreground">Loading consumption data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cost Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planned Cost</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalPlannedCost.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actual Cost</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalActualCost.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variance</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getVarianceColor(totalPlannedCost, totalActualCost)}`}>
              {totalPlannedCost > 0 ? 
                `${(((totalActualCost - totalPlannedCost) / totalPlannedCost) * 100).toFixed(1)}%` : 
                'N/A'
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Material Consumption Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Material Consumption - {processStage}</CardTitle>
            <Button onClick={saveConsumptionData} disabled={isLoading}>
              Save Consumption Data
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {consumptionData.map((item, index) => (
              <div key={item.rm_item_code} className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  {getMaterialIcon(item.material_type)}
                  <h4 className="font-medium">{item.material_name}</h4>
                  <Badge variant="outline">{item.material_type}</Badge>
                  <span className="text-sm text-muted-foreground">({item.rm_item_code})</span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Planned ({item.unit_of_measure})
                    </label>
                    <Input
                      type="number"
                      value={item.planned_quantity}
                      onChange={(e) => updateConsumption(index, 'planned_quantity', parseFloat(e.target.value) || 0)}
                      className="text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Actual ({item.unit_of_measure})
                    </label>
                    <Input
                      type="number"
                      value={item.actual_quantity}
                      onChange={(e) => updateConsumption(index, 'actual_quantity', parseFloat(e.target.value) || 0)}
                      className="text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Wastage ({item.unit_of_measure})
                    </label>
                    <Input
                      type="number"
                      value={item.wastage_quantity}
                      onChange={(e) => updateConsumption(index, 'wastage_quantity', parseFloat(e.target.value) || 0)}
                      className="text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Unit Cost (₹)
                    </label>
                    <Input
                      type="number"
                      value={item.unit_cost}
                      onChange={(e) => updateConsumption(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                      className="text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Total Cost (₹)
                    </label>
                    <div className="text-sm font-medium py-2">
                      ₹{item.total_cost.toFixed(2)}
                    </div>
                  </div>
                </div>
                
                <div className="mt-3">
                  <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                  <Input
                    value={item.notes || ''}
                    onChange={(e) => updateConsumption(index, 'notes', e.target.value)}
                    placeholder="Additional notes..."
                    className="text-sm"
                  />
                </div>
                
                {item.planned_quantity > 0 && (item.actual_quantity > 0 || item.wastage_quantity > 0) && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Usage vs Planned</span>
                      <span>{(((item.actual_quantity + item.wastage_quantity) / item.planned_quantity) * 100).toFixed(1)}%</span>
                    </div>
                    <Progress 
                      value={Math.min(((item.actual_quantity + item.wastage_quantity) / item.planned_quantity) * 100, 100)} 
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
