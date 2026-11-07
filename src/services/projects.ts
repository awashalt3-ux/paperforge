import { db, getDocument, listPdfAssets } from "@/db/database";
import type { PaperDocument, ProjectFile, StoredPdfAsset } from "@/types/document";
import { arrayBufferToBase64, base64ToArrayBuffer } from "@/utils/files";
import { downloadBlob, safeFileName } from "@/lib/utils";
import { projectFileSchema, formatValidationError } from "@/utils/validation";
import { createAssetId, createDocumentId } from "@/utils/id";

export const PROJECT_MIME = "application/x-paperforge-project";

export class ProjectFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectFileError";
  }
}

export async function buildProjectFile(documentId: string): Promise<ProjectFile> {
  const document = await getDocument(documentId);
  if (!document) throw new ProjectFileError("This document no longer exists.");
  const assets = await listPdfAssets(documentId);
  return {
    format: "paperforge-project",
    version: 1,
    exportedAt: Date.now(),
    document,
    assets: assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      mimeType: asset.mimeType,
      pageCount: asset.pageCount,
      data: arrayBufferToBase64(asset.bytes),
    })),
  };
}

export async function exportProjectFile(documentId: string, title: string): Promise<void> {
  const project = await buildProjectFile(documentId);
  const blob = new Blob([JSON.stringify(project)], { type: "application/json" });
  downloadBlob(blob, safeFileName(title, "paperforge.json"));
}

function remapDocument(
  document: PaperDocument,
  documentId: string,
  assetMap: Map<string, string>,
): PaperDocument {
  const now = Date.now();
  return {
    ...structuredClone(document),
    id: documentId,
    createdAt: now,
    updatedAt: now,
    pages: document.pages.map((page) =>
      page.source
        ? {
            ...page,
            source: {
              ...page.source,
              assetId: assetMap.get(page.source.assetId) ?? page.source.assetId,
            },
          }
        : page,
    ),
  };
}

/**
 * Validate and import a Paperforge project. IDs are regenerated so importing a
 * project twice creates two independent documents and never overwrites work.
 */
export async function importProjectFile(file: File): Promise<PaperDocument> {
  if (file.size > 300 * 1024 * 1024) {
    throw new ProjectFileError("This project file is larger than the 300 MB import limit.");
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(await file.text());
  } catch {
    throw new ProjectFileError("This is not a readable Paperforge project file.");
  }
  const result = projectFileSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new ProjectFileError(
      `This project file is not valid. ${formatValidationError(result.error)}`,
    );
  }
  const project = result.data;
  const documentId = createDocumentId();
  const assetMap = new Map<string, string>();
  const assets: StoredPdfAsset[] = project.assets.map((asset) => {
    const id = createAssetId();
    assetMap.set(asset.id, id);
    return {
      id,
      documentId,
      name: asset.name,
      mimeType: asset.mimeType || "application/pdf",
      pageCount: asset.pageCount,
      bytes: base64ToArrayBuffer(asset.data),
      createdAt: Date.now(),
    };
  });

  const existing = await db.documents.get(project.document.id);
  const title = existing
    ? `${project.document.title} (imported)`
    : project.document.title;
  const document = remapDocument(project.document, documentId, assetMap);
  document.title = title;
  document.metadata = { ...document.metadata, title };

  await db.transaction("rw", db.documents, db.pdfAssets, async () => {
    await db.documents.put(document);
    for (const asset of assets) await db.pdfAssets.put(asset);
  });
  return document;
}
