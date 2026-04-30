"use client";

import { Card } from "@/components/ui/card";
import { Markdown } from "@/components/research/markdown";

export function ReportSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 bg-card/80 border-border/60 space-y-2">
      <h2 className="font-heading text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <div className="text-sm">{children}</div>
    </Card>
  );
}

export function ReportMarkdown({ content }: { content: string }) {
  if (!content.trim()) {
    return (
      <p className="text-xs text-muted-foreground italic">(no content)</p>
    );
  }
  return <Markdown>{content}</Markdown>;
}
