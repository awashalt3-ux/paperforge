import Dexie, { type Table } from "dexie";
import type { DocumentSummary, PaperDocument, StoredPdfAsset } from "@/types/document";

export const DB_NAME = "paperforge-db";
export const DB_VERSION = 2;

/** Documents live in the trash for this long before they are purged. */
export const TRASH_RETENTION_DAYS = 30;
export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** True when a trashed document has outlived the retention window. */
export function isTrashExpired(deletedAt: number | undefined, now = Date.now()): boolean {
  if (!deletedAt) return false;
  return deletedAt < now - TRASH_RETENTION_MS;
}

/** Human-readable "days left" for a trashed document, floored at zero. */
export function trashDaysRemaining(deletedAt: number, now = Date.now()): number {
  const remaining = deletedAt + TRASH_RETENTION_MS - now;
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

export class PaperforgeDatabase extends Dexie {
  documents!: Table<PaperDocument, string>;
  pdfAssets!: Table<StoredPdfAsset, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      documents: "id, updatedAt, createdAt, title, templateId",
      pdfAssets: "id, documentId, createdAt",
    });
    // v2 adds a deletedAt index so the trash can be queried without scanning.
    // Existing documents are untouched; the index is simply not populated yet.
    this.version(DB_VERSION).stores({
      documents: "id, updatedAt, createdAt, title, templateId, deletedAt",
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
    deletedAt: document.deletedAt,
  };
}

/** Documents in the workspace, newest edit first. Trashed documents are excluded. */
export async function listDocumentSummaries(): Promise<DocumentSummary[]> {
  const docs = await db.documents.orderBy("updatedAt").reverse().toArray();
  return docs.filter((doc) => !doc.deletedAt).map(toSummary);
}

/** Documents currently in the trash, most recently deleted first. */
export async function listTrashedDocumentSummaries(): Promise<DocumentSummary[]> {
  const docs = await db.documents.toArray();
  return docs
    .filter((doc) => Boolean(doc.deletedAt))
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
    .map(toSummary);
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

/** Move a document into the trash. Its PDF assets are kept so it can be restored. */
export async function trashDocument(id: string, when = Date.now()): Promise<void> {
  await db.documents.update(id, { deletedAt: when });
}

/** Restore a document from the trash. */
export async function restoreDocument(id: string): Promise<void> {
  await db.documents.update(id, { deletedAt: undefined, updatedAt: Date.now() });
}

/** Permanently remove a document and every PDF asset it owns. */
export async function deleteDocumentCascade(id: string): Promise<void> {
  await db.transaction("rw", db.documents, db.pdfAssets, async () => {
    await db.pdfAssets.where("documentId").equals(id).delete();
    await db.documents.delete(id);
  });
}

/** Permanently remove every document currently in the trash. */
export async function emptyTrash(): Promise<number> {
  const docs = await db.documents.toArray();
  const trashed = docs.filter((doc) => Boolean(doc.deletedAt));
  for (const document of trashed) {
    await deleteDocumentCascade(document.id);
  }
  return trashed.length;
}

/**
 * Purge documents that have been in the trash for longer than the retention
 * window. Returns the ids that were removed. Safe to call on every app start.
 */
export async function purgeExpiredTrash(now = Date.now()): Promise<string[]> {
  const cutoff = now - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const docs = await db.documents.toArray();
  const expired = docs.filter((doc) => doc.deletedAt && doc.deletedAt < cutoff);
  for (const document of expired) {
    await deleteDocumentCascade(document.id);
  }
  return expired.map((document) => document.id);
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
    deletedAt: undefined,
    thumbnail: undefined,
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
