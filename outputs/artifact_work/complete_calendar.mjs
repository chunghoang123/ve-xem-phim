import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const inputPath = path.join(here, "Calendar.xlsx");
const outputPath = path.join(here, "..", "completed", "Calendar-Completed.xlsx");
const previewPath = path.join(here, "Calendar-Completed.png");

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const sheet = workbook.worksheets.getItemAt(0);

sheet.getRange("A4:G4").values = [[
  "13/07/2026\nRà soát SRS\nĐối chiếu repo\nChốt phạm vi\nĐầu ra: SRS 2.1",
  "14/07/2026\nKiến trúc & DB\nChuẩn hóa migration\nCập nhật ERD\nĐầu ra: thiết kế",
  "15/07/2026\nBooking/giữ ghế\nXử lý xung đột\nBill & ticket\nĐầu ra: luồng vé",
  "16/07/2026\nPayOS & webhook\nSSE trạng thái\nKiểm tra chữ ký\nĐầu ra: thanh toán",
  "17/07/2026\nAuth & phân quyền\nJWT/Firebase\nToken rotation\nĐầu ra: bảo mật",
  "18/07/2026\nUI người dùng\nPhim/ghế/checkout\nResponsive UI\nĐầu ra: UI",
  "19/07/2026\nReview tuần 1\nChốt tồn đọng\nCập nhật backlog\nĐầu ra: biên bản",
]];

sheet.getRange("A10:G10").values = [[
  "20/07/2026\nCineX AI\nLuồng hội thoại\nTMDB/Places fallback\nĐầu ra: chatbot",
  "21/07/2026\nKhuyến mãi/bắp nước\nCRUD & tồn kho\nTính tổng hóa đơn\nĐầu ra: add-on",
  "22/07/2026\nKiểm thử tích hợp\nAPI/UI/DB\nPayOS end-to-end\nĐầu ra: test log",
  "23/07/2026\nKiểm thử bảo mật\nGiá server-side\nWebhook idempotency\nĐầu ra: test pass",
  "24/07/2026\nSửa lỗi & tối ưu\nHiệu năng/UX\nRà soát log\nĐầu ra: RC",
  "25/07/2026\nHoàn thiện tài liệu\nReport/Technical\nKiểm tra bố cục\nĐầu ra: bộ hồ sơ",
  "26/07/2026\nDemo & UAT\nKịch bản nghiệm thu\nGhi nhận phản hồi\nĐầu ra: bàn giao",
]];

for (const range of [sheet.getRange("A4:G8"), sheet.getRange("A10:G14")]) {
  range.format.wrapText = true;
  range.format.verticalAlignment = "top";
  range.format.horizontalAlignment = "left";
}
sheet.getRange("G4:G8").format.font.color = "#000000";
sheet.getRange("G10:G14").format.font.color = "#000000";

const preview = await workbook.render({ sheetName: sheet.name, autoCrop: "all", scale: 1.5, format: "png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const check = await workbook.inspect({
  kind: "table",
  sheetId: sheet.name,
  range: "A1:G14",
  include: "values,formulas",
  tableMaxRows: 14,
  tableMaxCols: 7,
  maxChars: 16000,
});
await fs.writeFile(path.join(here, "Calendar-Completed-check.ndjson"), check.ndjson, "utf8");

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
await fs.writeFile(path.join(here, "Calendar-Completed-errors.ndjson"), errors.ndjson, "utf8");

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
