import Dexie, { type Table } from "dexie";
import type { DocumentSummary, PaperDocument, StoredPdfAsset } from "@/types/document";

export const DB_NAME = "paperforge-db";
export const DB_VERSION = 1;

export class PaperforgeDatabase extends Dexie {
  documents!: Table<PaperDocument, string>;
  pdfAssets!: Table<StoredPdfAsset, string>;

  constructor() {
    super(DB_NAME);
    this.version(DB_VERSION).stores({
      documents: "id, updatedAt, createdAt, title, templateId",
      pdfAssets: "id, documentId, createdAt",
    });
  }
}

export const db = new PaperforgeDatabase();

export function toSummary(document: PaperDocument): DocumentSummary {
  return {
    id: document.id,
    title: document.title,
    pageCount: document.pages.length,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    thumbnail: document.thumbnail,
    templateId: document.templateId,
  };
}

export async function listDocumentSummaries(): Promise<DocumentSummary[]> {
  const docs = await db.documents.orderBy("updatedAt").reverse().toArray();
  return docs.map(toSummary);
}

export async function getDocument(id: string): Promise<PaperDocument | undefined> {
  return db.documents.get(id);
}

export async function putDocument(document: PaperDocument): Promise<void> {
  await db.documents.put(document);
}

export async function updateDocumentThumbnail(
  id: string,
  thumbnail: string | undefined,
): Promise<void> {
  if (!thumbnail) return;
  await db.documents.update(id, { thumbnail });
}

export async function deleteDocumentCascade(id: string): Promise<void> {
  await db.transaction("rw", db.documents, db.pdfAssets, async () => {
    await db.pdfAssets.where("documentId").equals(id).delete();
    await db.documents.delete(id);
  });
}

export async function putPdfAsset(asset: StoredPdfAsset): Promise<void> {
  await db.pdfAssets.put(asset);
}

export async function getPdfAsset(id: string): Promise<StoredPdfAsset | undefined> {
  return db.pdfAssets.get(id);
}

export async function listPdfAssets(documentId: string): Promise<StoredPdfAsset[]> {
  return db.pdfAssets.where("documentId").equals(documentId).toArray();
}

export async function getPdfAssetMap(documentId: string): Promise<Map<string, StoredPdfAsset>> {
  const assets = await listPdfAssets(documentId);
  return new Map(assets.map((asset) => [asset.id, asset]));
}

export async function duplicateDocumentRecord(
  id: string,
  newId: string,
  newTitle: string,
): Promise<PaperDocument | null> {
  const original = await getDocument(id);
  if (!original) return null;
  const now = Date.now();
  const clone: PaperDocument = {
    ...structuredClone(original),
    id: newId,
    title: newTitle,
    createdAt: now,
    updatedAt: now,
    metadata: { ...original.metadata, title: newTitle },
  };

  const assets = await listPdfAssets(id);
  await db.transaction("rw", db.documents, db.pdfAssets, async () => {
    await db.documents.put(clone);
    for (const asset of assets) {
      await db.pdfAssets.put({
        ...asset,
        id: `${asset.id}_dup_${newId.slice(-8)}`,
        documentId: newId,
      });
    }
  });

  // Point copied pages at the duplicated assets.
  const assetMap = new Map(assets.map((a) => [a.id, `${a.id}_dup_${newId.slice(-8)}`]));
  clone.pages = clone.pages.map((page) =>
    page.source
      ? {
          ...page,
          source: { ...page.source, assetId: assetMap.get(page.source.assetId) ?? page.source.assetId },
        }
      : page,
  );
  await db.documents.put(clone);
  return clone;
}

export async function clearAllData(): Promise<void> {
  await db.transaction("rw", db.documents, db.pdfAssets, async () => {
    await db.documents.clear();
    await db.pdfAssets.clear();
  });
}
