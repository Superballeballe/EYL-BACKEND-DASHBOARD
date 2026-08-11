import { GST_RATE, GST_SAC, GST_SAC_LABEL, SELLER_GST, amountInInrWords, gstStateLabel } from "@/lib/gst";

export type AppInvoiceRow = {
  invoice_number: string;
  invoice_type: string | null;
  payment_method: string | null;
  payment_status: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  is_gst: boolean | null;
  seller_legal_name: string | null;
  seller_gstin: string | null;
  seller_address: string | null;
  seller_state_code: string | null;
  buyer_legal_name: string | null;
  buyer_gstin: string | null;
  buyer_address: string | null;
  buyer_state_code: string | null;
  place_of_supply: string | null;
  is_interstate: boolean | null;
  hsn_sac: string | null;
  taxable_value: number | null;
  cgst_rate: number | null;
  cgst_amount: number | null;
  sgst_rate: number | null;
  sgst_amount: number | null;
  igst_rate: number | null;
  igst_amount: number | null;
  issued_at: string;
  paid_at: string | null;
  provider_ref: string | null;
  metadata: {
    coupon?: { code?: string; label?: string; discount?: number } | null;
    payment_label?: string | null;
  } | null;
};

export type AppOrderRow = {
  order_code: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  total_price: number | null;
  item_type?: unknown;
};

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number | null | undefined) {
  return `₹${Math.round(Number(n) || 0)}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Kolkata",
  });
}

export function buildInvoiceModel(invoice: AppInvoiceRow, order: AppOrderRow | null) {
  const seller = {
    legalName: invoice.seller_legal_name || SELLER_GST.legalName,
    gstin: invoice.seller_gstin || SELLER_GST.gstin,
    address: invoice.seller_address || SELLER_GST.address,
    stateCode: invoice.seller_state_code || SELLER_GST.stateCode,
  };
  const placeCode = String(invoice.place_of_supply || seller.stateCode).padStart(2, "0");
  const isInterstate =
    invoice.is_interstate === true || placeCode !== String(seller.stateCode).padStart(2, "0");
  const taxable = Math.round(Number(invoice.taxable_value) || 0);
  const cgstAmount = Math.round(Number(invoice.cgst_amount) || 0);
  const sgstAmount = Math.round(Number(invoice.sgst_amount) || 0);
  const igstAmount = Math.round(Number(invoice.igst_amount) || 0);
  const totalTax =
    Math.round(Number(invoice.tax_amount) || 0) || cgstAmount + sgstAmount + igstAmount;
  const total = Math.round(Number(invoice.total_amount ?? order?.total_price) || 0);
  const buyerGstin = invoice.buyer_gstin || null;
  const isTaxInvoice =
    totalTax > 0 || invoice.invoice_type === "tax_invoice" || !!buyerGstin || !!invoice.is_gst;

  const billToName =
    invoice.buyer_legal_name ||
    order?.recipient_name ||
    invoice.metadata?.coupon?.label ||
    "Customer";

  return {
    title: isTaxInvoice ? "Tax Invoice" : "Receipt",
    invoiceNumber: invoice.invoice_number,
    issuedAtLabel: formatDate(invoice.issued_at),
    orderId: order?.order_code || "—",
    seller: { ...seller, stateLabel: gstStateLabel(seller.stateCode) },
    buyer: {
      legalName: billToName,
      gstin: buyerGstin,
      address: invoice.buyer_address || order?.delivery_address || order?.pickup_address || null,
      phone: order?.recipient_phone || null,
      stateLabel: gstStateLabel(invoice.buyer_state_code || (buyerGstin ? buyerGstin.slice(0, 2) : placeCode)),
    },
    pickupAddress: order?.pickup_address || "—",
    deliveryAddress: order?.delivery_address || "—",
    serviceDescription: GST_SAC_LABEL,
    hsnSac: invoice.hsn_sac || GST_SAC,
    taxable,
    cgstRate: invoice.cgst_rate || 0,
    cgstAmount,
    sgstRate: invoice.sgst_rate || 0,
    sgstAmount,
    igstRate: invoice.igst_rate || 0,
    igstAmount,
    totalTax,
    total,
    totalInWords: amountInInrWords(total),
    placeOfSupplyLabel: gstStateLabel(placeCode),
    supplyType: isInterstate ? "Inter-State" : "Intra-State",
    reverseCharge: "No",
    paymentLabel: invoice.metadata?.payment_label || invoice.payment_method || "UPI",
    paymentStatus: invoice.payment_status || "pending",
    paymentRef: invoice.provider_ref || null,
    couponCode: invoice.metadata?.coupon?.code || null,
    discountAmount: Math.round(Number(invoice.discount_amount) || 0),
  };
}

export function buildAppInvoiceHtml(invoice: AppInvoiceRow, order: AppOrderRow | null) {
  const m = buildInvoiceModel(invoice, order);
  const taxBreakupRows: string[] = [];
  if (m.cgstAmount > 0) {
    taxBreakupRows.push(
      `<tr><td>CGST</td><td class="r">${esc(m.cgstRate)}%</td><td class="r">${esc(money(m.cgstAmount))}</td></tr>`,
    );
  }
  if (m.sgstAmount > 0) {
    taxBreakupRows.push(
      `<tr><td>SGST</td><td class="r">${esc(m.sgstRate)}%</td><td class="r">${esc(money(m.sgstAmount))}</td></tr>`,
    );
  }
  if (m.igstAmount > 0) {
    taxBreakupRows.push(
      `<tr><td>IGST</td><td class="r">${esc(m.igstRate)}%</td><td class="r">${esc(money(m.igstAmount))}</td></tr>`,
    );
  }

  const couponRow =
    m.couponCode && m.discountAmount > 0
      ? `<tr><td>Coupon (${esc(m.couponCode)})</td><td></td><td class="r">−${esc(money(m.discountAmount))}</td></tr>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(m.invoiceNumber)}</title>
  <style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0F172A; margin: 28px; font-size: 12px; }
    h1 { font-size: 20px; margin: 0 0 2px; }
    .muted { color: #64748B; font-size: 11px; }
    .strong { font-weight: 700; }
    .row { display: flex; justify-content: space-between; gap: 20px; margin-top: 14px; }
    .block { flex: 1; }
    .meta td { padding: 2px 10px 2px 0; vertical-align: top; }
    table.lines { width: 100%; border-collapse: collapse; margin-top: 16px; }
    table.lines th, table.lines td { border-bottom: 1px solid #E2E8F0; padding: 8px 4px; text-align: left; }
    table.lines th { font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; }
    .r { text-align: right; }
    .total { font-size: 15px; font-weight: 800; }
    .foot { margin-top: 22px; color: #64748B; font-size: 10px; line-height: 1.45; }
    .badge { display: inline-block; border: 1px solid #CBD5E1; border-radius: 4px; padding: 2px 6px; font-size: 10px; margin-right: 6px; }
    .route { margin-top: 10px; line-height: 1.45; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>${esc(m.title)}</h1>
  <div class="muted">
    <span class="badge">${esc(m.supplyType)}</span>
    <span class="badge">SAC ${esc(m.hsnSac)}</span>
    <span class="badge">Reverse charge: ${esc(m.reverseCharge)}</span>
  </div>

  <div class="row">
    <div class="block">
      <div class="muted">Supplier (registered under GST)</div>
      <div class="strong">${esc(m.seller.legalName)}</div>
      <div>GSTIN: ${esc(m.seller.gstin)}</div>
      <div>${esc(m.seller.address)}</div>
      <div>State: ${esc(m.seller.stateLabel)}</div>
    </div>
    <div class="block">
      <table class="meta">
        <tr><td class="muted">Invoice no.</td><td class="strong">${esc(m.invoiceNumber)}</td></tr>
        <tr><td class="muted">Invoice date</td><td>${esc(m.issuedAtLabel)}</td></tr>
        <tr><td class="muted">Order</td><td>#${esc(m.orderId)}</td></tr>
        <tr><td class="muted">Place of supply</td><td>${esc(m.placeOfSupplyLabel)}</td></tr>
        <tr><td class="muted">Payment</td><td>${esc(m.paymentLabel)} · ${esc(m.paymentStatus)}</td></tr>
        ${m.paymentRef ? `<tr><td class="muted">Payment ref</td><td>${esc(m.paymentRef)}</td></tr>` : ""}
      </table>
    </div>
  </div>

  <div class="row">
    <div class="block">
      <div class="muted">Recipient / Bill to</div>
      <div class="strong">${esc(m.buyer.legalName)}</div>
      ${m.buyer.gstin ? `<div>GSTIN: ${esc(m.buyer.gstin)}</div>` : '<div class="muted">Unregistered (B2C)</div>'}
      ${m.buyer.address ? `<div>${esc(m.buyer.address)}</div>` : ""}
      ${m.buyer.phone ? `<div>Phone: ${esc(m.buyer.phone)}</div>` : ""}
      ${m.buyer.gstin ? `<div>State: ${esc(m.buyer.stateLabel)}</div>` : ""}
    </div>
    <div class="block route">
      <div class="muted">Service locations</div>
      <div><span class="muted">Pickup</span> ${esc(m.pickupAddress)}</div>
      <div><span class="muted">Delivery</span> ${esc(m.deliveryAddress)}</div>
    </div>
  </div>

  <table class="lines">
    <thead>
      <tr>
        <th>Description of service</th>
        <th>SAC</th>
        <th class="r">Taxable value</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${esc(m.serviceDescription)}</td>
        <td>${esc(m.hsnSac)}</td>
        <td class="r">${esc(money(m.taxable))}</td>
      </tr>
      ${couponRow}
    </tbody>
  </table>

  <table class="lines">
    <thead>
      <tr>
        <th>Tax</th>
        <th class="r">Rate</th>
        <th class="r">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${taxBreakupRows.join("") || '<tr><td colspan="3" class="muted">No GST charged</td></tr>'}
      <tr>
        <td colspan="2" class="strong">Total tax</td>
        <td class="r strong">${esc(money(m.totalTax))}</td>
      </tr>
      <tr>
        <td colspan="2" class="total">Invoice total</td>
        <td class="r total">${esc(money(m.total))}</td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top:12px"><span class="muted">Amount in words:</span> <span class="strong">${esc(m.totalInWords)}</span></div>

  <div class="foot">
    Computer-generated ${esc(m.title)} under CGST/SGST Rules — signature not required.
    Taxable courier service under SAC ${esc(m.hsnSac)} at ${esc(GST_RATE)}% GST
    (${esc(m.supplyType)}). Place of supply: ${esc(m.placeOfSupplyLabel)}.
    Whether tax is payable on reverse charge basis: ${esc(m.reverseCharge)}.
  </div>
</body>
</html>`;
}
