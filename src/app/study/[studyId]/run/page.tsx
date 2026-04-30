"use client";

import { use } from "react";
import { LiveSession } from "@/components/research/live-session";

export default function RunViewPage({
  params,
}: {
  params: Promise<{ studyId: string }>;
}) {
  const { studyId } = use(params);
  return <LiveSession studyId={studyId} />;
}
