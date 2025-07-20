
import { supabase } from "@/integrations/supabase/client";

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  webViewLink: string;
  webContentLink?: string;
}

interface GoogleDriveApiResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}

export class GoogleDriveService {
  private static readonly FOLDER_ID = '17FalrRGel610MbFhP_hs8mDIvRhelW36';
  private static readonly API_KEY = 'YOUR_GOOGLE_DRIVE_API_KEY'; // This should come from Supabase secrets

  static async listFiles(): Promise<GoogleDriveFile[]> {
    try {
      // For now, we'll simulate the Google Drive API call with the actual file structure
      // In production, this would make a real API call to Google Drive
      const mockFiles: GoogleDriveFile[] = [
        {
          id: 'file_1',
          name: 'D8411296_Reckitt_Dettol_Soap_75g_65x24MM.pdf',
          mimeType: 'application/pdf',
          size: '1024000',
          modifiedTime: new Date().toISOString(),
          webViewLink: `https://drive.google.com/file/d/file_1/view`,
          webContentLink: `https://drive.google.com/uc?id=file_1&export=download`
        },
        {
          id: 'file_2',
          name: 'PS20250264_Dabur_Red_Paste_200g_312X168.pdf',
          mimeType: 'application/pdf',
          size: '2048000',
          modifiedTime: new Date().toISOString(),
          webViewLink: `https://drive.google.com/file/d/file_2/view`,
          webContentLink: `https://drive.google.com/uc?id=file_2&export=download`
        },
        {
          id: 'file_3',
          name: 'VV20250101_Vivel_Body_Lotion_400ml_97x300mm.pdf',
          mimeType: 'application/pdf',
          size: '1536000',
          modifiedTime: new Date().toISOString(),
          webViewLink: `https://drive.google.com/file/d/file_3/view`,
          webContentLink: `https://drive.google.com/uc?id=file_3&export=download`
        },
        {
          id: 'file_4',
          name: 'HUL20250201_Ponds_Cold_Cream_100g_89x145MM.pdf',
          mimeType: 'application/pdf',
          size: '1792000',
          modifiedTime: new Date().toISOString(),
          webViewLink: `https://drive.google.com/file/d/file_4/view`,
          webContentLink: `https://drive.google.com/uc?id=file_4&export=download`
        },
        {
          id: 'file_5',
          name: 'SP001_Superia_Premium_50g_120x80.pdf',
          mimeType: 'application/pdf',
          size: '1280000',
          modifiedTime: new Date().toISOString(),
          webViewLink: `https://drive.google.com/file/d/file_5/view`,
          webContentLink: `https://drive.google.com/uc?id=file_5&export=download`
        }
      ];

      return mockFiles;
    } catch (error) {
      console.error('Error fetching Google Drive files:', error);
      throw error;
    }
  }

  static async downloadFile(fileId: string, fileName: string): Promise<File> {
    // Simulate file download - in production this would download from Google Drive
    const blob = new Blob(['Mock PDF content'], { type: 'application/pdf' });
    return new File([blob], fileName, { type: 'application/pdf' });
  }
}

export interface ParsedSpecificationData {
  item_code: string | null;
  customer_name: string | null;
  product_name: string | null;
  dimensions: string | null;
  material_specs: string | null;
  confidence_score: number;
}

export class SpecificationParser {
  static parseUnderscoreDelimitedFilename(filename: string): ParsedSpecificationData {
    console.log('Parsing filename:', filename);
    
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    
    // Split by underscore
    const parts = nameWithoutExt.split('_');
    console.log('Filename parts:', parts);
    
    let confidence = 0.1;
    let item_code: string | null = null;
    let customer_name: string | null = null;
    let product_name: string | null = null;
    let dimensions: string | null = null;
    let material_specs: string | null = null;

    if (parts.length >= 4) {
      // Expected format: ITEM_CODE_CUSTOMER_PRODUCT_VARIANT_DIMENSIONS
      item_code = parts[0];
      customer_name = parts[1];
      
      // Join middle parts as product name (could be multiple parts)
      const productParts = [];
      let dimensionIndex = -1;
      
      // Find dimensions part (contains x or X and ends with measurement unit)
      for (let i = 2; i < parts.length; i++) {
        if (parts[i].match(/\d+[xX×]\d+(?:mm|MM)?$/)) {
          dimensionIndex = i;
          dimensions = parts[i];
          break;
        }
      }
      
      // Everything between customer and dimensions is product name
      if (dimensionIndex > 2) {
        for (let i = 2; i < dimensionIndex; i++) {
          productParts.push(parts[i]);
        }
      } else if (parts.length > 2) {
        // If no dimensions found, take remaining parts as product
        for (let i = 2; i < parts.length; i++) {
          productParts.push(parts[i]);
        }
      }
      
      product_name = productParts.join(' ');
      
      // Calculate confidence based on what we successfully parsed
      if (item_code) confidence += 0.3;
      if (customer_name) confidence += 0.2;
      if (product_name) confidence += 0.2;
      if (dimensions) confidence += 0.3;
    }

    const result = {
      item_code,
      customer_name,
      product_name,
      dimensions,
      material_specs,
      confidence_score: Math.min(confidence, 1.0)
    };

    console.log('Parsed result:', result);
    return result;
  }

  static async findMatchingArtworkItem(itemCode: string): Promise<string | null> {
    if (!itemCode) return null;

    try {
      // Try exact match first
      const { data: exactMatch } = await supabase
        .from('master_data_artworks_se')
        .select('item_code')
        .eq('item_code', itemCode)
        .single();

      if (exactMatch) {
        return exactMatch.item_code;
      }

      // Try fuzzy matching
      const { data: fuzzyMatches } = await supabase
        .from('master_data_artworks_se')
        .select('item_code')
        .ilike('item_code', `%${itemCode}%`)
        .limit(1);

      return fuzzyMatches && fuzzyMatches.length > 0 ? fuzzyMatches[0].item_code : null;
    } catch (error) {
      console.error('Error finding matching artwork item:', error);
      return null;
    }
  }
}
