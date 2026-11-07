/** A PDF affine transform: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const IDENTITY_AFFINE: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Compose two transforms. The inner transform is applied first. */
export function multiplyAffine(outer: Affine, inner: Affine): Affine {
  return {
    a: outer.a * inner.a + outer.c * inner.b,
    b: outer.b * inner.a + outer.d * inner.b,
    c: outer.a * inner.c + outer.c * inner.d,
    d: outer.b * inner.c + outer.d * inner.d,
    e: outer.a * inner.e + outer.c * inner.f + outer.e,
    f: outer.b * inner.e + outer.d * inner.f + outer.f,
  };
}

export function invertAffine(matrix: Affine): Affine {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (Math.abs(determinant) < 1e-10) {
    throw new Error("This transform cannot be inverted.");
  }
  const a = matrix.d / determinant;
  const b = -matrix.b / determinant;
  const c = -matrix.c / determinant;
  const d = matrix.a / determinant;
  return {
    a,
    b,
    c,
    d,
    e: -(a * matrix.e + c * matrix.f),
    f: -(b * matrix.e + d * matrix.f),
  };
}

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function normalizeRotation(angle: number): 0 | 90 | 180 | 270 {
  const normalized = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  return normalized as 0 | 90 | 180 | 270;
}

export interface VisualPageGeometry {
  rotation: 0 | 90 | 180 | 270;
  /** Width/height as displayed after /Rotate. */
  width: number;
  height: number;
  /** Maps visual coordinates (origin bottom-left, y up) into PDF user space. */
  visualToUser: Affine;
}

export function getVisualPageGeometry(
  rotationAngle: number,
  crop: CropBox,
): VisualPageGeometry {
  const rotation = normalizeRotation(rotationAngle);
  const x0 = crop.x;
  const y0 = crop.y;
  const x1 = crop.x + crop.width;
  const y1 = crop.y + crop.height;
  if (rotation === 0) {
    return {
      rotation,
      width: crop.width,
      height: crop.height,
      visualToUser: { a: 1, b: 0, c: 0, d: 1, e: x0, f: y0 },
    };
  }
  if (rotation === 90) {
    return {
      rotation,
      width: crop.height,
      height: crop.width,
      visualToUser: { a: 0, b: 1, c: -1, d: 0, e: x1, f: y0 },
    };
  }
  if (rotation === 180) {
    return {
      rotation,
      width: crop.width,
      height: crop.height,
      visualToUser: { a: -1, b: 0, c: 0, d: -1, e: x1, f: y1 },
    };
  }
  return {
    rotation,
    width: crop.height,
    height: crop.width,
    visualToUser: { a: 0, b: -1, c: 1, d: 0, e: x0, f: y1 },
  };
}

/**
 * Maps an element's local coordinate system (origin bottom-left, y up) into
 * the visual page coordinate system. CSS rotation is clockwise around the
 * element's top-left corner; positive PDF rotation is counter-clockwise.
 */
export function elementLocalToVisual(
  element: { x: number; y: number; width: number; height: number; rotation: number },
  pageHeight: number,
): Affine {
  const radians = ((element.rotation % 360) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    a: cos,
    b: -sin,
    c: sin,
    d: cos,
    e: element.x - sin * element.height,
    f: pageHeight - element.y - cos * element.height,
  };
}

export function isFiniteAffine(matrix: Affine): boolean {
  return Object.values(matrix).every((value) => Number.isFinite(value));
}
