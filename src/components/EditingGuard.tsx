import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useBlocker, useLocation } from "react-router-dom";

const EditingContext = createContext<
  | { update: (id: string, dirty: boolean) => void; hasEdits: boolean }
  | undefined
>(undefined);

/** Only dirty flags live here: never copies of personal fields or passwords. */
export function useEditingGuard(dirty: boolean) {
  const update = useContext(EditingContext)?.update;
  const id = useId();
  useEffect(() => {
    update?.(id, dirty);
    return () => update?.(id, false);
  }, [dirty, id, update]);
  return (action: () => void) => {
    if (
      !dirty ||
      window.confirm("Há alterações ainda não salvas. Descartar esta edição?")
    )
      action();
  };
}

export function useConfirmDiscard() {
  const editing = useContext(EditingContext);
  return (action: () => void) => {
    if (
      !editing?.hasEdits ||
      window.confirm("Há alterações ainda não salvas. Descartar esta edição?")
    )
      action();
  };
}

export function EditingGuard({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState<Set<string>>(() => new Set());
  const update = useCallback((id: string, value: boolean) => {
    setDirty((previous) => {
      if (previous.has(id) === value) return previous;
      const next = new Set(previous);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty.size > 0 &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const location = useLocation();
  const context = useMemo(
    () => ({ update, hasEdits: dirty.size > 0 }),
    [update, dirty.size],
  );
  useEffect(() => {
    const element = dialog.current;
    if (blocker.state === "blocked") element?.showModal();
    else element?.close();
  }, [blocker.state]);
  useEffect(() => {
    if (!dirty.size) return;
    const leaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", leaving);
    return () => window.removeEventListener("beforeunload", leaving);
  }, [dirty.size]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const heading = document.querySelector<HTMLElement>("main h1");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    }, 80);
    return () => clearTimeout(timer);
  }, [location.pathname]);
  return (
    <EditingContext.Provider value={context}>
      {children}
      <dialog
        ref={dialog}
        aria-labelledby="leave-title"
        onCancel={(event) => {
          event.preventDefault();
          if (blocker.state === "blocked") blocker.reset();
        }}
      >
        <h2 id="leave-title">Sua edição ainda está aqui.</h2>
        <p>
          Você tem alterações não salvas. Continue editando ou descarte para
          mudar de página.
        </p>
        <div className="actions">
          <button
            className="primary"
            autoFocus
            onClick={() => {
              if (blocker.state === "blocked") blocker.reset();
            }}
          >
            Continuar editando
          </button>
          <button
            onClick={() => {
              if (blocker.state === "blocked") blocker.proceed();
            }}
          >
            Descartar e sair
          </button>
        </div>
      </dialog>
    </EditingContext.Provider>
  );
}
