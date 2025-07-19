
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Cylinder {
  cylinder_code: string;
  cylinder_name: string;
  item_code: string;
  colour: string;
  cylinder_size: number;
  manufacturer: string;
  location: string;
  mileage_m: number;
  last_run: string;
  status: string;
  type: string;
  remarks: string;
}

interface CylinderSelectorProps {
  itemCode?: string;
  selectedCylinders: string[];
  onSelect: (cylinderCode: string) => void;
  onRemove: (cylinderCode: string) => void;
}

export function CylinderSelector({ itemCode, selectedCylinders, onSelect, onRemove }: CylinderSelectorProps) {
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: cylinders = [], isLoading } = useQuery({
    queryKey: ["cylinders-for-item", itemCode],
    queryFn: async () => {
      let query = supabase
        .from('satguru_cylinders')
        .select('*')
        .order('cylinder_code');

      if (itemCode) {
        query = query.eq('item_code', itemCode);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Cylinder[];
    },
    enabled: !!itemCode,
  });

  const getStatusIcon = (status: string, mileage: number) => {
    if (status === 'MAINTENANCE') return <AlertCircle className="h-4 w-4 text-red-500" />;
    if (mileage > 50000) return <AlertCircle className="h-4 w-4 text-orange-500" />;
    if (selectedCylinders.includes(status)) return <Clock className="h-4 w-4 text-blue-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusBadge = (status: string, mileage: number) => {
    if (status === 'MAINTENANCE') return <Badge variant="destructive">Maintenance</Badge>;
    if (mileage > 50000) return <Badge variant="secondary" className="bg-orange-100 text-orange-800">High Mileage</Badge>;
    if (status === 'IN_USE') return <Badge variant="outline" className="bg-blue-100 text-blue-800">In Use</Badge>;
    return <Badge variant="secondary" className="bg-green-100 text-green-800">Available</Badge>;
  };

  const filteredCylinders = cylinders.filter(cylinder => {
    if (filterStatus === "all") return true;
    if (filterStatus === "available") return cylinder.status === 'AVAILABLE';
    if (filterStatus === "maintenance") return cylinder.status === 'MAINTENANCE';
    if (filterStatus === "in_use") return cylinder.status === 'IN_USE';
    return true;
  });

  if (!itemCode) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Select an artwork item to view available cylinders</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading cylinders...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Available Cylinders ({filteredCylinders.length})
          </CardTitle>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="in_use">In Use</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredCylinders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No cylinders found for this item</p>
            <p className="text-sm">Consider adding cylinders for item code: {itemCode}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCylinders.map((cylinder) => (
              <div
                key={cylinder.cylinder_code}
                className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(cylinder.status, cylinder.mileage_m)}
                    <span className="font-medium">{cylinder.cylinder_code}</span>
                    {getStatusBadge(cylinder.status, cylinder.mileage_m)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    <span>{cylinder.cylinder_name}</span>
                    {cylinder.colour && <span className="ml-2">• {cylinder.colour}</span>}
                    {cylinder.cylinder_size > 0 && <span className="ml-2">• {cylinder.cylinder_size}mm</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    <span>Mileage: {cylinder.mileage_m.toLocaleString()}m</span>
                    {cylinder.location && <span className="ml-2">• Location: {cylinder.location}</span>}
                    {cylinder.last_run && <span className="ml-2">• Last Run: {cylinder.last_run}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedCylinders.includes(cylinder.cylinder_code) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRemove(cylinder.cylinder_code)}
                      className="bg-blue-50 text-blue-700 border-blue-200"
                    >
                      Selected
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelect(cylinder.cylinder_code)}
                      disabled={cylinder.status === 'MAINTENANCE'}
                    >
                      Select
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
