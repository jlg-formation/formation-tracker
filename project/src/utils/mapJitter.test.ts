import { describe, expect, it } from "vitest";
import { getJitteredLatLng } from "./mapJitter";

describe("getJitteredLatLng", () => {
  it("returns the original position for index 0", () => {
    const pos = getJitteredLatLng({
      lat: 48.8566,
      lng: 2.3522,
      index: 0,
      total: 10
    });
    expect(pos).toEqual({ lat: 48.8566, lng: 2.3522 });
  });

  it("is deterministic for the same inputs", () => {
    const a = getJitteredLatLng({
      lat: 48.8566,
      lng: 2.3522,
      index: 3,
      total: 10
    });
    const b = getJitteredLatLng({
      lat: 48.8566,
      lng: 2.3522,
      index: 3,
      total: 10
    });
    expect(a).toEqual(b);
  });

  it("produces distinct positions for different indices", () => {
    const a = getJitteredLatLng({
      lat: 48.8566,
      lng: 2.3522,
      index: 1,
      total: 10
    });
    const b = getJitteredLatLng({
      lat: 48.8566,
      lng: 2.3522,
      index: 2,
      total: 10
    });

    expect(a).not.toEqual(b);

    // Should remain close to the original (sub-kilometer offsets)
    expect(Math.abs(a.lat - 48.8566)).toBeLessThan(0.01);
    expect(Math.abs(a.lng - 2.3522)).toBeLessThan(0.01);
    expect(Math.abs(b.lat - 48.8566)).toBeLessThan(0.01);
    expect(Math.abs(b.lng - 2.3522)).toBeLessThan(0.01);
  });

  it("returns original when total <= 1", () => {
    const pos = getJitteredLatLng({ lat: 46.6, lng: 1.88, index: 5, total: 1 });
    expect(pos).toEqual({ lat: 46.6, lng: 1.88 });
  });
});
