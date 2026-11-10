import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { db } from "../../db/database";
import { allocated } from "../../services/future-calculations";
import { money } from "../../lib/date";
export function ReservationSummary({
  afterKnownBills,
}: {
  afterKnownBills: number;
}) {
  const result = useLiveQuery(async () => {
    try {
      return {
        error: false,
        reserved: allocated(await db.goalMovements.toArray()),
      };
    } catch {
      return { error: true, reserved: 0 };
    }
  }, []);
  if (!result) return <p role="status">Conferindo alocações das metas…</p>;
  if (result.error)
    return (
      <p role="alert">
        Não foi possível conferir os valores reservados.{" "}
        <Link to="/metas">Abrir metas</Link>
      </p>
    );
  if (!result.reserved) return null;
  return (
    <div className="backup-warning">
      <strong>
        Dentro deste saldo: {money(result.reserved)} reservados em metas.
      </strong>
      <p>
        Após os compromissos conhecidos e essas alocações:{" "}
        {money(afterKnownBills - result.reserved)}. A reserva continua no banco,
        mas precisa ser liberada antes de ser usada em outro movimento.
      </p>
      <Link className="text-link" to="/metas/objetivos">
        Revisar alocações →
      </Link>
    </div>
  );
}
