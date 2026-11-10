import { useEffect, useState, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function PwaStatus() {
  const [install, setInstall] = useState<InstallEvent>();
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [editing, setEditing] = useState(false),
    [confirmUpdate, setConfirmUpdate] = useState(false);
  const approved = useRef(false),
    reloaded = useRef(false),
    controllerChanged = useRef(false);
  const wasControlled = useRef(!!navigator.serviceWorker?.controller);
  function reloadIfApproved() {
    if (approved.current) {
      if (!reloaded.current) {
        reloaded.current = true;
        location.reload();
      }
    } else {
      setNotice(
        "A versão nova está pronta. Salve sua edição e escolha quando reabrir o aplicativo.",
      );
      setRefresh(true);
    }
  }
  async function applyUpdate() {
    approved.current = true;
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (controllerChanged.current && !registration?.waiting) {
        reloadIfApproved();
        return;
      }
      await updateServiceWorker(true);
    } catch {
      approved.current = false;
      setNotice(
        "Não foi possível concluir a atualização. Salve sua edição e tente reabrir o aplicativo.",
      );
    }
  }
  const {
    needRefresh: [refresh, setRefresh],
    offlineReady: [ready, setReady],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedReload: reloadIfApproved,
    onRegisterError() {
      setNotice(
        "Não foi possível preparar o modo offline. Reconecte e recarregue.",
      );
    },
  });
  useEffect(() => {
    const capture = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    const installed = () => {
      setInstall(undefined);
      setNotice("Aplicativo instalado.");
    };
    const status = () => setOnline(navigator.onLine);
    const changed = () => {
      if (!wasControlled.current) {
        wasControlled.current = true;
        return;
      }
      controllerChanged.current = true;
      if (approved.current) {
        if (!reloaded.current) {
          reloaded.current = true;
          location.reload();
        }
      } else {
        setNotice(
          "A versão nova está pronta. Salve sua edição e escolha quando reabrir o aplicativo.",
        );
        setRefresh(true);
      }
    };
    navigator.serviceWorker?.addEventListener("controllerchange", changed);
    const dirty = (e: Event) => {
      if (e.target instanceof HTMLElement && e.target.closest("form"))
        setEditing(true);
    };
    document.addEventListener("input", dirty, true);
    document.addEventListener("change", dirty, true);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("online", status);
    window.addEventListener("offline", status);
    return () => {
      navigator.serviceWorker?.removeEventListener("controllerchange", changed);
      document.removeEventListener("input", dirty, true);
      document.removeEventListener("change", dirty, true);
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("online", status);
      window.removeEventListener("offline", status);
    };
  }, [setRefresh]);
  return (
    <div className="pwa-status" aria-live="polite">
      {!online && <span className="pill">Você está offline</span>}
      {install && (
        <button
          onClick={async () => {
            try {
              await install.prompt();
              await install.userChoice;
              setInstall(undefined);
            } catch {
              setNotice("Abra o menu do Chrome e escolha Instalar aplicativo.");
            }
          }}
        >
          Instalar aplicativo
        </button>
      )}
      {refresh && (
        <div className="banner">
          Nova versão disponível. Salve seu formulário antes de atualizar.
          <button
            onClick={() => {
              if (editing) setConfirmUpdate(true);
              else void applyUpdate();
            }}
          >
            Atualizar
          </button>
          <button onClick={() => setRefresh(false)}>Depois</button>
        </div>
      )}
      {confirmUpdate && (
        <section
          className="banner"
          role="alertdialog"
          aria-label="Atualizar aplicativo"
          aria-modal="false"
        >
          <p>
            Você editou um formulário nesta sessão. Salve o que precisa antes de
            atualizar; o rascunho que não foi salvo pode se perder.
          </p>
          <button
            onClick={() => {
              setConfirmUpdate(false);
              setEditing(false);
              void applyUpdate();
            }}
          >
            Já salvei, atualizar agora
          </button>
          <button onClick={() => setConfirmUpdate(false)}>
            Continuar editando
          </button>
        </section>
      )}
      {ready && (
        <div className="banner">
          Aplicativo pronto para uso offline.
          <button onClick={() => setReady(false)}>Entendi</button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
