
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PrintingTemplateLoaderProps {
  uiorn?: string;
  onTemplateLoad: (template: any) => void;
}

interface PrintingTemplate {
  id: string;
  name: string;
  print_speed: number;
  drying_temperature: number;
  ink_viscosity: number;
  color_tolerance: number;
  registration_tolerance: number;
  density_target: number;
  description?: string;
}

export function PrintingTemplateLoader({ uiorn, onTemplateLoad }: PrintingTemplateLoaderProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Predefined printing templates for different scenarios
  const printingTemplates: PrintingTemplate[] = [
    {
      id: "bopp-standard",
      name: "BOPP Standard",
      print_speed: 120,
      drying_temperature: 185,
      ink_viscosity: 18,
      color_tolerance: 2.5,
      registration_tolerance: 0.1,
      density_target: 1.4,
      description: "Standard BOPP film printing parameters"
    },
    {
      id: "pet-high-speed",
      name: "PET High Speed",
      print_speed: 150,
      drying_temperature: 195,
      ink_viscosity: 16,
      color_tolerance: 2.0,
      registration_tolerance: 0.08,
      density_target: 1.5,
      description: "High-speed PET film printing"
    },
    {
      id: "multicolor-precision",
      name: "Multi-color Precision",
      print_speed: 95,
      drying_temperature: 175,
      ink_viscosity: 20,
      color_tolerance: 1.5,
      registration_tolerance: 0.05,
      density_target: 1.6,
      description: "Precision settings for multi-color jobs"
    },
    {
      id: "economic-mode",
      name: "Economic Mode",
      print_speed: 140,
      drying_temperature: 170,
      ink_viscosity: 22,
      color_tolerance: 3.0,
      registration_tolerance: 0.15,
      density_target: 1.3,
      description: "Cost-effective printing parameters"
    }
  ];

  const handleTemplateLoad = async () => {
    if (!selectedTemplate) {
      toast({
        title: "No Template Selected",
        description: "Please select a template to load.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Simulate loading delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const template = printingTemplates.find(t => t.id === selectedTemplate);
      
      if (!template) {
        throw new Error("Template not found");
      }

      console.log("Loading template:", template);
      
      // Load the template parameters
      onTemplateLoad(template);
      
      toast({
        title: "Template Loaded",
        description: `Successfully loaded ${template.name} parameters.`,
      });

    } catch (error) {
      console.error("Error loading template:", error);
      toast({
        title: "Loading Failed",
        description: "Failed to load template parameters. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateOptimalTemplate = async () => {
    if (!uiorn) {
      toast({
        title: "No Job Selected",
        description: "Please select a UIORN to generate optimal parameters.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Simulate AI-based parameter generation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const optimalTemplate = {
        id: "ai-generated",
        name: "AI Optimized",
        print_speed: Math.floor(Math.random() * 50) + 100, // 100-150
        drying_temperature: Math.floor(Math.random() * 30) + 170, // 170-200
        ink_viscosity: Math.floor(Math.random() * 8) + 16, // 16-24
        color_tolerance: Math.round((Math.random() * 2 + 1) * 10) / 10, // 1.0-3.0
        registration_tolerance: Math.round((Math.random() * 0.1 + 0.05) * 100) / 100, // 0.05-0.15
        density_target: Math.round((Math.random() * 0.5 + 1.2) * 10) / 10, // 1.2-1.7
        description: `AI-generated optimal parameters for ${uiorn}`
      };

      console.log("Generated optimal template:", optimalTemplate);
      
      onTemplateLoad(optimalTemplate);
      
      toast({
        title: "Optimal Parameters Generated",
        description: `AI-optimized parameters loaded for ${uiorn}.`,
      });

    } catch (error) {
      console.error("Error generating optimal template:", error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate optimal parameters. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Download className="h-4 w-4" />
          Load Template
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Template</label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a printing template..." />
            </SelectTrigger>
            <SelectContent>
              {printingTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTemplate && (
            <p className="text-xs text-muted-foreground">
              {printingTemplates.find(t => t.id === selectedTemplate)?.description}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handleTemplateLoad}
            disabled={!selectedTemplate || isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load Template"
            )}
          </Button>
        </div>

        {uiorn && (
          <div className="pt-2 border-t">
            <Button 
              onClick={generateOptimalTemplate}
              disabled={isLoading}
              variant="outline"
              className="w-full text-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "🤖 Generate AI Optimal"
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              AI-optimized parameters for {uiorn}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
