import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "knight-documents";

export async function signedKnightDocumentUrl(stored: string | null | undefined) {
  if (!stored) return null;
  if (stored.startsWith("http") || stored.startsWith("test://")) return stored;
  const { data, error } = await supabaseAdmin()
    .storage.from(BUCKET)
    .createSignedUrl(stored, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function signedKnightDocuments(documents: Record<string, string> | null | undefined) {
  const entries = Object.entries(documents ?? {});
  const signed = await Promise.all(
    entries.map(async ([key, value]) => [key, await signedKnightDocumentUrl(value)] as const),
  );
  return Object.fromEntries(signed);
}
