/**
 * Google encoded polyline decoder (precision 5), matching the backend's
 * app/routing/geo.py encoder used by POST /routes/calculate and current-job.
 */

export type LatLngTuple = [number, number];

export function decodePolyline(encoded: string, precision = 5): LatLngTuple[] {
  const factor = 10 ** precision;
  const points: LatLngTuple[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    const deltas: number[] = [];
    for (let i = 0; i < 2; i += 1) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        if (index >= encoded.length) throw new Error('truncated polyline');
        byte = encoded.charCodeAt(index) - 63;
        index += 1;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      deltas.push(result & 1 ? ~(result >> 1) : result >> 1);
    }
    lat += deltas[0];
    lng += deltas[1];
    points.push([lat / factor, lng / factor]);
  }
  return points;
}

/** Decode, returning [] for empty or malformed input instead of throwing. */
export function safeDecodePolyline(encoded: string | null | undefined): LatLngTuple[] {
  if (!encoded) return [];
  try {
    return decodePolyline(encoded);
  } catch {
    return [];
  }
}
