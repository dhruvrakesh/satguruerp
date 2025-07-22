
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Layers, 
  Ruler, 
  Zap, 
  Package,
  AlertCircle,
  CheckCircle,
  Info
} from "lucide-react";

interface SubstrateSpecificationPanelProps {
  uiorn: string;
}

export function SubstrateSpecificationPanel({ uiorn }: SubstrateSpecificationPanelProps) {
  // Mock substrate specifications
  const substrateSpecs = {
    material_type: 'BOPP',
    thickness_microns: 25,
    width_mm: 350,
    treatment: 'CORONA',
    grade: 'Premium',
    supplier: 'Polyplex Corp',
    batch_number: 'BP2024-0156',
    roll_diameter: 1200,
    core_size: 76,
    surface_tension: 42,
    opacity_percentage: 98,
    gloss_level: 85,
    heat_seal_strength: 2.8
  };

  const barrierProperties = {
    moisture_barrier: true,
    oxygen_barrier: false,
    aroma_barrier: true,
    grease_barrier: true,
    uv_barrier: false
  };

  const qualityChecks = [
    { parameter: 'Thickness Uniformity', value: '±2 microns', status: 'passed', target: '±3 microns' },
    { parameter: 'Surface Tension', value: '42 dyne/cm', status: 'passed', target: '>38 dyne/cm' },
    { parameter: 'Opacity', value: '98%', status: 'passed', target: '>95%' },
    { parameter: 'Heat Seal Strength', value: '2.8 N/15mm', status: 'warning', target: '>3.0 N/15mm' },
    { parameter: 'COF (Static)', value: '0.35', status: 'passed', target: '<0.4' }
  ];

  return (
    <div className="space-y-6">
      {/* Substrate Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Substrate Specifications - {uiorn}
          </CardTitle>
          <CardDescription>
            Current substrate configuration and quality parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic Properties */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Material Properties
              </h4>
              
              <div className="grid gap-3">
                <div className="flex justify-between">
                  <Label>Material Type</Label>
                  <Badge variant="outline">{substrateSpecs.material_type}</Badge>
                </div>
                
                <div className="flex justify-between">
                  <Label>Thickness</Label>
                  <span className="text-sm font-medium">{substrateSpecs.thickness_microns} microns</span>
                </div>
                
                <div className="flex justify-between">
                  <Label>Width</Label>
                  <span className="text-sm font-medium">{substrateSpecs.width_mm} mm</span>
                </div>
                
                <div className="flex justify-between">
                  <Label>Treatment</Label>
                  <Badge variant="secondary">{substrateSpecs.treatment}</Badge>
                </div>
                
                <div className="flex justify-between">
                  <Label>Grade</Label>
                  <span className="text-sm font-medium">{substrateSpecs.grade}</span>
                </div>
                
                <div className="flex justify-between">
                  <Label>Supplier</Label>
                  <span className="text-sm font-medium">{substrateSpecs.supplier}</span>
                </div>
                
                <div className="flex justify-between">
                  <Label>Batch Number</Label>
                  <span className="text-sm font-medium">{substrateSpecs.batch_number}</span>
                </div>
              </div>
            </div>

            {/* Technical Properties */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Ruler className="h-4 w-4" />
                Technical Properties
              </h4>
              
              <div className="grid gap-3">
                <div className="flex justify-between">
                  <Label>Roll Diameter</Label>
                  <span className="text-sm font-medium">{substrateSpecs.roll_diameter} mm</span>
                </div>
                
                <div className="flex justify-between">
                  <Label>Core Size</Label>
                  <span className="text-sm font-medium">{substrateSpecs.core_size} mm</span>
                </div>
                
                <div className="flex justify-between">
                  <Label>Surface Tension</Label>
                  <span className="text-sm font-medium">{substrateSpecs.surface_tension} dyne/cm</span>
                </div>
                
                <div className="flex justify-between">
                  <Label>Opacity</Label>
                  <span className="text-sm font-medium">{substrateSpecs.opacity_percentage}%</span>
                </div>
                
                <div className="flex justify-between">
                  <Label>Gloss Level</Label>
                  <span className="text-sm font-medium">{substrateSpecs.gloss_level} GU</span>
                </div>
                
                <div className="flex justify-between">
                  <Label>Heat Seal Strength</Label>
                  <span className="text-sm font-medium">{substrateSpecs.heat_seal_strength} N/15mm</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barrier Properties */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Barrier Properties
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {Object.entries(barrierProperties).map(([property, value]) => (
              <div key={property} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium capitalize">
                  {property.replace('_', ' ')}
                </span>
                {value ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quality Control Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Quality Control Results
          </CardTitle>
          <CardDescription>
            Latest quality test results for incoming substrate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {qualityChecks.map((check, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {check.status === 'passed' && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {check.status === 'warning' && <AlertCircle className="h-4 w-4 text-orange-600" />}
                  {check.status === 'failed' && <AlertCircle className="h-4 w-4 text-red-600" />}
                  
                  <div>
                    <div className="text-sm font-medium">{check.parameter}</div>
                    <div className="text-xs text-muted-foreground">Target: {check.target}</div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm font-medium">{check.value}</div>
                  <Badge 
                    variant={check.status === 'passed' ? 'default' : 
                             check.status === 'warning' ? 'secondary' : 'destructive'}
                    className="text-xs"
                  >
                    {check.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button>Update Specifications</Button>
        <Button variant="outline">Request New Tests</Button>
        <Button variant="outline">Generate Report</Button>
      </div>
    </div>
  );
}
