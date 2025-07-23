import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface SupplierBulkRow {
  supplier_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  payment_terms?: string;
  credit_limit?: number;
  material_categories?: string; // Comma-separated list
}

interface BulkUploadResult {
  successCount: number;
  errorCount: number;
  errors: Array<{
    rowNumber: number;
    reason: string;
    data: any;
  }>;
}

export function useSupplierBulkUpload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();

  const generateSupplierCode = (supplierName: string, existingCodes: Set<string>): string => {
    // Extract first 3 letters of supplier name
    const baseCode = supplierName.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
    let counter = 1;
    let code = `SUP${baseCode}${counter.toString().padStart(3, '0')}`;
    
    while (existingCodes.has(code)) {
      counter++;
      code = `SUP${baseCode}${counter.toString().padStart(3, '0')}`;
    }
    
    return code;
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^[+]?[\d\s\-\(\)]{10,15}$/;
    return phoneRegex.test(phone);
  };

  const processCSV = async (file: File): Promise<BulkUploadResult> => {
    setIsProcessing(true);
    setProgress(0);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      if (lines.length <= 1) {
        throw new Error("CSV file is empty or has no data rows");
      }

      const results: BulkUploadResult = {
        successCount: 0,
        errorCount: 0,
        errors: []
      };

      // Get existing suppliers for duplicate detection
      const { data: existingSuppliers } = await supabase
        .from('suppliers')
        .select('supplier_name, email, supplier_code');

      const existingNames = new Set(existingSuppliers?.map(s => s.supplier_name.toLowerCase()) || []);
      const existingEmails = new Set(existingSuppliers?.map(s => s.email.toLowerCase()) || []);
      const existingCodes = new Set(existingSuppliers?.map(s => s.supplier_code) || []);

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        setProgress((i / (lines.length - 1)) * 90);
        
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const rowData: any = {};
        
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        try {
          const supplierName = rowData.supplier_name || rowData.Supplier_Name;
          const contactPerson = rowData.contact_person || rowData.Contact_Person;
          const email = rowData.email || rowData.Email;
          const phone = rowData.phone || rowData.Phone;
          const address = rowData.address || rowData.Address;
          const city = rowData.city || rowData.City;
          const state = rowData.state || rowData.State;
          const pincode = rowData.pincode || rowData.Pincode;
          const gstin = rowData.gstin || rowData.GSTIN;
          const pan = rowData.pan || rowData.PAN;
          const paymentTerms = rowData.payment_terms || rowData.Payment_Terms;
          const creditLimit = rowData.credit_limit || rowData.Credit_Limit;
          const materialCategories = rowData.material_categories || rowData.Material_Categories;

          // Validation
          if (!supplierName) throw new Error("Supplier name is required");
          if (!contactPerson) throw new Error("Contact person is required");
          if (!email) throw new Error("Email is required");
          if (!phone) throw new Error("Phone is required");
          if (!address) throw new Error("Address is required");

          if (!validateEmail(email)) {
            throw new Error(`Invalid email format: ${email}`);
          }

          if (!validatePhone(phone)) {
            throw new Error(`Invalid phone format: ${phone}`);
          }

          // Check for duplicates
          if (existingNames.has(supplierName.toLowerCase())) {
            throw new Error(`Supplier already exists: ${supplierName}`);
          }

          if (existingEmails.has(email.toLowerCase())) {
            throw new Error(`Email already exists: ${email}`);
          }

          // Generate supplier code
          const supplierCode = generateSupplierCode(supplierName, existingCodes);
          existingCodes.add(supplierCode);

          // Parse credit limit
          const parsedCreditLimit = creditLimit ? parseFloat(creditLimit.toString()) : null;
          if (creditLimit && (isNaN(parsedCreditLimit!) || parsedCreditLimit! < 0)) {
            throw new Error(`Invalid credit limit: ${creditLimit}`);
          }

          // Prepare supplier data
          const supplierData = {
            supplier_name: supplierName,
            supplier_code: supplierCode,
            contact_person: contactPerson,
            email: email.toLowerCase(),
            phone,
            address: {
              street: address,
              city: city || null,
              state: state || null,
              pincode: pincode || null
            },
            payment_terms: paymentTerms || 'NET_30',
            credit_limit: parsedCreditLimit,
            is_active: true,
            material_categories: materialCategories ? materialCategories.split(',').map(c => c.trim()) : null
          };

          // Insert supplier
          const { error: insertError } = await supabase
            .from('suppliers')
            .insert([supplierData]);

          if (insertError) {
            if (insertError.code === '23505') {
              throw new Error(`Duplicate entry detected for: ${supplierName}`);
            }
            throw new Error(`Database error: ${insertError.message}`);
          }

          results.successCount++;
          existingNames.add(supplierName.toLowerCase());
          existingEmails.add(email.toLowerCase());

        } catch (error: any) {
          results.errorCount++;
          results.errors.push({
            rowNumber: i + 1,
            reason: error.message,
            data: headers.reduce((obj: any, header, index) => {
              obj[header] = values[index] || '';
              return obj;
            }, {})
          });
        }
      }

      // Log upload activity
      console.log('Upload completed:', {
        type: 'supplier',
        file_name: file.name,
        total_rows: lines.length - 1,
        successful_rows: results.successCount,
        failed_rows: results.errorCount
      });

      setProgress(100);
      return results;

    } catch (error: any) {
      console.error('Fatal error during supplier CSV processing:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: processCSV,
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      
      toast({
        title: "Suppliers Upload Completed",
        description: `${results.successCount} suppliers uploaded successfully${results.errorCount > 0 ? `, ${results.errorCount} errors found` : ''}`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "An error occurred during upload",
        variant: "destructive"
      });
    }
  });

  return {
    uploadMutation,
    isProcessing,
    progress
  };
}