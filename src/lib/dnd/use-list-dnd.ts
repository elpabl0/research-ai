"use client";

import { useCallback, useState } from "react";

/**
 * Tiny hook for native HTML5 drag-and-drop reordering of a flat list.
 *
 * The drag is initiated from a dedicated handle button (which is the
 * `draggable` element). The row itself is the drop target. This is more
 * reliable than making the row draggable, because images and inputs inside
 * a draggable row often hijack the drag.
 *
 * Usage:
 *   const dnd = useListDnd<string>(items.map(i => i.id), (next) => onReorder(next));
 *   ...
 *   {items.map(i => (
 *     <li
 *       key={i.id}
 *       {...dnd.itemProps(i.id)}
 *       style={dnd.styleFor(i.id)}
 *     >
 *       <button {...dnd.handleProps(i.id)}>⋮⋮</button>
 *       …
 *     </li>
 *   ))}
 */
export function useListDnd<TId extends string>(
  ids: TId[],
  onReorder: (next: TId[]) => void,
) {
  const [draggingId, setDraggingId] = useState<TId | null>(null);
  const [overId, setOverId] = useState<TId | null>(null);

  const handleProps = useCallback(
    (id: TId) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        setDraggingId(id);
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", String(id));
        } catch {
          /* ignore */
        }
      },
      onDragEnd: () => {
        setDraggingId(null);
        setOverId(null);
      },
      style: {
        cursor: "grab",
        touchAction: "none",
      } as const,
      "aria-label": "Drag to reorder",
      title: "Drag to reorder",
    }),
    [],
  );

  const itemProps = useCallback(
    (id: TId) => ({
      onDragOver: (e: React.DragEvent) => {
        if (draggingId === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (overId !== id) setOverId(id);
      },
      onDragLeave: () => {
        if (overId === id) setOverId(null);
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        if (draggingId === null || draggingId === id) {
          setDraggingId(null);
          setOverId(null);
          return;
        }
        const fromIdx = ids.indexOf(draggingId);
        const toIdx = ids.indexOf(id);
        if (fromIdx < 0 || toIdx < 0) {
          setDraggingId(null);
          setOverId(null);
          return;
        }
        const next = ids.slice();
        next.splice(fromIdx, 1);
        next.splice(toIdx, 0, draggingId);
        setDraggingId(null);
        setOverId(null);
        onReorder(next);
      },
    }),
    [draggingId, ids, onReorder, overId],
  );

  const styleFor = useCallback(
    (id: TId): React.CSSProperties => {
      if (draggingId === id) return { opacity: 0.45 };
      if (overId === id && draggingId !== null && draggingId !== id) {
        return {
          boxShadow: "inset 0 2px 0 0 var(--ink)",
          transition: "box-shadow 120ms var(--ease)",
        };
      }
      return {};
    },
    [draggingId, overId],
  );

  return { handleProps, itemProps, styleFor, draggingId, overId };
}
