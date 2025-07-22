
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Layers,
  Palette,
  Scissors,
  Droplets,
  Activity
} from "lucide-react";
import { EnhancedProcessStageCard } from "./EnhancedProcessStageCard";
import { SubstrateSpecificationPanel } from "./SubstrateSpecificationPanel";
import { QualityControlPanel } from "./QualityControlPanel";
import { CostTrackingPanel } from "./CostTrackingPanel";

interface FlexiblePackagingDashboardProps {
  uiorn: string;
  orderData?: any;
}

export function FlexiblePackagingDashboard({ uiorn, orderData }: FlexiblePackagingDashboardProps) {
  const [activeStages, setActiveStages] = useState([]);
  const [qualityAlerts, setQualityAlerts] = useState([]);
  const [productionMetrics, setProductionMetrics] = useState({
    efficiency: 87,
    quality_score: 94,
    material_yield: 89,
    on_time_delivery: 92
  });

  // Mock process stages for flexible packaging
  const processStages = [
    {
      stage: 'artwork_upload',
      status: 'completed',
      started_at: '2024-01-15T08:00:00Z',
      completed_at: '2024-01-15T09:30:00Z',
      operator_id: 'OP001',
      quality_checks: []
    },
    {
      stage: 'gravure_printing',
      status: 'in_progress',
      started_at: '2024-01-15T10:00:00Z',
      operator_id: 'OP002',
      machine_id: 'GP001',
      process_parameters: {
        printing: {
          line_speed_mpm: 150,
          impression_pressure_bar: 2.5,
          drying_temperature_c: 65,
          ink_viscosity_sec: 18,
          solvent_ratio: '70:30',
          registration_tolerance_mm: 0.1,
          cylinder_pressure: 1.8
        }
      },
      quality_metrics: {
        color_accuracy: {
          delta_e: 1.2,
          l_value: 45.2,
          a_value: 12.8,
          b_value: -8.4
        },
        dimensional_accuracy: {
          width_variance_mm: 0.3,
          thickness_variance_microns: 2,
          length_accuracy_percentage: 99.8
        }
      },
      substrate_specifications: {
        material_type: 'BOPP',
        thickness_microns: 25,
        width_mm: 350,
        treatment: 'CORONA',
        grade: 'Premium',
        supplier: 'Polyplex Corp',
        roll_diameter: 1200,
        core_size: 76
      }
    },
    {
      stage: 'lamination',
      status: 'pending',
      process_parameters: {
        lamination: {
          nip_pressure_n_cm: 300,
          laminating_temperature_c: 45,
          line_speed_mpm: 120,
          adhesive_coat_weight_gsm: 3.5,
          curing_temperature_c: 60,
          bond_strength_n_15mm: 4.2
        }
      }
    },
    {
      stage: 'slitting',
      status: 'pending',
      process_parameters: {
        slitting: {
          slitting_speed_mpm: 200,
          knife_pressure: 85,
          rewind_tension_n: 120,
          trim_width_mm: 5,
          finished_width_mm: 120,
          roll_length_m: 1000
        }
      }
    }
  ];

  const handleStatusUpdate = (stage: string, status: string) => {
    console.log(`Updating ${stage} to ${status}`);
    // Implementation for status update
  };

  const handleParametersEdit = (stage: string) => {
    console.log(`Edit parameters for ${stage}`);
    // Implementation for parameter editing
  };

  const getProductTypeIcon = (productType: string) => {
    const icons = {
      'SOAP_WRAPPER': '🧼',
      'STIFFENER': '📋',
      'LAMINATE': '📄',
      'TAPE': '📏',
      'POUCH': '🛍️',
      'LABEL': '🏷️'
    };
    return icons[productType as keyof typeof icons] || '📦';
  };

  return (
    <div className="space-y-6">
      {/* Header with Product Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">{getProductTypeIcon(orderData?.product_type || 'SOAP_WRAPPER')}</span>
                Flexible Packaging Production - {uiorn}
              </CardTitle>
              <CardDescription>
                {orderData?.customer_name} • {orderData?.product_type} • {orderData?.substrate_type}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {orderData?.priority_level || 'NORMAL'} PRIORITY
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Production Metrics Dashboard */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{productionMetrics.efficiency}%</div>
                <div className="text-sm text-muted-foreground">Overall Efficiency</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{productionMetrics.quality_score}%</div>
                <div className="text-sm text-muted-foreground">Quality Score</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{productionMetrics.material_yield}%</div>
                <div className="text-sm text-muted-foreground">Material Yield</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{productionMetrics.on_time_delivery}%</div>
                <div className="text-sm text-muted-foreground">On-Time Delivery</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Production Workflow */}
      <Tabs defaultValue="process-flow" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="process-flow">Process Flow</TabsTrigger>
          <TabsTrigger value="substrate-specs">Substrate Specs</TabsTrigger>
          <TabsTrigger value="quality-control">Quality Control</TabsTrigger>
          <TabsTrigger value="cost-tracking">Cost Tracking</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="process-flow" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {processStages.map((stage, index) => (
              <EnhancedProcessStageCard
                key={index}
                stage={stage}
                orderData={{
                  uiorn,
                  customer_name: orderData?.customer_name || 'Customer',
                  product_type: orderData?.product_type || 'SOAP_WRAPPER',
                  substrate_type: orderData?.substrate_type || 'BOPP Film'
                }}
                onStatusUpdate={handleStatusUpdate}
                onParametersEdit={handleParametersEdit}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="substrate-specs">
          <SubstrateSpecificationPanel uiorn={uiorn} />
        </TabsContent>

        <TabsContent value="quality-control">
          <QualityControlPanel uiorn={uiorn} />
        </TabsContent>

        <TabsContent value="cost-tracking">
          <CostTrackingPanel uiorn={uiorn} />
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Production Analytics</CardTitle>
              <CardDescription>
                Advanced analytics and insights for flexible packaging production
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                Advanced analytics dashboard coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
