"use client";

import ReactMarkdown from "react-markdown";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none [&_code]:bg-muted/40 [&_code]:px-1 [&_code]:rounded">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
