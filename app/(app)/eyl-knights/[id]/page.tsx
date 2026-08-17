import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import EylKnightReview from "@/components/EylKnightReview";
import { signedKnightDocuments } from "@/lib/server/knightDocuments";
import { fmtDate } from "@/lib/format";
import type { EylKnight } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EylKnightDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await supabaseAdmin().from("eyl_knights").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  const applicant = data as EylKnight;
  const documentUrls = await signedKnightDocuments(applicant.documents);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Knight applicant"
        subtitle={
          applicant.submitted_at
            ? `Submitted ${fmtDate(applicant.submitted_at)}`
            : "Onboarding in progress"
        }
        action={
          <Link href="/eyl-knights" className="btn btn-secondary">
            ← All applicants
          </Link>
        }
      />
      <EylKnightReview applicant={applicant} documentUrls={documentUrls} />
    </div>
  );
}
