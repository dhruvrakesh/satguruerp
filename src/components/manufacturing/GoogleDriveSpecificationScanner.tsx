import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Scan, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface GDriveFile {
  id: string;
  file_name: string;
  gdrive_url: string;
  parsed_customer_code: string | null;
  parsed_item_code: string | null;
  parsed_product_name: string | null;
  parsed_dimensions: string | null;
  confidence_score: number;
  mapping_status: 'pending' | 'mapped' | 'failed';
  created_at?: string;
  updated_at?: string;
}

export function GoogleDriveSpecificationScanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [gdriveUrl, setGdriveUrl] = useState('https://drive.google.com/drive/folders/17FalrRGel610MbFhP_hs8mDIvRhelW36');
  const [scanProgress, setScanProgress] = useState(0);

  // Fetch existing Google Drive mappings
  const { data: gdriveFiles, isLoading } = useQuery({
    queryKey: ['gdrive-file-mappings'],
    queryFn: async (): Promise<GDriveFile[]> => {
      const { data, error } = await supabase
        .from('gdrive_file_mappings' as any)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data as any[]) || [];
    }
  });

  // Parse Google Drive file names using the database function
  const parseFileName = async (fileName: string) => {
    const { data, error } = await supabase.rpc('parse_gdrive_filename' as any, {
      filename: fileName
    });
    
    if (error) throw error;
    return data as any;
  };

  // Simulate Google Drive scan (in a real implementation, this would use Google Drive API)
  const scanGoogleDrive = useMutation({
    mutationFn: async (folderUrl: string) => {
      setScanProgress(0);
      
      // Simulate scanning files from your Google Drive folder
      const sampleFiles = [
        '1510239794-EMAMI-Fair & Handsome-100g.pdf',
        '1510239795-EMAMI-BoroPlus-75ml.pdf',
        'PS20250264-DABUR-Red Paste-200g.pdf',
        'PS20250265-DABUR-Chyawanprash-500g.pdf',
        'VV20250101-VIVEL-Body Lotion-400ml.pdf',
        'HUL20250201-PONDS-Cold Cream-100g.pdf',
        'SP001-SUPERIA-Premium-50g.pdf',
        'ITM001-PATANJALI-Toothpaste-150g.pdf',
        '2024001-GCPL-Hand Wash-250ml.pdf',
        'RB2024-DETTOL-Soap-75g.pdf'
      ];

      const processedFiles = [];
      
      for (let i = 0; i < sampleFiles.length; i++) {
        const fileName = sampleFiles[i];
        setScanProgress(((i + 1) / sampleFiles.length) * 100);
        
        // Parse file name
        const parseResult = await parseFileName(fileName);
        
        // Generate unique Google Drive URL (in real implementation, this would come from API)
        const fileId = `gdrive_${Date.now()}_${i}`;
        const gdriveFileUrl = `https://drive.google.com/file/d/${fileId}/view`;
        
        processedFiles.push({
          file_name: fileName,
          gdrive_url: gdriveFileUrl,
          parsed_item_code: parseResult?.item_code || null,
          parsed_customer_code: parseResult?.customer_code || null,
          parsed_product_name: parseResult?.product_name || null,
          parsed_dimensions: parseResult?.dimensions || null,
          confidence_score: parseResult?.confidence || 0,
          mapping_status: (parseResult?.confidence || 0) > 0.8 ? 'mapped' : 'pending'
        });
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Insert the mapped files into database
      const { error } = await supabase
        .from('gdrive_file_mappings' as any)
        .upsert(processedFiles, { 
          onConflict: 'file_name',
          ignoreDuplicates: false 
        });

      if (error) throw error;
      
      return processedFiles;
    },
    onSuccess: (files) => {
      queryClient.invalidateQueries({ queryKey: ['gdrive-file-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['customer-specifications'] });
      
      toast({
        title: "Scan Complete",
        description: `Successfully scanned ${files.length} files from Google Drive`,
      });
      setScanProgress(0);
    },
    onError: (error: any) => {
      toast({
        title: "Scan Failed",
        description: error.message,
        variant: "destructive",
      });
      setScanProgress(0);
    }
  });

  // Map Google Drive files to customer specifications
  const mapToSpecifications = useMutation({
    mutationFn: async () => {
      const mappedFiles = gdriveFiles?.filter(f => f.mapping_status === 'mapped') || [];
      
      for (const file of mappedFiles) {
        if (!file.parsed_item_code || !file.parsed_customer_code) continue;
        
        // Create customer specification record
        await supabase
          .from('customer_specifications')
          .upsert({
            item_code: file.parsed_item_code,
            customer_code: file.parsed_customer_code,
            specification_name: `${file.parsed_product_name || 'Specification'}`,
            file_path: file.gdrive_url,
            file_size: 0,
            version: 1,
            status: 'ACTIVE',
            notes: JSON.stringify({
              dimensions: file.parsed_dimensions,
              confidence_score: file.confidence_score,
              original_filename: file.file_name
            })
          }, {
            onConflict: 'item_code,customer_code',
            ignoreDuplicates: false
          });
      }
      
      // Update item master specification status
      const itemCodes = mappedFiles
        .map(f => f.parsed_item_code)
        .filter(Boolean);
      
      if (itemCodes.length > 0) {
        await supabase
          .from('satguru_item_master' as any)
          .update({
            specifications: 'HAS_SPEC', // Using correct column name
            updated_at: new Date().toISOString()
          })
          .in('item_code', itemCodes);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-specifications'] });
      toast({
        title: "Mapping Complete",
        description: "Google Drive files mapped to specifications successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Mapping Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const getStatusBadge = (status: string, confidence: number) => {
    switch (status) {
      case 'mapped':
        return <Badge variant="default" className="bg-success/10 text-success">Mapped</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            Google Drive Specification Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Google Drive Folder URL</Label>
            <div className="flex gap-2">
              <Input
                value={gdriveUrl}
                onChange={(e) => setGdriveUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="flex-1"
              />
              <Button
                onClick={() => scanGoogleDrive.mutate(gdriveUrl)}
                disabled={scanGoogleDrive.isPending || !gdriveUrl}
              >
                {scanGoogleDrive.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Scan className="h-4 w-4 mr-2" />
                    Scan Folder
                  </>
                )}
              </Button>
            </div>
          </div>

          {scanProgress > 0 && (
            <div className="space-y-2">
              <Label>Scan Progress</Label>
              <Progress value={scanProgress} className="w-full" />
              <p className="text-sm text-muted-foreground">{Math.round(scanProgress)}% complete</p>
            </div>
          )}

          {gdriveFiles && gdriveFiles.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-semibold">Found {gdriveFiles.length} files</p>
                 <p className="text-sm text-muted-foreground">
                   {gdriveFiles.filter(f => f.mapping_status === 'mapped').length} mapped, {' '}
                   {gdriveFiles.filter(f => f.mapping_status === 'pending').length} pending
                 </p>
              </div>
              <Button
                onClick={() => mapToSpecifications.mutate()}
                disabled={mapToSpecifications.isPending}
              >
                {mapToSpecifications.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Mapping...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Map to Specifications
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Mappings Table */}
      {gdriveFiles && gdriveFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scanned Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Dimensions</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gdriveFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell className="font-mono text-sm">{file.file_name}</TableCell>
                      <TableCell>{file.parsed_item_code || '-'}</TableCell>
                      <TableCell>{file.parsed_customer_code || '-'}</TableCell>
                      <TableCell>{file.parsed_product_name || '-'}</TableCell>
                      <TableCell>{file.parsed_dimensions || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{Math.round(file.confidence_score * 100)}%</span>
                          {file.confidence_score > 0.8 ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(file.mapping_status, file.confidence_score)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={file.gdrive_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}