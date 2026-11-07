export type FontFamily = "Inter" | "Helvetica" | "Times New Roman" | "Courier New";

export type TextAlign = "left" | "center" | "right";
export type TextRole = "heading" | "subheading" | "body" | "caption";
export type ImageRole = "image" | "logo" | "signature";
export type ShapeKind = "rectangle" | "ellipse" | "line";
export type ShapePurpose = "shape" | "highlight";

export interface ElementBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  name?: string;
}

export interface TextElement extends ElementBase {
  type: "text";
  text: string;
  role: TextRole;
  fontFamily: FontFamily;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  color: string;
  align: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  backgroundColor?: string;
  padding: number;
}

export interface ImageElement extends ElementBase {
  type: "image";
  role: ImageRole;
  src: string;
  fit: "contain" | "cover" | "fill";
  cornerRadius: number;
  alt?: string;
}

export interface ShapeElement extends ElementBase {
  type: "shape";
  shape: ShapeKind;
  purpose: ShapePurpose;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  dash?: number[];
}

export interface TableElement extends ElementBase {
  type: "table";
  rows: string[][];
  headerRow: boolean;
  fontFamily: FontFamily;
  fontSize: number;
  color: string;
  headerColor: string;
  headerBackground: string;
  borderColor: string;
  borderWidth: number;
  cellPadding: number;
  rowHeights?: number[];
  columnWeights?: number[];
}

export type PaperElement = TextElement | ImageElement | ShapeElement | TableElement;
export type ElementType = PaperElement["type"];

export interface PageSourceRef {
  assetId: string;
  pageIndex: number;
  /** Additional rotation applied on top of the source page rotation. */
  rotationOffset?: number;
  originalName?: string;
}

export interface PaperPage {
  id: string;
  width: number;
  height: number;
  background: string;
  elements: PaperElement[];
  source?: PageSourceRef;
}

export interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  creator: string;
}

export interface PaperDocument {
  id: string;
  title: string;
  pages: PaperPage[];
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  templateId?: string;
  metadata: PdfMetadata;
}

export interface DocumentSummary {
  id: string;
  title: string;
  pageCount: number;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  templateId?: string;
}

export type EditorTool =
  | "select"
  | "text"
  | "image"
  | "shape"
  | "table"
  | "highlight"
  | "signature";

export interface StoredPdfAsset {
  id: string;
  documentId: string;
  name: string;
  mimeType: string;
  bytes: ArrayBuffer;
  pageCount: number;
  createdAt: number;
}

export interface ProjectAsset {
  id: string;
  name: string;
  mimeType: string;
  pageCount: number;
  data: string; // base64
}

export interface ProjectFile {
  format: "paperforge-project";
  version: 1;
  exportedAt: number;
  document: PaperDocument;
  assets: ProjectAsset[];
}
