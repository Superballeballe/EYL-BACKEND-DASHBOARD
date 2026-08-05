"use client";

import SalaryRecordForm from "@/components/SalaryRecordForm";

export default function SalaryForm({ knightId }: { knightId: string }) {
  return <SalaryRecordForm knightId={knightId} />;
}
