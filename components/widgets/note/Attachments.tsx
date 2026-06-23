"use client";

/**
 * note · Attachments — add / download / remove inline file attachments.
 *
 *  Files are read to data URLs (≤ cap) and stored in config so they survive
 *  reload + sync. Download is a plain anchor with the data URL + filename. Images
 *  among the attachments can also be inserted into the note body.
 */

import * as React from "react";
import { Paperclip, Download, Trash2, ImagePlus, FileText, Loader2 } from "lucide-react";
import { fileToAttachment, formatBytes } from "./media";
import type { NoteAttachment } from "./types";

export function Attachments({
  attachments,
  onChange,
  onInsertImage,
}: {
  attachments: NoteAttachment[];
  onChange: (next: NoteAttachment[]) => void;
  /** Insert an image attachment into the note body (optional). */
  onInsertImage?: (dataUrl: string) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const added: NoteAttachment[] = [];
      for (const file of Array.from(files)) {
        const res = await fileToAttachment(file);
        if (res.attachment) added.push(res.attachment);
        else if (res.error) setErr(res.error);
      }
      if (added.length > 0) onChange([...attachments, ...added]);
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) => onChange(attachments.filter((a) => a.id !== id));

  return (
    <div className="flex flex-col gap-2" data-pb-no-drag="">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Paperclip size={13} aria-hidden /> 첨부파일 {attachments.length > 0 ? `(${attachments.length})` : ""}
        </span>
        <button
          type="button"
          data-pb-no-drag=""
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
          파일 첨부
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {err ? <p className="text-[11px] text-destructive">{err}</p> : null}

      {attachments.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {attachments.map((a) => {
            const isImage = a.type.startsWith("image/");
            return (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded bg-muted text-muted-foreground">
                  {isImage ? <ImagePlus size={14} /> : <FileText size={14} />}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-foreground">{a.name}</span>
                  <span className="text-[10px] text-muted-foreground">{formatBytes(a.size)}</span>
                </div>
                {isImage && onInsertImage ? (
                  <button
                    type="button"
                    data-pb-no-drag=""
                    title="본문에 삽입"
                    aria-label="본문에 이미지 삽입"
                    onClick={() => onInsertImage(a.dataUrl)}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ImagePlus size={15} />
                  </button>
                ) : null}
                <a
                  href={a.dataUrl}
                  download={a.name}
                  data-pb-no-drag=""
                  title="다운로드"
                  aria-label={`${a.name} 다운로드`}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Download size={15} />
                </a>
                <button
                  type="button"
                  data-pb-no-drag=""
                  title="삭제"
                  aria-label={`${a.name} 삭제`}
                  onClick={() => remove(a.id)}
                  className="inline-flex size-7 items-center justify-center rounded-md text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default Attachments;
