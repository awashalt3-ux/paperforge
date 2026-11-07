import { describe, expect, it } from "vitest";
import {
  IDENTITY_AFFINE,
  elementLocalToVisual,
  getVisualPageGeometry,
  invertAffine,
  isFiniteAffine,
  multiplyAffine,
  normalizeRotation,
  type Affine,
} from "./pdfGeometry";

const expectAffine = (actual: Affine, expected: Affine) => {
  expect(actual.a).toBeCloseTo(expected.a, 8);
  expect(actual.b).toBeCloseTo(expected.b, 8);
  expect(actual.c).toBeCloseTo(expected.c, 8);
  expect(actual.d).toBeCloseTo(expected.d, 8);
  expect(actual.e).toBeCloseTo(expected.e, 8);
  expect(actual.f).toBeCloseTo(expected.f, 8);
};

describe("affine transforms", () => {
  it("composes transforms with the inner transform applied first", () => {
    const translated = multiplyAffine(
      { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 },
      { a: 2, b: 0, c: 0, d: 3, e: 0, f: 0 },
    );
    expectAffine(translated, { a: 2, b: 0, c: 0, d: 3, e: 10, f: 20 });

    const rotated = multiplyAffine(
      { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 },
      { a: 1, b: 0, c: 0, d: 1, e: 5, f: 7 },
    );
    expectAffine(rotated, { a: 0, b: 1, c: -1, d: 0, e: -7, f: 5 });
  });

  it("inverts a transform and round-trips through the identity", () => {
    const matrix: Affine = { a: 2, b: 0.5, c: -1, d: 3, e: 12, f: -8 };
    const inverse = invertAffine(matrix);
    expectAffine(multiplyAffine(matrix, inverse), IDENTITY_AFFINE);
    expectAffine(multiplyAffine(inverse, matrix), IDENTITY_AFFINE);
  });

  it("rejects a singular transform", () => {
    expect(() => invertAffine({ a: 1, b: 2, c: 2, d: 4, e: 0, f: 0 })).toThrow(
      "This transform cannot be inverted.",
    );
  });

  it("reports whether every coefficient is finite", () => {
    expect(isFiniteAffine(IDENTITY_AFFINE)).toBe(true);
    expect(isFiniteAffine({ ...IDENTITY_AFFINE, e: Number.NaN })).toBe(false);
  });
});

describe("normalizeRotation", () => {
  it("normalizes positive, negative, and fractional angles", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(-450)).toBe(270);
    expect(normalizeRotation(179)).toBe(180);
  });
});

describe("getVisualPageGeometry", () => {
  const crop = { x: 10, y: 20, width: 100, height: 200 };

  it("keeps crop-box dimensions and offset at zero rotation", () => {
    const geometry = getVisualPageGeometry(0, crop);
    expect(geometry).toMatchObject({ rotation: 0, width: 100, height: 200 });
    expectAffine(geometry.visualToUser, { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 });
  });

  it("swaps dimensions and maps rotated corners at 90 degrees", () => {
    const geometry = getVisualPageGeometry(90, crop);
    expect(geometry).toMatchObject({ rotation: 90, width: 200, height: 100 });
    expectAffine(geometry.visualToUser, { a: 0, b: 1, c: -1, d: 0, e: 110, f: 20 });
  });

  it("flips both axes at 180 degrees", () => {
    const geometry = getVisualPageGeometry(180, crop);
    expect(geometry).toMatchObject({ rotation: 180, width: 100, height: 200 });
    expectAffine(geometry.visualToUser, { a: -1, b: 0, c: 0, d: -1, e: 110, f: 220 });
  });

  it("swaps dimensions and maps rotated corners at 270 degrees", () => {
    const geometry = getVisualPageGeometry(270, crop);
    expect(geometry).toMatchObject({ rotation: 270, width: 200, height: 100 });
    expectAffine(geometry.visualToUser, { a: 0, b: -1, c: 1, d: 0, e: 10, f: 220 });
  });
});

describe("elementLocalToVisual", () => {
  it("places an unrotated element using top-left visual coordinates", () => {
    const matrix = elementLocalToVisual(
      { x: 10, y: 20, width: 100, height: 50, rotation: 0 },
      800,
    );
    expectAffine(matrix, { a: 1, b: 0, c: 0, d: 1, e: 10, f: 730 });
  });

  it("rotates an element clockwise around its top-left corner", () => {
    const matrix = elementLocalToVisual(
      { x: 10, y: 20, width: 100, height: 50, rotation: 90 },
      800,
    );
    expectAffine(matrix, { a: 0, b: -1, c: 1, d: 0, e: -40, f: 780 });
  });

  it("normalizes full turns", () => {
    expectAffine(
      elementLocalToVisual({ x: 5, y: 8, width: 10, height: 12, rotation: 360 }, 100),
      elementLocalToVisual({ x: 5, y: 8, width: 10, height: 12, rotation: 0 }, 100),
    );
  });
});
