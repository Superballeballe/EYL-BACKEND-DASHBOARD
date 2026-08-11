import { getAppInvoiceBundle } from "@/lib/server/appInvoice";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getAppInvoiceBundle(id);
  if (!bundle) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const download = url.searchParams.get("download") === "1";
  const filename = `${bundle.invoice.invoice_number.replace(/[^\w.-]+/g, "_")}.html`;

  return new Response(bundle.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...(download
        ? { "Content-Disposition": `attachment; filename="${filename}"` }
        : { "Content-Disposition": "inline" }),
    },
  });
}
