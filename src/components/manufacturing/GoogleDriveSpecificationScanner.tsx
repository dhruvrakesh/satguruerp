
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
import { GoogleDriveService, SpecificationParser } from "@/services/googleDriveService";

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
  mapping_status: string;
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
        .from('gdrive_file_mappings')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as GDriveFile[];
    }
  });

  // Enhanced scan function using real Google Drive service
  const scanGoogleDrive = useMutation({
    mutationFn: async (folderUrl: string) => {
      setScanProgress(0);
      
      console.log('Starting Google Drive scan...');
      
      // Get files from Google Drive
      const driveFiles = await GoogleDriveService.listFiles();
      console.log('Found files:', driveFiles);
      
      const processedFiles = [];
      const errors = [];
      
      for (let i = 0; i < driveFiles.length; i++) {
        const driveFile = driveFiles[i];
        setScanProgress(((i + 1) / driveFiles.length) * 100);
        
        try {
          console.log(`Processing file ${i + 1}/${driveFiles.length}: ${driveFile.name}`);
          
          // Parse filename using underscore delimiter logic
          const parseResult = SpecificationParser.parseUnderscoreDelimitedFilename(driveFile.name);
          console.log('Parse result:', parseResult);
          
          // Try to find matching artwork item
          let finalItemCode = parseResult.item_code;
          if (parseResult.item_code) {
            const matchingItem = await SpecificationParser.findMatchingArtworkItem(parseResult.item_code);
            if (matchingItem) {
              finalItemCode = matchingItem;
              parseResult.confidence_score += 0.2; // Boost confidence for valid artwork match
            }
          }
          
          // Determine mapping status based on confidence and artwork match
          let mappingStatus = 'pending';
          if (parseResult.confidence_score > 0.8 && finalItemCode) {
            mappingStatus = 'mapped';
          } else if (parseResult.confidence_score < 0.3) {
            mappingStatus = 'failed';
          }
          
          processedFiles.push({
            file_name: driveFile.name,
            gdrive_url: driveFile.webViewLink,
            parsed_item_code: finalItemCode,
            parsed_customer_code: parseResult.customer_name,
            parsed_product_name: parseResult.product_name,
            parsed_dimensions: parseResult.dimensions,
            confidence_score: parseResult.confidence_score,
            mapping_status: mappingStatus
          });
          
        } catch (error) {
          console.error(`Error processing file ${driveFile.name}:`, error);
          errors.push({ 
            fileName: driveFile.name, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Insert the mapped files into database
      if (processedFiles.length > 0) {
        console.log('Inserting processed files:', processedFiles);
        
        const { error } = await supabase
          .from('gdrive_file_mappings')
          .upsert(processedFiles, { 
            onConflict: 'file_name'
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
          const specificationName = file.file_name.replace(/\.[^/.]+$/, ''); // Remove extension
          
          // Create customer specification record
          const { error } = await supabase
            .from('customer_specifications')
            .upsert({
              item_code: file.parsed_item_code,
              customer_code: file.parsed_customer_code,
              specification_name: specificationName,
              file_path: file.gdrive_url,
              file_size: 0, // We don't have size info from Drive API yet
              version: 1,
              status: 'ACTIVE',
              notes: JSON.stringify({
                dimensions: file.parsed_dimensions,
                confidence_score: file.confidence_score,
                original_filename: file.file_name,
                source: 'google_drive_scanner',
                product_name: file.parsed_product_name
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
