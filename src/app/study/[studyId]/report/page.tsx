"use client";

import { use } from "react";
import { ReportView } from "@/components/research/report/report-view";

export default function ReportPage({
  params,
}: {
  params: Promise<{ studyId: string }>;
}) {
  const { studyId } = use(params);
  return <ReportView studyId={studyId} />;
}
