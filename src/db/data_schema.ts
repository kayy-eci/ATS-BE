import { z } from "zod";

export const categorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(100, "Category name must be at most 100 characters"),

  slug: z
    .string()
    .min(1, "Slug is required")
    .max(120, "Slug must be at most 120 characters"),

  description: z
    .string()
    .nullable()
    .optional(),
});