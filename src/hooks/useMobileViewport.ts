import { useEffect } from "react";

export function useMobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const editing = document.activeElement?.matches(
        "input:not([type=checkbox]):not([type=radio]), textarea, select",
      );
      document.documentElement.classList.toggle(
        "keyboard-open",
        !!editing && innerHeight - viewport.height > 150,
      );
    };
    viewport.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      viewport.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      document.documentElement.classList.remove("keyboard-open");
    };
  }, []);
}
