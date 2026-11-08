export function haversineNm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 3440.065;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function quote(hourlyFrom: number, hourlyTo: number, nm: number, kts: number) {
  const hours = Math.max(1.1, nm / Math.max(kts, 200) + 0.45);
  const round = (n: number) => Math.round(n / 100) * 100;
  return {
    hours: Math.round(hours * 10) / 10,
    price_low: round(hourlyFrom * hours),
    price_high: round(hourlyTo * hours),
  };
}

/** A launch point far enough from the destination for the flight to read. */
export function arcLaunch(dest: { lat: number; lng: number }) {
  let lng = dest.lng + (dest.lng > 20 ? -78 : 78);
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;
  const lat = Math.max(-42, Math.min(52, -dest.lat * 0.25 + 12));
  return { lat, lng, label: "" };
}

export function isIsoDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isoLocal(d: Date) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return isoLocal(d);
}
