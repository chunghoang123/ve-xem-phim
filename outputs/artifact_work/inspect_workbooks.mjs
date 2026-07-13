import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const renderDir = path.join(workDir, "renders-original");
await fs.mkdir(renderDir, { recursive: true });

const allInputs = [
  path.join(workDir, "..", "template_technical_work", "Template-Technical.xlsx"),
  path.join(workDir, "Calendar.xlsx"),
  path.join(workDir, "..", "completed", "Template-Technical-Completed.xlsx"),
];
const requested = new Set(process.argv.slice(2));
const inputs = requested.size
  ? allInputs.filter((p) => requested.has(path.basename(p, ".xlsx")))
  : allInputs;

for (const inputPath of inputs) {
  console.log(`Importing ${inputPath}`);
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
  console.log(`Inspecting ${inputPath}`);
  const summary = await workbook.inspect({
    kind: "workbook,sheet,table,definedName,drawing",
    maxChars: 12000,
    tableMaxRows: 12,
    tableMaxCols: 16,
    tableMaxCellChars: 120,
  });
  const stem = path.basename(inputPath, ".xlsx").replaceAll(" ", "_");
  await fs.writeFile(path.join(renderDir, `${stem}-summary.ndjson`), summary.ndjson, "utf8");

  const sheetInfo = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 12000 });
  await fs.writeFile(path.join(renderDir, `${stem}-sheets.ndjson`), sheetInfo.ndjson, "utf8");
  const sheetNames = [...sheetInfo.ndjson.matchAll(/"name":"([^"]+)"/g)].map((m) => m[1]);

  for (const sheetName of sheetNames) {
    console.log(`Rendering ${path.basename(inputPath)} :: ${sheetName}`);
    const region = await workbook.inspect({
      kind: "region",
      sheetId: sheetName,
      range: "A1:AZ120",
      maxChars: 30000,
      tableMaxRows: 120,
      tableMaxCols: 52,
      tableMaxCellChars: 200,
    });
    await fs.writeFile(path.join(renderDir, `${stem}-${sheetName.replaceAll(/[\\/:*?\"<>|]/g, "_")}-region.ndjson`), region.ndjson, "utf8");

    const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1.2, format: "png" });
    await fs.writeFile(
      path.join(renderDir, `${stem}-${sheetName.replaceAll(/[\\/:*?\"<>|]/g, "_")}.png`),
      new Uint8Array(await preview.arrayBuffer()),
    );
  }
}
