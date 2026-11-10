import { useEffect } from "react";

const BASE_TITLE = "Paperforge — PDF Studio";

/**
 * Keeps the browser tab title in sync with the current page.
 * Passing `null` restores the studio default.
 */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · Paperforge` : BASE_TITLE;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
