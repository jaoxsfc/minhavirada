import { useEffect, useState } from "react";
import {
  inspectStorage,
  requestPersistence,
  type StorageStatus,
} from "../../services/storage";
import { Status, useAction } from "../../components/RoutineUI";
export function StoragePanel({
  lastConfirmedAt,
}: {
  lastConfirmedAt?: string;
}) {
  const [state, setState] = useState<StorageStatus>();
  const action = useAction();
  useEffect(() => {
    let active = true;
    void inspectStorage().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="panel">
      <div className="section-title">
        <h2>Seu espaço neste dispositivo</h2>
        <button
          disabled={action.busy}
          onClick={() =>
            void action.run(
              async () => setState(await inspectStorage()),
              "Estado do armazenamento atualizado.",
            )
          }
        >
          Verificar armazenamento
        </button>
      </div>
      {!state ? (
        <p role="status">Conferindo armazenamento…</p>
      ) : (
        <>
          <p className={state.writable ? "pill" : "backup-warning"}>
            {state.writable
              ? "Leitura e gravação disponíveis"
              : state.available
                ? "Leitura disponível; gravação não confirmada"
                : "Armazenamento indisponível"}
          </p>
          {state.message && <p role="alert">{state.message}</p>}
          <p className="muted small">
            Proteção contra remoção automática:{" "}
            {state.persistent === null
              ? "não informada pelo navegador"
              : state.persistent
                ? "concedida"
                : "ainda não concedida"}
            .
            {state.usage !== undefined && state.quota !== undefined
              ? " Uso estimado: " +
                (state.usage / 1048576).toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                }) +
                " MB de " +
                (state.quota / 1048576).toLocaleString("pt-BR", {
                  maximumFractionDigits: 0,
                }) +
                " MB."
              : ""}
          </p>
          <p className="muted small">
            O armazenamento persistente pode reduzir a remoção automática pelo
            navegador. Não impede exclusão manual, limpeza de dados nem perda do
            aparelho.
          </p>
          <button
            disabled={
              action.busy ||
              !state.canRequestPersistence ||
              state.persistent === true
            }
            onClick={() =>
              void action.run(async () => {
                const granted = await requestPersistence();
                setState(await inspectStorage());
                if (!granted)
                  throw new Error(
                    "O navegador não concedeu a proteção desta vez. Continue guardando cópias externas.",
                  );
              }, "Proteção contra remoção automática concedida pelo navegador.")
            }
          >
            Solicitar armazenamento persistente
          </button>
        </>
      )}
      <p className="muted small">
        Último backup externo informado por você:{" "}
        <strong>
          {lastConfirmedAt
            ? new Date(lastConfirmedAt).toLocaleString("pt-BR")
            : "ainda não confirmado"}
        </strong>
        . O aplicativo não verifica arquivos na nuvem ou em outro dispositivo.
      </p>
      <Status message={action.message} />
    </section>
  );
}
