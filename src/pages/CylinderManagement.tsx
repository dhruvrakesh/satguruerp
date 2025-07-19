import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CircleDot, Upload } from "lucide-react";
import { SatguruCylinderManagement } from "@/components/manufacturing/SatguruCylinderManagement";
import { CylinderBulkUpload } from "@/components/manufacturing/CylinderBulkUpload";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function CylinderManagement() {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CircleDot className="w-8 h-8" />
            Cylinder Management
          </h2>
          <p className="text-muted-foreground">
            Manage printing cylinders, track usage, and monitor maintenance schedules
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Dialog open={showUpload} onOpenChange={setShowUpload}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Bulk Upload Cylinders</DialogTitle>
                <DialogDescription>
                  Upload cylinder data from CSV file. Download the template to see the required format.
                </DialogDescription>
              </DialogHeader>
              <CylinderBulkUpload onClose={() => setShowUpload(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cylinder Inventory</CardTitle>
          <CardDescription>
            View and manage all cylinders in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SatguruCylinderManagement />
        </CardContent>
      </Card>
    </div>
  );
}