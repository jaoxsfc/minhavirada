export function eventLabel(action: string) {
  return (
    (
      {
        created: "Criado",
        edited: "Editado",
        completed: "Concluído",
        reopened: "Conclusão desmarcada",
        active: "Reativado",
        archived: "Arquivado",
        "suggestion-confirmed": "Sugestão confirmada",
        done: "Concluído",
        reopen: "Reaberto",
        postpone: "Adiado",
        started: "Etapa iniciada",
      } as Record<string, string>
    )[action] ?? "Atualizado"
  );
}
