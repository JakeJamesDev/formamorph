import { useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { toast } from 'react-toastify';
import type { ImageAttachment } from '@/types';
import { ATTACH_REFUSAL_COPY, addToPending, joinPending, pastedImageFiles } from './actionAttachments';
import { useMountedRef } from './useMountedRef';

/**
 * The file picker, paste and drop feeding one pending set. Intakes may overlap: each one encodes against the
 * set it started with, then joins the set as it is when it finishes.
 */
export function useAttachmentIntake({ enabled, pending, setPending }: {
  /** False leaves paste and drop to the browser. */
  enabled: boolean;
  pending: ImageAttachment[];
  setPending: (update: (prev: ImageAttachment[]) => ImageAttachment[]) => void;
}) {
  const [attaching, setAttaching] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const mounted = useMountedRef();
  const pendingNow = useRef(pending);
  pendingNow.current = pending;

  const attachFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setAttaching(true);
    try {
      const base = pendingNow.current;
      const { pending: encoded, refused } = await addToPending(base, files);
      if (!mounted.current) return;
      // Only the new images join: a send while they encoded has already taken the old ones.
      const added = encoded.slice(base.length);
      if (joinPending(pendingNow.current, added).overflow && !refused.includes('limit')) refused.push('limit');
      setPending((prev) => joinPending(prev, added).pending);
      for (const reason of refused) toast.warning(ATTACH_REFUSAL_COPY[reason]);
    } finally {
      if (mounted.current) setAttaching(false);
    }
  };

  const intakeProps = enabled ? {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault(); // without this the browser opens the dropped file
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (e: DragEvent<HTMLElement>) => {
      setDragOver(false);
      // A dropped link or text keeps its default: it lands in the box as text.
      if (e.dataTransfer.files.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      void attachFiles(Array.from(e.dataTransfer.files));
    },
    onPaste: (e: ClipboardEvent<HTMLElement>) => {
      const files = pastedImageFiles(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      void attachFiles(files);
    },
  } : {};

  return { attaching, dragOver: enabled && dragOver, attachFiles, intakeProps };
}
