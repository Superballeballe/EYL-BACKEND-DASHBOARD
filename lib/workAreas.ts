/** App-side work area slugs → ops-friendly labels. */
const WORK_AREA_LABELS: Record<string, string> = {
  south: "South Mumbai",
  western_suburbs: "Western Suburbs",
  western_north: "Western North",
  harbour: "Harbour Line",
};

export function formatWorkArea(slug: string): string {
  return (
    WORK_AREA_LABELS[slug] ??
    slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function formatWorkAreas(areas: string[] | null | undefined): string[] {
  return (areas ?? []).map(formatWorkArea);
}
