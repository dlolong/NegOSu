export type ChartPoint = { label: string; value: number };

export function statusChart(rows: readonly { status: string }[]): ChartPoint[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label: label.replaceAll("_", " "), value }));
}

export function chartMaximum(points: readonly ChartPoint[]): number {
  return Math.max(1, ...points.map(point => Number.isFinite(point.value) ? Math.max(0, point.value) : 0));
}
