import { z } from "zod";

export const itemMasterSchema = z.object({
  item_code: z.string().min(1, "Item code is required"),
  item_name: z.string().min(2, "Item name must be at least 2 characters"),
  category_id: z.string().uuid("Invalid category"),
  qualifier: z.string().optional(),
  gsm: z.number().positive("GSM must be positive").max(500, "GSM seems too high").optional(),
  size_mm: z.string().optional(),
  uom: z.enum(["PCS", "KG", "MTR", "SQM", "LTR", "BOX", "ROLL"], {
    errorMap: () => ({ message: "Please select a valid unit of measure" })
  }),
  usage_type: z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "WIP", "PACKAGING", "CONSUMABLE"]).default("RAW_MATERIAL"),
  status: z.enum(["active", "inactive"]).default("active")
});

export const itemMasterUpdateSchema = itemMasterSchema.partial().omit({ item_code: true });

export type ItemMasterFormData = z.infer<typeof itemMasterSchema>;

export const csvItemSchema = z.object({
  item_name: z.string().min(1, "Item name is required"),
  category_name: z.string().min(1, "Category name is required"),
  qualifier: z.string().optional(),
  gsm: z.string().optional().transform((val) => val ? parseFloat(val) : undefined),
  size_mm: z.string().optional(),
  uom: z.enum(["PCS", "KG", "MTR", "SQM", "LTR", "BOX", "ROLL"]),
  usage_type: z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "WIP", "PACKAGING", "CONSUMABLE"]).optional(),
  reorder_level: z.string().optional().transform((val) => val ? parseFloat(val) : undefined),
  specifications: z.string().optional()
});

export type CsvItemData = z.infer<typeof csvItemSchema>;