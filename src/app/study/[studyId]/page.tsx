"use client";

import { use } from "react";
import { StudyDetail } from "@/components/research/study-detail";

export default function StudyOverviewPage({
  params,
}: {
  params: Promise<{ studyId: string }>;
}) {
  const { studyId } = use(params);
  return <StudyDetail studyId={studyId} />;
}
