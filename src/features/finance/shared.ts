import type { FinanceData } from "./models";
import type { FinanceFormRequest } from "../../services/finance/forms";
export interface FinancePanelProps {
  data: FinanceData;
  onOpen: (request: FinanceFormRequest) => void;
}
export const statusNames: Record<string, string> = {
  planned: "Previsto",
  pending: "Pendente",
  partial: "Parcial",
  paid: "Pago / recebido",
  cancelled: "Cancelado",
};
