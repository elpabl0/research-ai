"use client";

import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

export async function exportElementToPdf(
  element: HTMLElement,
  fileName: string,
): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: "#0a0a0a",
    scale: 2,
    useCORS: true,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const ratio = canvas.width / pageWidth;
  const imageHeightPt = canvas.height / ratio;

  let cursor = 0;
  while (cursor < imageHeightPt) {
    pdf.addImage(
      imgData,
      "PNG",
      0,
      -cursor,
      pageWidth,
      imageHeightPt,
      undefined,
      "FAST",
    );
    cursor += pageHeight;
    if (cursor < imageHeightPt) pdf.addPage();
  }

  pdf.save(fileName);
}
