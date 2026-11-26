function escXml(val: string | number | null | undefined): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Exports tabular data as Excel-compatible SpreadsheetML (.xls) with zero dependencies. */
export function downloadExcelXml(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
) {
  const headerXml = `<Row>${headers
    .map((h) => `<Cell><Data ss:Type="String">${escXml(h)}</Data></Cell>`)
    .join("")}</Row>`;

  const rowsXml = rows
    .map(
      (cols) =>
        `<Row>${cols
          .map((c) => {
            const isNum = typeof c === "number" && Number.isFinite(c);
            return `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${escXml(c)}</Data></Cell>`;
          })
          .join("")}</Row>`
    )
    .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escXml(sheetName)}">
  <Table>${headerXml}${rowsXml}</Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
