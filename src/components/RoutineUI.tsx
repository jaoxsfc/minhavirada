import { storageMessage } from "../services/storage";
import { z } from "zod";
import { useRef, useState, type ReactNode } from "react";
export function useAction() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function run(
    action: () => Promise<unknown>,
    success = "Alteração salva neste dispositivo.",
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(
        storageMessage(error) ??
          (error instanceof z.ZodError
            ? (error.issues[0]?.message ?? "Verifique os campos informados.")
            : error instanceof Error && error.name === "Error"
              ? error.message
              : "Não foi possível salvar. Verifique o armazenamento e tente novamente."),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { message, busy, run };
}
export function DataState({
  data,
  children,
}: {
  data: { error: boolean } | undefined;
  children: ReactNode;
}) {
  if (!data) return <p role="status">Abrindo seus registros…</p>;
  if (data.error)
    return (
      <section className="panel" role="alert">
        <h2>Não foi possível ler seus registros.</h2>
        <p>Verifique o armazenamento do navegador. Nenhum dado foi apagado.</p>
        <button onClick={() => location.reload()}>Tentar novamente</button>
      </section>
    );
  return children;
}
export function Status({ message }: { message: string }) {
  return (
    <p role="status" className="feedback">
      {message}
    </p>
  );
}
export function FieldError({ message }: { message?: string }) {
  return message ? (
    <span className="error" role="alert">
      {message}
    </span>
  ) : null;
}
export function DayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (v: number[]) => void;
}) {
  return (
    <fieldset className="days-picker">
      <legend>Dias preferenciais</legend>
      {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((name, i) => (
        <label key={i} className="day-choice">
          <input
            type="checkbox"
            checked={value.includes(i)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...value, i].sort()
                  : value.filter((d) => d !== i),
              )
            }
          />
          {name}
        </label>
      ))}
    </fieldset>
  );
}
