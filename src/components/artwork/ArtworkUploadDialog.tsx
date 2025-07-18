
import { useState } from "react";
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
import { FileUpload } from "@/components/ui/file-upload";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ArtworkUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: () => void;
}

export function ArtworkUploadDialog({ open, onClose, onUpload }: ArtworkUploadDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    item_code: "",
    item_name: "",
    customer_name: "",
    dimensions: "",
    no_of_colours: "",
    file_hyperlink: "",
    ups: "",
    circum: "",
    location: "",
    remarks: "",
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleSubmit = async () => {
    if (!formData.item_code || !formData.item_name) {
      toast({
        title: "Error",
        description: "Item code and name are required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Insert new artwork
      const { error } = await supabase
        .from("master_data_artworks_se")
        .insert({
          ...formData,
          ups: formData.ups ? Number(formData.ups) : null,
          circum: formData.circum ? Number(formData.circum) : null,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Artwork uploaded successfully",
      });
      
      // Reset form
      setFormData({
        item_code: "",
        item_name: "",
        customer_name: "",
        dimensions: "",
        no_of_colours: "",
        file_hyperlink: "",
        ups: "",
        circum: "",
        location: "",
        remarks: "",
      });
      setSelectedFiles([]);
      
      onUpload();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload artwork",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const colorOptions = ["1COL", "2COL", "3COL", "4COL", "5COL", "6COL", "7COL", "8COL"];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload New Artwork</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item_code">Item Code *</Label>
              <Input
                id="item_code"
                value={formData.item_code}
                onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                placeholder="Enter item code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item_name">Item Name *</Label>
              <Input
                id="item_name"
                value={formData.item_name}
                onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                placeholder="Enter item name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer Name</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                placeholder="Enter customer name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dimensions">Dimensions</Label>
              <Input
                id="dimensions"
                value={formData.dimensions}
                onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                placeholder="e.g., 100x200mm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="no_of_colours">Number of Colors</Label>
              <Select
                value={formData.no_of_colours}
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
            <div className="space-y-2">
              <Label htmlFor="ups">UPS</Label>
              <Input
                id="ups"
                type="number"
                value={formData.ups}
                onChange={(e) => setFormData({ ...formData, ups: e.target.value })}
                placeholder="Enter UPS"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="circum">Circumference (mm)</Label>
              <Input
                id="circum"
                type="number"
                value={formData.circum}
                onChange={(e) => setFormData({ ...formData, circum: e.target.value })}
                placeholder="Enter circumference"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Enter location"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file_hyperlink">Google Drive Link</Label>
            <Input
              id="file_hyperlink"
              value={formData.file_hyperlink}
              onChange={(e) => setFormData({ ...formData, file_hyperlink: e.target.value })}
              placeholder="https://drive.google.com/..."
            />
          </div>

          <div className="space-y-2">
            <Label>Upload Files (Optional)</Label>
            <FileUpload
              onFilesSelected={setSelectedFiles}
              accept="application/pdf,image/*"
              multiple
            />
            {selectedFiles.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedFiles.length} file(s) selected
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              rows={3}
              placeholder="Enter any additional notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Uploading..." : "Upload Artwork"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
