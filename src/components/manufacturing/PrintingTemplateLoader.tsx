
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProcessParameters, useOptimalParameters } from "@/hooks/useProcessIntelligence";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PrintingTemplateLoaderProps {
  uiorn: string;
  itemCode?: string;
  onTemplateLoad: (template: any) => void;
}

export function PrintingTemplateLoader({ uiorn, itemCode, onTemplateLoad }: PrintingTemplateLoaderProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const { data: processParams } = useProcessParameters("PRINTING");
  const { data: optimalParams } = useOptimalParameters(itemCode || "", "PRINTING");

  const predefinedTemplates = [
    {
      id: "standard_bopp",
      name: "Standard BOPP Film",
      description: "Standard settings for BOPP substrate",
      parameters: {
        print_speed: 120,
        drying_temperature: 185,
        ink_viscosity: 18,
        color_tolerance: 2.5,
        registration_tolerance: 0.1,
        density_target: 1.4
      }
    },
    {
      id: "standard_pet",
      name: "Standard PET Film", 
      description: "Standard settings for PET substrate",
      parameters: {
        print_speed: 95,
        drying_temperature: 175,
        ink_viscosity: 16,
        color_tolerance: 2.0,
        registration_tolerance: 0.08,
        density_target: 1.3
      }
    },
    {
      id: "high_quality",
      name: "High Quality Print",
      description: "Settings for premium quality requirements",
      parameters: {
        print_speed: 80,
        drying_temperature: 190,
        ink_viscosity: 20,
        color_tolerance: 1.5,
        registration_tolerance: 0.05,
        density_target: 1.5
      }
    }
  ];

  const handleLoadTemplate = (templateId: string) => {
    const template = predefinedTemplates.find(t => t.id === templateId);
    if (template) {
      onTemplateLoad(template.parameters);
      setSelectedTemplate("");
    }
  };

  const handleLoadOptimalParams = () => {
    if (optimalParams?.recommendations) {
      const params: any = {};
      optimalParams.recommendations.forEach(rec => {
        params[rec.metric] = rec.recommended_value;
      });
      onTemplateLoad(params);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Load Template</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Load Printing Template</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Predefined Templates */}
          <div className="space-y-3">
            <h3 className="font-medium">Predefined Templates</h3>
            <div className="grid gap-3">
              {predefinedTemplates.map((template) => (
                <Card key={template.id} className="cursor-pointer hover:bg-muted/50" 
                      onClick={() => handleLoadTemplate(template.id)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{template.name}</CardTitle>
                    <CardDescription className="text-xs">{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">
                        Speed: {template.parameters.print_speed}m/min
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Temp: {template.parameters.drying_temperature}°C
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Viscosity: {template.parameters.ink_viscosity}cPs
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* AI Recommendations */}
          {optimalParams?.recommendations && (
            <div className="space-y-3">
              <h3 className="font-medium">AI Recommended Parameters</h3>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Based on Similar Jobs</CardTitle>
                  <CardDescription className="text-xs">
                    Optimized for {optimalParams.artwork?.item_name || 'this job type'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {optimalParams.recommendations.slice(0, 4).map((rec, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="capitalize">{rec.metric.replace('_', ' ')}</span>
                        <Badge variant="outline" className="text-xs">
                          {rec.recommended_value.toFixed(1)} 
                          {rec.confidence > 0.7 && " (High Confidence)"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Button 
                    onClick={handleLoadOptimalParams}
                    className="w-full mt-3"
                    size="sm"
                  >
                    Load AI Recommendations
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
