export type ChartTableData = {
  /** Cabeçalho da primeira coluna ("Competência", "Semana"). */
  rowHeader: string;
  columns: readonly string[];
  rows: readonly { label: string; cells: readonly string[] }[];
};

/** Os mesmos números do gráfico, em tabela — para quem lê sem ver o desenho. */
export function ChartTable({
  caption,
  data,
}: {
  caption: string;
  data: ChartTableData;
}) {
  return (
    <table className="w-full border-collapse text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-line text-muted">
          <th scope="col" className="py-1.5 pr-3 font-medium">
            {data.rowHeader}
          </th>
          {data.columns.map((column) => (
            <th key={column} scope="col" className="py-1.5 pr-3 font-medium">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row) => (
          <tr key={row.label} className="border-b border-line/60 text-ink">
            <th scope="row" className="py-1.5 pr-3 font-normal">
              {row.label}
            </th>
            {row.cells.map((cell, index) => (
              <td key={index} className="py-1.5 pr-3 font-mono text-xs">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
