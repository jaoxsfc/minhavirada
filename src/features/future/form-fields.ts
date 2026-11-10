import type { FutureField } from "./FutureForm";
import { stageLabels } from "./models";
const select = (
  key: string,
  label: string,
  items: [string, string][],
): FutureField => ({
  key,
  label,
  type: "select",
  options: items.map(([value, label]) => ({ value, label })),
});
export const goalFields: FutureField[] = [
  { key: "title", label: "Título da meta", required: true },
  { key: "description", label: "Descrição", type: "textarea" },
  { key: "category", label: "Categoria", required: true },
  select("type", "Tipo de meta", [
    ["personal", "Pessoal · progresso por marcos"],
    ["financial", "Financeira · reserva confirmada"],
  ]),
  { key: "target", label: "Valor-alvo opcional (R$)", type: "money" },
  { key: "startDate", label: "Data inicial", type: "date", required: true },
  { key: "deadline", label: "Prazo opcional", type: "date" },
  select("priority", "Prioridade", [
    ["high", "Alta"],
    ["medium", "Média"],
    ["low", "Baixa"],
  ]),
  select("status", "Estado da meta", [
    ["active", "Ativa"],
    ["completed", "Concluída"],
    ["archived", "Arquivada"],
  ]),
  { key: "notes", label: "Observações", type: "textarea" },
];
export const milestoneFields: FutureField[] = [
  { key: "title", label: "Título do marco", required: true },
  { key: "deadline", label: "Prazo do marco (opcional)", type: "date" },
  { key: "budget", label: "Orçamento opcional (R$)", type: "money" },
  { key: "completed", label: "Marco concluído", type: "checkbox" },
  { key: "notes", label: "Observações", type: "textarea" },
];
export const projectFields: FutureField[] = [
  { key: "service", label: "Serviço ou projeto", required: true },
  { key: "client", label: "Cliente ou origem" },
  { key: "category", label: "Categoria", required: true },
  { key: "description", label: "Descrição", type: "textarea" },
  { key: "estimated", label: "Valor estimado opcional (R$)", type: "money" },
  { key: "contracted", label: "Valor contratado opcional (R$)", type: "money" },
  {
    key: "forecastCosts",
    label: "Custos previstos opcionais (R$)",
    type: "money",
  },
  select("stage", "Etapa", Object.entries(stageLabels)),
  { key: "deadline", label: "Prazo opcional", type: "date" },
  { key: "nextAction", label: "Próxima ação" },
  { key: "notes", label: "Observações", type: "textarea" },
  {
    key: "costsComplete",
    label: "Confirmei todos os custos realizados até agora (inclusive se zero)",
    type: "checkbox",
  },
  {
    key: "hoursComplete",
    label: "Registrei todo o tempo dedicado até agora",
    type: "checkbox",
  },
];
