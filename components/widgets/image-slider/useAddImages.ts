"use client";

/**
 * image-slider · useAddImages — 타일·전체보기가 공유하는 "이미지 추가" 배선.
 *
 *  파일 선택 / 붙여넣기(Ctrl+V) / 붙여넣기 버튼 세 경로가 모두 같은 파이프라인
 *  (filesToSlides → 축소 → config 영속)을 타도록 한 곳에 모았다. 상한 초과·클립보드
 *  실패 안내도 같은 message 슬롯을 쓴다.
 */

import * as React from "react";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import {
  clipboardMessage,
  filesToSlides,
  imagesFromClipboardEvent,
  limitMessage,
  readClipboardImages,
} from "./imageFiles";
import type { ImageSliderConfig } from "./types";

export function useAddImages(instanceId: string, config: ImageSliderConfig) {
  const save = useSaveWidgetConfig();
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  // 최신 config 미러 — 붙여넣기가 연달아 일어나도 직전에 추가한 이미지를 잃지 않게
  // (그리고 window paste 리스너의 스테일 클로저를 피하려고) 저장 시 즉시 갱신한다.
  const configRef = React.useRef(config);
  React.useEffect(() => {
    configRef.current = config;
  }, [config]);

  const addFiles = React.useCallback(
    async (files: Iterable<File> | null) => {
      const list = Array.from(files ?? []);
      if (list.length === 0) return;
      setBusy(true);
      setMessage(null);
      try {
        const cur = configRef.current;
        const { added, skipped } = await filesToSlides(list, cur.images);
        if (skipped > 0) setMessage(limitMessage(skipped));
        if (added.length > 0) {
          const next: ImageSliderConfig = {
            ...cur,
            images: [...cur.images, ...added],
          };
          configRef.current = next;
          save(instanceId, next);
        }
      } finally {
        setBusy(false);
      }
    },
    [instanceId, save],
  );

  /** 붙여넣기 버튼 — OS 클립보드를 직접 읽는다(대상 위젯이 명확해 타일에서도 안전). */
  const pasteFromClipboard = React.useCallback(async () => {
    setMessage(null);
    const res = await readClipboardImages();
    if (!res.ok) {
      setMessage(clipboardMessage(res.reason));
      return;
    }
    await addFiles(res.files);
  }, [addFiles]);

  /** Ctrl/⌘+V 이벤트 → 이미지가 들어 있을 때만 소비한다. */
  const handlePasteEvent = React.useCallback(
    (data: DataTransfer | null | undefined): boolean => {
      const files = imagesFromClipboardEvent(data);
      if (files.length === 0) return false;
      void addFiles(files);
      return true;
    },
    [addFiles],
  );

  return { busy, message, setMessage, addFiles, pasteFromClipboard, handlePasteEvent };
}
