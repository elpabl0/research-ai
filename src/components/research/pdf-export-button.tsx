"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface PdfExportButtonProps {
  targetId: string;
  fileName: string;
  label?: string;
}

const Inner = dynamic(
  () => import("./pdf-export-button-inner").then((m) => m.PdfExportButtonInner),
  {
    ssr: false,
    loading: () => (
      <Button variant="outline" size="sm" disabled>
        <Download className="size-3.5 mr-1.5" />
        Export PDF
      </Button>
    ),
  },
);

export function PdfExportButton(props: PdfExportButtonProps) {
  return <Inner {...props} />;
}
