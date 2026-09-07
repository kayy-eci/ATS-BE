import { z } from "zod";

export const datacategory = z.object({
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

export const datapost = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be at most 255 characters"),

  slug: z
    .string()
    .max(255, "Slug must be at most 255 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and hyphens"
    )
    .nullable()
    .optional(),

  content: z
    .string()
    .min(1, "Content is required"),

  excerpt: z
    .string()
    .max(255, "Excerpt must be at most 255 characters")
    .nullable()
    .optional(),

  cover_image: z
    .string()
    .max(255, "Cover image must be at most 255 characters")
    .nullable()
    .optional(),

  category_id: z
    .number()
    .int("Category ID must be an integer")
    .positive("Category ID must be positive"),

  author: z
    .string()
    .max(100, "Author must be at most 100 characters")
    .nullable()
    .optional(),

  status: z
    .enum(["draft", "published"])
    .default("published"),
});

