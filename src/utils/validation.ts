import { z } from "zod";

const hexColor = z.string().min(3).max(64);
const finiteNumber = z.number().finite();

const baseElementSchema = z.object({
  id: z.string().min(1),
  x: finiteNumber,
  y: finiteNumber,
  width: finiteNumber.positive(),
  height: finiteNumber.positive(),
  rotation: finiteNumber,
  opacity: finiteNumber.min(0).max(1),
  locked: z.boolean(),
  visible: z.boolean(),
  name: z.string().optional(),
});

const textElementSchema = baseElementSchema.extend({
  type: z.literal("text"),
  text: z.string(),
  role: z.enum(["heading", "subheading", "body", "caption"]),
  fontFamily: z.enum(["Inter", "Helvetica", "Times New Roman", "Courier New"]),
  fontSize: finiteNumber.min(4).max(400),
  fontWeight: z.number().int().min(100).max(900),
  italic: z.boolean(),
  underline: z.boolean(),
  color: hexColor,
  align: z.enum(["left", "center", "right"]),
  lineHeight: finiteNumber.min(0.5).max(4),
  letterSpacing: finiteNumber.min(-20).max(80),
  backgroundColor: hexColor.optional(),
  padding: finiteNumber.min(0).max(100),
});

const imageElementSchema = baseElementSchema.extend({
  type: z.literal("image"),
  role: z.enum(["image", "logo", "signature"]),
  src: z.string().min(1),
  fit: z.enum(["contain", "cover", "fill"]),
  cornerRadius: finiteNumber.min(0),
  alt: z.string().optional(),
});

const shapeElementSchema = baseElementSchema.extend({
  type: z.literal("shape"),
  shape: z.enum(["rectangle", "ellipse", "line"]),
  purpose: z.enum(["shape", "highlight"]),
  fill: hexColor,
  stroke: hexColor,
  strokeWidth: finiteNumber.min(0).max(100),
  cornerRadius: finiteNumber.min(0),
  dash: z.array(finiteNumber).optional(),
});

const tableElementSchema = baseElementSchema.extend({
  type: z.literal("table"),
  rows: z.array(z.array(z.string())).min(1).max(200),
  headerRow: z.boolean(),
  fontFamily: z.enum(["Inter", "Helvetica", "Times New Roman", "Courier New"]),
  fontSize: finiteNumber.min(4).max(80),
  color: hexColor,
  headerColor: hexColor,
  headerBackground: hexColor,
  borderColor: hexColor,
  borderWidth: finiteNumber.min(0).max(10),
  cellPadding: finiteNumber.min(0).max(40),
  rowHeights: z.array(finiteNumber).optional(),
  columnWeights: z.array(finiteNumber).optional(),
});

export const paperElementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  imageElementSchema,
  shapeElementSchema,
  tableElementSchema,
]);

export const pageSourceSchema = z.object({
  assetId: z.string().min(1),
  pageIndex: z.number().int().min(0),
  rotationOffset: z.number().optional(),
  originalName: z.string().optional(),
});

export const paperPageSchema = z.object({
  id: z.string().min(1),
  width: finiteNumber.min(50).max(20000),
  height: finiteNumber.min(50).max(20000),
  background: hexColor,
  elements: z.array(paperElementSchema).max(10000),
  source: pageSourceSchema.optional(),
});

export const pdfMetadataSchema = z.object({
  title: z.string(),
  author: z.string(),
  subject: z.string(),
  keywords: z.array(z.string()),
  creator: z.string(),
});

export const paperDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(300),
  pages: z.array(paperPageSchema).min(1).max(500),
  createdAt: finiteNumber,
  updatedAt: finiteNumber,
  thumbnail: z.string().optional(),
  templateId: z.string().optional(),
  deletedAt: finiteNumber.optional(),
  metadata: pdfMetadataSchema,
});

export const projectAssetSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  mimeType: z.string(),
  pageCount: z.number().int().min(1),
  data: z.string().min(1),
});

export const projectFileSchema = z.object({
  format: z.literal("paperforge-project"),
  version: z.literal(1),
  exportedAt: finiteNumber,
  document: paperDocumentSchema,
  assets: z.array(projectAssetSchema),
});

export type ValidatedProjectFile = z.infer<typeof projectFileSchema>;

export function formatValidationError(error: z.ZodError): string {
  const first = error.errors[0];
  if (!first) return "The project data is not valid.";
  return `${first.path.join(".") || "file"}: ${first.message}`;
}
