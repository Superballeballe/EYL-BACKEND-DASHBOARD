export const GST_SAC = "9965";
export const GST_SAC_LABEL = "Courier / goods transportation services";
export const GST_RATE = 18;

export const SELLER_GST = {
  legalName: "ELEMENTS EYL SERVICES PRIVATE LIMITED",
  gstin: "27AAECE3280H1ZO",
  address:
    "217, Kuber Kartik New Link Road Premises CSL, New Link Road, Andheri West, Mumbai, Maharashtra 400053",
  stateCode: "27",
};

const GST_STATE_NAMES: Record<string, string> = {
  "27": "Maharashtra",
  "29": "Karnataka",
  "07": "Delhi",
  "09": "Uttar Pradesh",
  "24": "Gujarat",
};

export function gstStateLabel(stateCode: string | null | undefined) {
  const code = String(stateCode || "").padStart(2, "0");
  const name = GST_STATE_NAMES[code];
  return name ? `${name} (${code})` : code || "—";
}

export function amountInInrWords(amount: number) {
  const n = Math.round(Number(amount) || 0);
  if (n === 0) return "Zero Rupees only";
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const chunk = (num: number): string => {
    if (num < 20) return ones[num];
    if (num < 100) return `${tens[Math.floor(num / 10)]}${num % 10 ? ` ${ones[num % 10]}` : ""}`;
    return `${ones[Math.floor(num / 100)]} Hundred${num % 100 ? ` ${chunk(num % 100)}` : ""}`;
  };
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${chunk(crore)} Crore`);
  if (lakh) parts.push(`${chunk(lakh)} Lakh`);
  if (thousand) parts.push(`${chunk(thousand)} Thousand`);
  if (rest) parts.push(chunk(rest));
  return `${parts.join(" ")} Rupees only`;
}
