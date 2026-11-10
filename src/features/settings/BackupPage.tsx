import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { db } from "../../db/database";
import { tableLabels } from "../../db/backup-registry";
import {
  exportBackup,
  validateBackup,
  restoreBackup,
  confirmBackupSaved,
  needsBackup,
  eraseLocalData,
  contentHash,
  type Backup,
} from "../../services/backup";
import {
  encryptBackup,
  decryptBackup,
  inspectEncryptedBackup,
  parseBackupText,
  isEncrypted,
  MAX_IMPORT_BYTES,
  type EncryptedBackup,
} from "../../services/backup-crypto";
import { auditIntegrity, type IntegrityReport } from "../../services/integrity";
import { Status, useAction } from "../../components/RoutineUI";
import { StoragePanel } from "./StoragePanel";
function download(json: string, name: string) {
  const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function BackupPage() {
  const action = useAction(),
    generation = useRef(0);
  const [candidate, setCandidate] = useState<Backup>(),
    [encrypted, setEncrypted] = useState<EncryptedBackup>();
  const [confirmation, setConfirmation] = useState(""),
    [password, setPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [unlock, setUnlock] = useState("");
  const [exported, setExported] = useState<{
    backupId: string;
    contentHash: string;
  }>();
  const [report, setReport] = useState<IntegrityReport>();
  const [erase, setErase] = useState(""),
    [understood, setUnderstood] = useState(false);
  const state = useLiveQuery(() => db.backupState.get("local"));
  const copies = useLiveQuery(() =>
    db.recoverySnapshots.orderBy("createdAt").reverse().toArray(),
  );
  async function exportFile(protectedFile: boolean) {
    try {
      if (protectedFile && password !== repeat)
        throw new Error("As senhas precisam ser iguais.");
      const file = await exportBackup(),
        proof = {
          backupId: file.backupId!,
          contentHash: await contentHash(file.data),
        };
      const result = protectedFile ? await encryptBackup(file, password) : file;
      download(
        JSON.stringify(result, null, 2),
        "minha-virada-" +
          file.createdAt.slice(0, 10) +
          (protectedFile ? ".mvbackup" : ".json"),
      );
      setExported(proof);
    } finally {
      setPassword("");
      setRepeat("");
    }
  }
  function cancelImport() {
    generation.current++;
    setCandidate(undefined);
    setEncrypted(undefined);
    setUnlock("");
    setConfirmation("");
  }
  return (
    <>
      <p className="eyebrow">SEU HISTÓRICO MERECE CUIDADO</p>
      <h1>Seus dados e segurança.</h1>
      <p className="muted">
        Seu espaço continua local. Uma cópia externa ajuda a cuidar do que você
        construiu.
      </p>
      <StoragePanel lastConfirmedAt={state?.lastConfirmedAt} />
      <Status message={action.message} />
      <section className="panel" aria-label="Exportar backup">
        <h2>Backup e recuperação</h2>
        <p className="muted">
          {needsBackup(state?.lastConfirmedAt)
            ? "Você ainda não tem uma cópia recente confirmada."
            : "Sua última cópia foi confirmada por você."}
        </p>
        <p className="muted small">
          Inclui preferências, saúde, rotina, finanças, metas, projetos e pontos
          de recuperação locais.
        </p>
        <h3>Uma cópia protegida por senha</h3>
        <p className="backup-warning">
          Guarde a frase-senha em um lugar seguro, separado do arquivo. Se
          perder a senha, não será possível recuperar a cópia criptografada. Ela
          não protege os dados que continuam no navegador.
        </p>
        <div className="form-grid">
          <label>
            Senha da nova cópia
            <input
              type="password"
              autoComplete="new-password"
              maxLength={1024}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={action.busy}
            />
          </label>
          <label>
            Repita a senha
            <input
              type="password"
              autoComplete="new-password"
              maxLength={1024}
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              disabled={action.busy}
            />
          </label>
        </div>
        <p className="muted small">
          Use uma frase-senha longa, com pelo menos 12 caracteres. A senha não é
          salva pelo aplicativo.
        </p>
        <button
          className="primary"
          disabled={action.busy}
          onClick={() =>
            void action.run(
              () => exportFile(true),
              "Cópia criptografada gerada. Confira o download e guarde a senha separadamente.",
            )
          }
        >
          Exportar cópia criptografada
        </button>
        <h3>JSON sem senha</h3>
        <p className="backup-warning">
          O JSON é legível e contém informações pessoais, financeiras e de
          saúde. Quem tiver o arquivo poderá lê-lo. Guarde-o em local privado.
        </p>
        <button
          disabled={action.busy}
          onClick={() =>
            void action.run(
              () => exportFile(false),
              "Arquivo validado e gerado. Verifique se o download foi salvo.",
            )
          }
        >
          Exportar cópia JSON
        </button>
        {exported && (
          <div className="backup-warning">
            <p>
              O download não comprova que há uma cópia segura fora deste
              navegador. Confirme somente depois de guardar o arquivo em um
              local externo de sua escolha.
            </p>
            <button
              disabled={action.busy}
              onClick={() =>
                void action.run(
                  () => confirmBackupSaved(db, exported),
                  "Cópia externa confirmada como guardada por você.",
                )
              }
            >
              Confirmo que guardei o arquivo
            </button>
          </div>
        )}
        {action.busy && (
          <p role="status">Preparando seus dados. Aguarde a confirmação…</p>
        )}
      </section>
      <section className="panel" aria-label="Restaurar backup">
        <h2>Recuperar uma cópia</h2>
        <p className="muted small">
          Selecionar → validar → abrir com senha, se necessário → conferir →
          confirmar → restaurar. A prévia não altera o banco. A restauração
          substitui registros, sem mescla automática; os pontos de recuperação
          são preservados.
        </p>
        <label>
          Arquivo de backup JSON
          <input
            type="file"
            accept="application/json,.json,.mvbackup"
            disabled={action.busy}
            onChange={(e) => {
              cancelImport();
              const epoch = generation.current,
                file = e.target.files?.[0];
              if (file)
                void action.run(async () => {
                  if (file.size > MAX_IMPORT_BYTES)
                    throw new Error(
                      "Use um arquivo de até 28 MB, com conteúdo de até 20 MB.",
                    );
                  const input = parseBackupText(await file.text());
                  if (isEncrypted(input)) {
                    const sealed = inspectEncryptedBackup(input);
                    if (epoch === generation.current) setEncrypted(sealed);
                  } else {
                    const validated = await validateBackup(input);
                    if (epoch === generation.current) setCandidate(validated);
                  }
                }, "Formato conferido. Se houver senha, abra a cópia; depois revise o conteúdo.");
            }}
          />
        </label>
        {encrypted && (
          <div className="backup-warning">
            <h3>Cópia criptografada</h3>
            <p>
              Informe a senha para verificar a autenticidade e abrir a prévia.
              Não há recuperação de senha.
            </p>
            <label>
              Senha para abrir a cópia
              <input
                type="password"
                autoComplete="off"
                maxLength={1024}
                value={unlock}
                disabled={action.busy}
                onChange={(e) => setUnlock(e.target.value)}
              />
            </label>
            <div className="actions">
              <button
                disabled={action.busy || !unlock}
                onClick={() =>
                  void action.run(async () => {
                    try {
                      const file = await decryptBackup(encrypted, unlock);
                      setCandidate(file);
                      setEncrypted(undefined);
                    } finally {
                      setUnlock("");
                    }
                  }, "Cópia autenticada e validada. Confira a prévia antes de restaurar.")
                }
              >
                Abrir cópia protegida
              </button>
              <button disabled={action.busy} onClick={cancelImport}>
                Cancelar importação
              </button>
            </div>
          </div>
        )}
        {candidate && (
          <>
            <h3>Pré-visualização da cópia</h3>
            <p className="muted small">
              Compatível · formato {candidate.formatVersion} · aplicativo{" "}
              {candidate.appVersion} · schema {candidate.schemaVersion} ·{" "}
              {new Date(candidate.createdAt).toLocaleString("pt-BR")} ·{" "}
              {Object.values(candidate.data).reduce((n, r) => n + r.length, 0)}{" "}
              registros.
            </p>
            <div className="backup-counts">
              {Object.entries(candidate.data)
                .filter(([, rows]) => rows.length)
                .map(([name, rows]) => (
                  <p key={name}>
                    {tableLabels[name] ?? name}:{" "}
                    <strong>{rows.length} registros</strong>
                  </p>
                ))}
            </div>
            <p className="backup-warning">
              Os dados atuais serão substituídos. Antes disso, um ponto de
              recuperação será gravado e conferido na mesma transação. Se
              falhar, a substituição será bloqueada. Essa cópia interna não
              substitui um backup externo.
            </p>
            <label>
              Digite RESTAURAR para substituir os dados
              <input
                value={confirmation}
                autoComplete="off"
                disabled={action.busy}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <div className="actions">
              <button
                className="primary"
                disabled={action.busy || confirmation !== "RESTAURAR"}
                onClick={() =>
                  void action.run(async () => {
                    await restoreBackup(candidate, confirmation);
                    cancelImport();
                    setExported(undefined);
                  }, "Restauração concluída. A cópia anterior está disponível abaixo.")
                }
              >
                Restaurar cópia confirmada
              </button>
              <button disabled={action.busy} onClick={cancelImport}>
                Cancelar importação
              </button>
            </div>
          </>
        )}
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>Integridade dos registros</h2>
          <button
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                setReport(await auditIntegrity());
              }, "Verificação concluída sem modificar registros.")
            }
          >
            Verificar integridade
          </button>
        </div>
        <p className="muted small">
          Confere estruturas, vínculos, parcelas, pagamentos, ticket, reservas e
          projetos. Não consulta bancos e não faz correções automáticas.
        </p>
        {report && (
          <div aria-label="Relatório de integridade">
            <h3>
              {report.status === "ok"
                ? "Nenhuma inconsistência detectada"
                : report.status === "unavailable"
                  ? "Não foi possível concluir a verificação"
                  : "Há registros que precisam de revisão"}
            </h3>
            <p className="muted small">
              {report.tables} entidades · {report.records} registros ·{" "}
              {new Date(report.checkedAt).toLocaleString("pt-BR")}
            </p>
            {report.issues.map((i) => (
              <article className="backup-warning" key={i.code + i.entity}>
                <strong>
                  {i.severity === "error" ? "Revisar" : "Atenção"} ·{" "}
                  {tableLabels[i.entity] ?? i.entity} · {i.count} ocorrência(s)
                </strong>
                <p>
                  {i.code.replaceAll("-", " ")}. {i.guidance}
                </p>
              </article>
            ))}
            <button
              onClick={() =>
                download(
                  JSON.stringify(report, null, 2),
                  "minha-virada-integridade.json",
                )
              }
            >
              Baixar relatório de integridade
            </button>
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Antes da última restauração</h2>
        <p className="muted small">
          Pontos locais também se perdem ao limpar o navegador. O download
          abaixo é JSON legível. A cópia pode exigir revisão se o estado de
          origem já estava danificado; toda importação é validada novamente.
        </p>
        {copies?.length ? (
          copies.map((copy) => (
            <div className="overview-row" key={copy.id}>
              <span>{new Date(copy.createdAt).toLocaleString("pt-BR")}</span>
              <button
                onClick={() =>
                  download(
                    copy.json,
                    "minha-virada-anterior-" + copy.id + ".json",
                  )
                }
              >
                Baixar cópia anterior
              </button>
            </div>
          ))
        ) : (
          <p className="muted small">Nenhuma restauração foi realizada.</p>
        )}
      </section>
      <section className="panel">
        <h2>Privacidade, com clareza</h2>
        <p className="muted small">
          IndexedDB permanece sem criptografia. Quem acessa seu dispositivo ou
          perfil do navegador pode ler os registros. A senha protege somente o
          arquivo criptografado exportado. Não há nuvem, rastreamento ou envio
          dos seus dados.
        </p>
        <Link className="text-link" to="/mais/privacidade">
          Informações de privacidade →
        </Link>
      </section>
      <details className="panel security-delete">
        <summary>Apagar dados locais</summary>
        <p className="backup-warning">
          Apaga os registros e pontos de recuperação deste navegador. Feche
          outras abas do app. Primeiro exporte e confirme uma cópia externa
          atual; se houver alterações posteriores, será preciso exportar
          novamente.
        </p>
        <label>
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
          />
          Entendo que os registros locais e as cópias internas serão apagados.
        </label>
        <label>
          Digite APAGAR
          <input
            value={erase}
            autoComplete="off"
            onChange={(e) => setErase(e.target.value)}
          />
        </label>
        <button
          disabled={action.busy || erase !== "APAGAR" || !understood}
          onClick={() =>
            void action.run(async () => {
              await eraseLocalData(erase);
              location.reload();
            })
          }
        >
          Apagar todos os dados locais
        </button>
      </details>
    </>
  );
}
