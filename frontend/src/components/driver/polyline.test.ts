import { describe, expect, it } from 'vitest';
import { decodePolyline, safeDecodePolyline } from './polyline';
import { isStraightLineEstimate } from './DriverRouteMap';

describe('decodePolyline', () => {
  it('matches the Google reference vector (same as the backend encoder test)', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it('returns [] for empty or truncated input in the safe variant', () => {
    expect(safeDecodePolyline('')).toEqual([]);
    expect(safeDecodePolyline(null)).toEqual([]);
    expect(() => decodePolyline('_p~iF~ps|')).toThrow();
    expect(safeDecodePolyline('_p~iF~ps|')).toEqual([]);
  });
});

describe('isStraightLineEstimate', () => {
  it('draws only heuristic routes dashed', () => {
    expect(isStraightLineEstimate('heuristic')).toBe(true);
    expect(isStraightLineEstimate('osrm')).toBe(false);
    expect(isStraightLineEstimate('tomtom')).toBe(false);
  });
});
