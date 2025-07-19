
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Download, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface SpecificationPreviewDialogProps {
  specification: {
    id: string;
    item_code: string;
    customer_code: string;
    specification_name: string;
    file_path: string;
    external_url?: string;
    source_type?: string;
    sync_status?: string;
    parsed_metadata?: any;
    status: string;
    version: number;
    item_master?: {
      item_name: string;
      customer_name: string;
      dimensions: string;
    };
  };
  children: React.ReactNode;
}

export function SpecificationPreviewDialog({ specification, children }: SpecificationPreviewDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadPreview = async () => {
    setIsLoading(true);
    try {
      // Handle Google Drive files
      if (specification.source_type === 'GOOGLE_DRIVE' && specification.external_url) {
        // Convert Google Drive share URL to embeddable format
        const embedUrl = specification.external_url.replace('/view', '/preview');
        setPreviewUrl(embedUrl);
      } else {
        // Handle Supabase storage files
        const { data, error } = await supabase.storage
          .from('customer-specifications')
          .createSignedUrl(specification.file_path, 3600); // 1 hour expiry

        if (error) throw error;
        setPreviewUrl(data.signedUrl);
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast({
        title: "Preview Error",
        description: "Could not load file preview",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from('customer_specifications')
        .update({ 
          status: newStatus,
          approved_by: newStatus === 'APPROVED' ? (await supabase.auth.getUser()).data.user?.id : null,
          approved_at: newStatus === 'APPROVED' ? new Date().toISOString() : null
        })
        .eq('id', specification.id);
      
      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['customer-specifications'] });
      toast({
        title: "Status Updated",
        description: `Specification ${newStatus.toLowerCase()} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const downloadFile = async () => {
    try {
      // Handle Google Drive files
      if (specification.source_type === 'GOOGLE_DRIVE' && specification.external_url) {
        // Open Google Drive file in new tab for download
        window.open(specification.external_url, '_blank');
        return;
      }

      // Handle Supabase storage files
      const { data, error } = await supabase.storage
        .from('customer-specifications')
        .download(specification.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = specification.specification_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Could not download file",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  return (
    <Dialog onOpenChange={(open) => open && loadPreview()}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(specification.status)}
              {specification.specification_name}
              {specification.source_type === 'GOOGLE_DRIVE' && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                  Google Drive
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">v{specification.version}</Badge>
              <Badge variant={specification.status === 'APPROVED' ? 'default' : 'secondary'}>
                {specification.status}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Specification Details */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <h4 className="font-semibold">Item Details</h4>
              <p><strong>Item Code:</strong> {specification.item_code}</p>
              <p><strong>Item Name:</strong> {specification.item_master?.item_name || 'N/A'}</p>
              <p><strong>Dimensions:</strong> {specification.item_master?.dimensions || 'N/A'}</p>
            </div>
            <div>
              <h4 className="font-semibold">Customer Details</h4>
              <p><strong>Customer Code:</strong> {specification.customer_code}</p>
              <p><strong>Customer Name:</strong> {specification.item_master?.customer_name || 'N/A'}</p>
            </div>
          </div>

          {/* File Preview */}
          <div className="border rounded-lg p-4 min-h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p>Loading preview...</p>
                </div>
              </div>
            ) : previewUrl ? (
              <iframe 
                src={previewUrl} 
                className="w-full h-[400px] border-0"
                title="Specification Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Eye className="h-12 w-12 mx-auto mb-2" />
                  <p>Preview not available for this file type</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadFile}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
            
            {specification.status === 'PENDING' && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => updateStatus.mutate('REJECTED')}
                  disabled={updateStatus.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button 
                  onClick={() => updateStatus.mutate('APPROVED')}
                  disabled={updateStatus.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
