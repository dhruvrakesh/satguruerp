
import { CsvItemData } from "@/schemas/itemMasterSchema";

export interface ParsedRecord extends CsvItemData {
  row_number: number;
  action: 'INSERT' | 'UPDATE';
  existing_item?: any;
  category_id?: string | null;
  validation_errors?: string[];
  can_process: boolean;
}

export interface UpsertSummary {
  total: number;
  updates: number;
  inserts: number;
  errors: number;
  processed: number;
  category_errors: number;
  validation_errors: number;
}

export interface CategoryMapping {
  [key: string]: string;
}

export interface UpsertProgress {
  current: number;
  total: number;
  stage: 'analyzing' | 'processing' | 'complete';
  currentRecord?: ParsedRecord;
}
