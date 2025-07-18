
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileImage, Download, CheckCircle, AlertCircle, User, Shield } from "lucide-react";
import { useArtworkImport } from "@/hooks/useArtworkImport";
import { useAuth } from "@/contexts/AuthContext";

export function ArtworkImportDialog() {
  const [open, setOpen] = useState(false);
  const { importArtworkItems, isImporting } = useArtworkImport();
  const { user, profile } = useAuth();

  const handleImport = async () => {
    await importArtworkItems.mutateAsync();
    setOpen(false);
  };

  const canImport = user && profile && profile.is_approved;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileImage className="h-4 w-4" />
          Import Artwork Items
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Finished Goods from Artwork Database</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Authentication Status */}
          <Card className={`border-2 ${canImport ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                {canImport ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
                Authentication Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>User:</span>
                  <span className="font-medium">{user?.email || 'Not signed in'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Profile:</span>
                  <span className={`font-medium ${profile ? 'text-green-600' : 'text-red-600'}`}>
                    {profile ? 'Found' : 'Missing'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Approval:</span>
                  <span className={`font-medium ${profile?.is_approved ? 'text-green-600' : 'text-amber-600'}`}>
                    {profile?.is_approved ? 'Approved' : 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Organization:</span>
                  <span className="font-medium">DKEGL</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileImage className="h-5 w-5" />
                Artwork Integration
              </CardTitle>
              <CardDescription>
                Import 359 finished goods from your artwork staging database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Source Data</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Artwork Items:</span>
                      <Badge variant="secondary">359 items</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Format:</span>
                      <Badge variant="outline">8-digit codes</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Type:</span>
                      <Badge variant="default">Finished Goods</Badge>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium">Import Features</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Auto-categorization
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Specification mapping
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Duplicate detection
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded-lg">
                <div className="text-sm font-medium mb-1">What will be imported:</div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Item codes, names, and customer information</li>
                  <li>• Dimensions, colors, and technical specifications</li>
                  <li>• Manufacturing parameters (UPS, circumference, length)</li>
                  <li>• Location and remarks data</li>
                </ul>
              </div>
            </CardContent>
          </Card>
          
          <div className="flex gap-3">
            <Button 
              onClick={handleImport} 
              disabled={isImporting || !canImport}
              className="flex-1 gap-2"
            >
              <Download className="h-4 w-4" />
              {isImporting ? "Importing..." : "Import 359 Finished Goods"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>

          {!canImport && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
              <p className="text-sm text-amber-800">
                {!user ? "Please sign in to import artwork items." :
                 !profile ? "Profile setup required. Please refresh the page." :
                 !profile.is_approved ? "Account approval required to import data." :
                 "Authentication required to proceed."}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
