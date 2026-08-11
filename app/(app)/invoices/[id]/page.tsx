import { notFound } from "next/navigation";
import { Box } from "@mui/material";
import { PageHeader } from "@/components/ui";
import InvoiceViewActions from "@/components/InvoiceViewActions";
import { fmtDateTime } from "@/lib/format";
import { getAppInvoiceBundle } from "@/lib/server/appInvoice";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getAppInvoiceBundle(id);
  if (!bundle) notFound();

  const { invoice, html } = bundle;

  return (
    <div>
      <PageHeader
        title={invoice.invoice_number}
        subtitle={`Order ${bundle.order?.order_code ?? "—"} · Issued ${fmtDateTime(invoice.issued_at)}`}
        action={<InvoiceViewActions id={id} invoiceNumber={invoice.invoice_number} html={html} />}
      />
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          bgcolor: "#fff",
          overflow: "hidden",
          minHeight: 640,
        }}
      >
        <Box
          component="iframe"
          title={invoice.invoice_number}
          srcDoc={html}
          sx={{ width: "100%", minHeight: 720, border: 0, display: "block", bgcolor: "#fff" }}
        />
      </Box>
    </div>
  );
}
