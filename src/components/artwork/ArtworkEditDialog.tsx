
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ArtworkItem {
  item_code: string;
  item_name: string;
  customer_name: string;
  dimensions: string;
  no_of_colours: string;
  file_hyperlink: string;
  file_id: string;
  ups?: number;
  circum?: number;
  location?: string;
  cyl_qty?: string;
  total_runs?: string;
  last_run?: string;
  mielage_m?: string;
  remarks?: string;
}

interface ArtworkEditDialogProps {
  artwork: ArtworkItem | null;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function ArtworkEditDialog({ artwork, open, onClose, onSave }: ArtworkEditDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<ArtworkItem>>({});

  useEffect(() => {
    if (artwork) {
      setFormData(artwork);
    }
  }, [artwork]);

  const handleSave = async () => {
    if (!artwork) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("master_data_artworks_se")
        .update(formData)
        .eq("item_code", artwork.item_code);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Artwork updated successfully",
      });
      onSave();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update artwork",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const colorOptions = ["1COL", "2COL", "3COL", "4COL", "5COL", "6COL", "7COL", "8COL"];

  if (!artwork) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Artwork - {artwork.item_code}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item_name">Item Name</Label>
              <Input
                id="item_name"
                value={formData.item_name || ""}
                onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer Name</Label>
              <Input
                id="customer_name"
                value={formData.customer_name || ""}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dimensions">Dimensions</Label>
              <Input
                id="dimensions"
                value={formData.dimensions || ""}
                onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="no_of_colours">Number of Colors</Label>
              <Select
                value={formData.no_of_colours || ""}
                onValueChange={(value) => setFormData({ ...formData, no_of_colours: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select colors" />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((color) => (
                    <SelectItem key={color} value={color}>
                      {color}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ups">UPS</Label>
              <Input
                id="ups"
                type="number"
                value={formData.ups || ""}
                onChange={(e) => setFormData({ ...formData, ups: Number(e.target.value) || undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="circum">Circumference (mm)</Label>
              <Input
                id="circum"
                type="number"
                value={formData.circum || ""}
                onChange={(e) => setFormData({ ...formData, circum: Number(e.target.value) || undefined })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location || ""}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cyl_qty">Cylinder Quantity</Label>
              <Input
                id="cyl_qty"
                value={formData.cyl_qty || ""}
                onChange={(e) => setFormData({ ...formData, cyl_qty: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file_hyperlink">Google Drive Link</Label>
            <Input
              id="file_hyperlink"
              value={formData.file_hyperlink || ""}
              onChange={(e) => setFormData({ ...formData, file_hyperlink: e.target.value })}
              placeholder="https://drive.google.com/..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={formData.remarks || ""}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
