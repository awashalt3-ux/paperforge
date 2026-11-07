export function createId(prefix = "el"): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

export function createDocumentId(): string {
  return createId("doc");
}

export function createPageId(): string {
  return createId("pg");
}

export function createElementId(): string {
  return createId("el");
}

export function createAssetId(): string {
  return createId("asset");
}
