"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { exportElementToPdf } from "@/lib/pdf-export";

interface PdfExportButtonInnerProps {
  targetId: string;
  fileName: string;
  label?: string;
}

export function PdfExportButtonInner({
  targetId,
  fileName,
  label = "Export PDF",
}: PdfExportButtonInnerProps) {
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        const el = document.getElementById(targetId);
        if (!el) {
          toast.error("Nothing to export yet.");
          return;
        }
        setBusy(true);
        try {
          await exportElementToPdf(el, fileName);
          toast.success("PDF exported");
        } catch (e) {
          const message = e instanceof Error ? e.message : "Export failed";
          toast.error(message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Download className="size-3.5 mr-1.5" />
      {busy ? "Exporting…" : label}
    </Button>
  );
}
