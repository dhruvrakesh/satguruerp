
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

// Updated interface to match actual database schema
interface GDriveFile {
  id: string;
  file_name: string;
  gdrive_url: string;
  parsed_customer_code: string | null;
  parsed_item_code: string | null;
  parsed_product_name: string | null;
  parsed_dimensions: string | null;
  confidence_score: number;
  mapping_status: string; // Changed from union type to string to match database
  created_at?: string;
  updated_at?: string;
}

// Type for database function response
interface ParseFilenameResult {
  item_code?: string;
  customer_code?: string;
  product_name?: string;
  dimensions?: string;
  confidence?: number;
}

// Type guard to validate database function response
function isValidParseResult(data: any): data is ParseFilenameResult {
  return data && typeof data === 'object';
}

export function GoogleDriveSpecificationScanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [gdriveUrl, setGdriveUrl] = useState('https://drive.google.com/drive/folders/17FalrRGel610MbFhP_hs8mDIvRhelW36');
  const [scanProgress, setScanProgress] = useState(0);

  // Fetch existing Google Drive mappings with proper typing
  const { data: gdriveFiles, isLoading } = useQuery({
    queryKey: ['gdrive-file-mappings'],
    queryFn: async (): Promise<GDriveFile[]> => {
      const { data, error } = await supabase
        .from('gdrive_file_mappings')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as GDriveFile[];
    }
  });

  // Enhanced parse function with proper error handling and type safety
  const parseFileName = async (fileName: string): Promise<ParseFilenameResult> => {
    try {
      const { data, error } = await supabase.rpc('parse_gdrive_filename', {
        filename: fileName
      });
      
      if (error) {
        console.error('Database function error:', error);
        throw error;
      }

      // Handle null or undefined response
      if (!data) {
        return {
          item_code: null,
          customer_code: null,
          product_name: null,
          dimensions: null,
          confidence: 0
        };
      }

      // Type-safe property access with fallbacks
      const parseResult: ParseFilenameResult = {
        item_code: data?.item_code || null,
        customer_code: data?.customer_code || null,
        product_name: data?.product_name || null,
        dimensions: data?.dimensions || null,
        confidence: data?.confidence || 0
      };

      return parseResult;
    } catch (error) {
      console.error('Error parsing filename:', error);
      return {
        item_code: null,
        customer_code: null,
        product_name: null,
        dimensions: null,
        confidence: 0
      };
    }
  };

  // Extract specification name from filename (remove extension)
  const getSpecificationName = (fileName: string): string => {
    return fileName.replace(/\.[^/.]+$/, ''); // Remove file extension
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
      const errors = [];
      
      for (let i = 0; i < sampleFiles.length; i++) {
        const fileName = sampleFiles[i];
        setScanProgress(((i + 1) / sampleFiles.length) * 100);
        
        try {
          // Parse file name with enhanced error handling
          const parseResult = await parseFileName(fileName);
          
          // Generate unique Google Drive URL (in real implementation, this would come from API)
          const fileId = `gdrive_${Date.now()}_${i}`;
          const gdriveFileUrl = `https://drive.google.com/file/d/${fileId}/view`;
          
          // Determine mapping status based on confidence
          const confidence = parseResult.confidence || 0;
          let mappingStatus = 'pending';
          if (confidence > 0.8) {
            mappingStatus = 'mapped';
          } else if (confidence < 0.3) {
            mappingStatus = 'failed';
          }
          
          processedFiles.push({
            file_name: fileName,
            gdrive_url: gdriveFileUrl,
            parsed_item_code: parseResult.item_code || null,
            parsed_customer_code: parseResult.customer_code || null,
            parsed_product_name: parseResult.product_name || null,
            parsed_dimensions: parseResult.dimensions || null,
            confidence_score: confidence,
            mapping_status: mappingStatus
          });
        } catch (error) {
          console.error(`Error processing file ${fileName}:`, error);
          errors.push({ fileName, error: error instanceof Error ? error.message : 'Unknown error' });
        }
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Insert the mapped files into database with proper conflict resolution
      if (processedFiles.length > 0) {
        const { error } = await supabase
          .from('gdrive_file_mappings')
          .upsert(processedFiles, { 
            onConflict: 'file_name',
            ignoreDuplicates: false 
          });

        if (error) {
          console.error('Database upsert error:', error);
          throw new Error(`Failed to save file mappings: ${error.message}`);
        }
      }
      
      return { processedFiles, errors };
    },
    onSuccess: ({ processedFiles, errors }) => {
      queryClient.invalidateQueries({ queryKey: ['gdrive-file-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['customer-specifications'] });
      
      let message = `Successfully scanned ${processedFiles.length} files from Google Drive`;
      if (errors.length > 0) {
        message += `. ${errors.length} files had parsing errors.`;
      }
      
      toast({
        title: "Scan Complete",
        description: message,
        variant: errors.length > 0 ? "destructive" : "default"
      });
      setScanProgress(0);
    },
    onError: (error: any) => {
      console.error('Scan error:', error);
      toast({
        title: "Scan Failed",
        description: `Error: ${error.message}`,
        variant: "destructive",
      });
      setScanProgress(0);
    }
  });

  // Map Google Drive files to customer specifications
  const mapToSpecifications = useMutation({
    mutationFn: async () => {
      const mappedFiles = gdriveFiles?.filter(f => f.mapping_status === 'mapped') || [];
      const errors = [];
      let successCount = 0;
      
      for (const file of mappedFiles) {
        if (!file.parsed_item_code || !file.parsed_customer_code) {
          errors.push({ fileName: file.file_name, error: 'Missing item code or customer code' });
          continue;
        }
        
        try {
          const specificationName = getSpecificationName(file.file_name);
          
          // Create customer specification record with proper conflict resolution
          const { error } = await supabase
            .from('customer_specifications')
            .upsert({
              item_code: file.parsed_item_code,
              customer_code: file.parsed_customer_code,
              specification_name: specificationName,
              file_path: file.gdrive_url,
              file_size: 0,
              version: 1,
              status: 'ACTIVE',
              notes: JSON.stringify({
                dimensions: file.parsed_dimensions,
                confidence_score: file.confidence_score,
                original_filename: file.file_name,
                source: 'google_drive_scanner'
              })
            }, {
              onConflict: 'item_code,customer_code,specification_name',
              ignoreDuplicates: false
            });

          if (error) {
            console.error(`Error creating specification for ${file.file_name}:`, error);
            errors.push({ fileName: file.file_name, error: error.message });
          } else {
            successCount++;
          }
        } catch (error) {
          console.error(`Unexpected error for ${file.file_name}:`, error);
          errors.push({ fileName: file.file_name, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      // Update item master specification status for successfully mapped items
      const successfulItemCodes = mappedFiles
        .filter((_, index) => !errors.find(e => e.fileName === mappedFiles[index]?.file_name))
        .map(f => f.parsed_item_code)
        .filter(Boolean);
      
      if (successfulItemCodes.length > 0) {
        try {
          await supabase
            .from('satguru_item_master')
            .update({
              specifications: 'HAS_SPEC',
              updated_at: new Date().toISOString()
            })
            .in('item_code', successfulItemCodes);
        } catch (error) {
          console.error('Error updating item master:', error);
        }
      }

      return { successCount, errors };
    },
    onSuccess: ({ successCount, errors }) => {
      queryClient.invalidateQueries({ queryKey: ['customer-specifications'] });
      
      let message = `Successfully mapped ${successCount} specifications`;
      if (errors.length > 0) {
        message += `. ${errors.length} files failed to map.`;
        console.log('Mapping errors:', errors);
      }
      
      toast({
        title: "Mapping Complete",
        description: message,
        variant: errors.length > 0 ? "destructive" : "default"
      });
    },
    onError: (error: any) => {
      console.error('Mapping error:', error);
      toast({
        title: "Mapping Failed",
        description: `Error: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const getStatusBadge = (status: string, confidence: number) => {
    switch (status) {
      case 'mapped':
        return <Badge variant="default" className="bg-green-100 text-green-800">Mapped</Badge>;
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
