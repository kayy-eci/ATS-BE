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

  description: z.string().nullable().optional(),
});

export type CategoryInput = z.infer<typeof datacategory>;

// Multipart/form-data selalu mengirim semua field sebagai string,
// jadi category_id harus di-coerce ("3" -> 3) dan string kosong
// ("") dianggap tidak diisi agar field opsional lolos validasi.
const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema);

export const dataposts = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be at most 255 characters"),

  slug: emptyToUndefined(
    z
      .string()
      .max(255, "Slug must be at most 255 characters")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must contain only lowercase letters, numbers, and hyphens",
      )
      .nullable()
      .optional(),
  ),

  content: z.string().min(1, "Content is required"),

  excerpt: emptyToUndefined(
    z
      .string()
      .max(255, "Excerpt must be at most 255 characters")
      .nullable()
      .optional(),
  ),

  cover_image: emptyToUndefined(
    z
      .string()
      .max(255, "Cover image must be at most 255 characters")
      .nullable()
      .optional(),
  ),

  category_id: z.coerce
    .number<number>()
    .int("Category ID must be an integer")
    .positive("Category ID must be positive"),

  author: emptyToUndefined(
    z
      .string()
      .max(100, "Author must be at most 100 characters")
      .nullable()
      .optional(),
  ),

  status: z.enum(["draft", "published"]).default("published"),
});

export type PostInput = z.infer<typeof dataposts>;

export const datausers = z.object({
  username: z.string().min(4),
  email: z.email("invalid email addresess"),
  password: z.string().min(4),
});

export const credentials = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(4)
})