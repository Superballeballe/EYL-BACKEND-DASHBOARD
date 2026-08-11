"use client";

import { useRef } from "react";
import { Button, Stack } from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import Link from "next/link";

export default function InvoiceViewActions({
  id,
  invoiceNumber,
  html,
}: {
  id: string;
  invoiceNumber: string;
  html: string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  function printInvoice() {
    const frame = frameRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }

  return (
    <>
      <iframe ref={frameRef} title={invoiceNumber} srcDoc={html} style={{ display: "none" }} />
      <Stack direction="row" spacing={1}>
        <Button component={Link} href="/invoices" variant="outlined" size="small">
          ← All invoices
        </Button>
        <Button variant="outlined" size="small" startIcon={<PrintOutlinedIcon />} onClick={printInvoice}>
          Download PDF
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<DownloadOutlinedIcon />}
          href={`/api/invoices/${id}/html?download=1`}
          component="a"
        >
          Download HTML
        </Button>
      </Stack>
    </>
  );
}
