export function createCsv(rows: Record<string, unknown>[]) {
  const headers = rows.length ? Object.keys(rows[0]) : ["sem_registros"];
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (typeof v === "string" && /^\s*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [
      headers.map(cell).join(";"),
      ...rows.map((row) => headers.map((h) => cell(row[h])).join(";")),
    ].join("\r\n")
  );
}
export function downloadCsv(rows: Record<string, unknown>[]) {
  const url = URL.createObjectURL(
    new Blob([createCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "minha-virada-financas.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
