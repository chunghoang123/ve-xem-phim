import io
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
ET.register_namespace("", NS_MAIN)
ET.register_namespace("r", NS_REL)


def qn(ns, tag):
    return f"{{{ns}}}{tag}"


def fix_mojibake(text):
    if not text:
        return text
    markers = ("Ã", "Â", "Ä", "Æ", "áº", "á»", "â€", "â—", "ï¿½")
    value = text
    for _ in range(2):
        if not any(marker in value for marker in markers):
            break
        try:
            repaired = value.encode("cp1252").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            break
        if repaired == value:
            break
        value = repaired
    return value


def column_number(ref):
    letters = re.match(r"[A-Z]+", ref).group(0)
    result = 0
    for char in letters:
        result = result * 26 + ord(char) - 64
    return result


def row_number(ref):
    return int(re.search(r"\d+", ref).group(0))


def get_or_create_cell(root, ref):
    sheet_data = root.find(qn(NS_MAIN, "sheetData"))
    row_idx = row_number(ref)
    row = sheet_data.find(f"{qn(NS_MAIN, 'row')}[@r='{row_idx}']")
    if row is None:
        row = ET.Element(qn(NS_MAIN, "row"), {"r": str(row_idx)})
        rows = list(sheet_data)
        pos = next((i for i, item in enumerate(rows) if int(item.get("r")) > row_idx), len(rows))
        sheet_data.insert(pos, row)
    cell = row.find(f"{qn(NS_MAIN, 'c')}[@r='{ref}']")
    if cell is None:
        cell = ET.Element(qn(NS_MAIN, "c"), {"r": ref})
        cells = list(row)
        pos = next((i for i, item in enumerate(cells) if column_number(item.get("r")) > column_number(ref)), len(cells))
        row.insert(pos, cell)
    return cell


def clear_cell(cell):
    for child in list(cell):
        if child.tag in (qn(NS_MAIN, "f"), qn(NS_MAIN, "v"), qn(NS_MAIN, "is")):
            cell.remove(child)
    cell.attrib.pop("t", None)


def set_string(root, ref, value):
    cell = get_or_create_cell(root, ref)
    clear_cell(cell)
    if value in (None, ""):
        return
    cell.set("t", "inlineStr")
    inline = ET.SubElement(cell, qn(NS_MAIN, "is"))
    text = ET.SubElement(inline, qn(NS_MAIN, "t"))
    text.text = str(value)


def set_number(root, ref, value):
    cell = get_or_create_cell(root, ref)
    clear_cell(cell)
    cell.set("t", "n")
    node = ET.SubElement(cell, qn(NS_MAIN, "v"))
    node.text = str(value)


def resolve_target(base, target):
    normalized = target.replace("\\", "/").lstrip("/")
    if normalized.startswith("xl/"):
        return normalized
    base_parts = base.split("/")[:-1]
    for part in normalized.split("/"):
        if part == "..":
            if base_parts:
                base_parts.pop()
        elif part not in ("", "."):
            base_parts.append(part)
    return "/".join(base_parts)


input_path = Path(sys.argv[1])
output_path = Path(sys.argv[2])
with zipfile.ZipFile(input_path) as zf:
    parts = {info.filename: zf.read(info.filename) for info in zf.infolist()}

# Repair mojibake in all human-visible text nodes without changing workbook structure.
for name, payload in list(parts.items()):
    if not name.endswith(".xml"):
        continue
    try:
        root = ET.fromstring(payload)
    except ET.ParseError:
        continue
    changed = False
    for node in root.iter():
        if node.tag.endswith("}t") and node.text:
            repaired = fix_mojibake(node.text)
            if repaired != node.text:
                node.text = repaired
                changed = True
    if changed:
        parts[name] = ET.tostring(root, encoding="utf-8", xml_declaration=True)

workbook = ET.fromstring(parts["xl/workbook.xml"])
rels = ET.fromstring(parts["xl/_rels/workbook.xml.rels"])
rel_map = {rel.get("Id"): rel.get("Target") for rel in rels.findall(qn(NS_PKG_REL, "Relationship"))}
sheet_parts = {}
for sheet in workbook.find(qn(NS_MAIN, "sheets")):
    rid = sheet.get(qn(NS_REL, "id"))
    target = rel_map[rid]
    sheet_parts[fix_mojibake(sheet.get("name"))] = resolve_target("xl/workbook.xml", target)

parsed = {name: ET.fromstring(parts[path]) for name, path in sheet_parts.items()}

def strings(sheet, mapping):
    root = parsed[sheet]
    for ref, value in mapping.items():
        set_string(root, ref, value)


def numbers(sheet, mapping):
    root = parsed[sheet]
    for ref, value in mapping.items():
        set_number(root, ref, value)


strings("1. Project Charter", {
    "B2": "DỰ ÁN AI BOOK MOVIE TICKETS",
    "B3": "Học viện Công nghệ Bưu chính Viễn thông – Khoa Công nghệ Thông tin",
    "B4": "Giảng viên hướng dẫn / Hội đồng đánh giá",
    "B5": "Hoàng Văn Chung",
    "B6": "Hoàng Văn Chung",
    "B7": "Hoàng Văn Chung – D24TX",
    "B9": "Xây dựng hệ thống đặt vé xem phim trực tuyến CineX, hỗ trợ tra cứu phim/suất chiếu, giữ ghế, đặt vé, thanh toán PayOS, nhận vé QR, quản trị dữ liệu và trợ lý hội thoại đặt vé.",
    "B10": "Frontend React/Vite, backend Express, MySQL/Firebase, JWT access/refresh, PayOS, TMDB và Google Places có cơ chế fallback khi dịch vụ ngoài không khả dụng.",
    "E10": "Không triển khai hạ tầng rạp vật lý; không tích hợp kế toán/CRM; dữ liệu TMDB/Places phụ thuộc khóa API và kết nối mạng.",
    "B11": "01 thành viên – phạm vi đồ án/MVP",
    "E11": "Hoàng Văn Chung – D24TX",
    "B13": "Mã nguồn frontend/backend, cơ sở dữ liệu và migrations, API booking/payment, giao diện người dùng/admin, trợ lý CineX AI, kiểm thử, SRS 2.1, báo cáo và tài liệu kế hoạch kỹ thuật.",
})

strings("2. Price", {
    "A1": "DỰ ÁN AI BOOK MOVIE TICKETS",
    "A2": "Người thực hiện: Hoàng Văn Chung – D24TX",
    "B3": "Dự án: AI Book Movie Tickets",
    "B4": "Đơn vị: PTIT – Khoa Công nghệ Thông tin",
    "B5": "Dự án: AI Book Movie Tickets",
    "B6": "Phạm vi: Đồ án/MVP CineX",
    "J11": "Đơn giá là ước lượng nội bộ cho đồ án/MVP, dùng để lập kế hoạch nguồn lực; không phải báo giá thương mại.",
})

strings("3. Master Plan", {
    "A1": "Dự án AI Book Movie Tickets",
    "A2": "Đơn vị: PTIT – Khoa Công nghệ Thông tin",
    "A3": "Người lập: Hoàng Văn Chung – D24TX",
})
numbers("3. Master Plan", {
    "F10": 1, "F11": 1, "F12": 1, "F13": 1, "F14": 1,
    "F16": 1, "F17": 1, "F18": 1, "F19": 1, "F20": 0.85,
    "F23": 1, "F24": 1, "F26": 0.8, "F29": 0.9, "F32": 0.85,
    "F35": 0.95, "F38": 0.95, "F41": 0.85, "F44": 0.9, "F47": 0.85,
    "F50": 0.5, "F57": 0.6, "F58": 0.5, "F59": 0.5, "F60": 0.1,
})

staff = "4. Nhân sự dự án"
strings(staff, {"A1": "DANH SÁCH NHÂN SỰ THAM GIA DỰ ÁN AI BOOK MOVIE TICKETS"})
for row in range(4, 15):
    for col in "ABCDEFGHI":
        set_string(parsed[staff], f"{col}{row}", "")
strings(staff, {
    "A4": "1", "B4": "Hoàng Văn Chung", "C4": "PTIT – Khoa CNTT",
    "D4": "Sinh viên / Full-stack Developer", "E4": "Phân tích, thiết kế, phát triển, kiểm thử và tài liệu", "I4": "Người thực hiện",
    "A12": "1", "B12": "Giảng viên hướng dẫn", "C12": "PTIT – Khoa CNTT",
    "D12": "Reviewer / Mentor", "E12": "Hướng dẫn chuyên môn và đánh giá",
    "A13": "2", "B13": "Người dùng thử nghiệm", "C13": "CineX demo",
    "D13": "Key User", "E13": "UAT luồng đặt vé và quản trị",
})

strings("7. Cập nhật tiến độ", {
    "F2": "DỰ ÁN AI BOOK MOVIE TICKETS",
    "F4": "Project Owner: Hoàng Văn Chung",
    "F5": "Workstream: Full-stack / QA / Documentation",
    "F6": "Updated by: Hoàng Văn Chung",
    "F7": "Updated on: 13/07/2026",
    "G13": "Completed", "G14": "Completed", "G15": "Completed",
    "G16": "In Progress", "G17": "In Progress", "G18": "In Progress", "G19": "In Progress",
})

strings("2. Master Planxxx", {
    "A2": "TRIỂN KHAI DỰ ÁN AI BOOK MOVIE TICKETS",
    "A17": "WORKSTREAM 1: Nền tảng & kiến trúc",
    "A23": "WORKSTREAM 2: Booking & thanh toán PayOS",
    "A29": "WORKSTREAM 3: CineX AI & tích hợp dữ liệu",
    "A34": "WORKSTREAM 4: Admin, kiểm thử & bàn giao",
})

for sheet_name, root in parsed.items():
    parts[sheet_parts[sheet_name]] = ET.tostring(root, encoding="utf-8", xml_declaration=True)

# Update workbook metadata and force formula recalculation on open.
calc = workbook.find(qn(NS_MAIN, "calcPr"))
if calc is None:
    calc = ET.SubElement(workbook, qn(NS_MAIN, "calcPr"))
calc.set("fullCalcOnLoad", "1")
calc.set("forceFullCalc", "1")
parts["xl/workbook.xml"] = ET.tostring(workbook, encoding="utf-8", xml_declaration=True)

core_name = "docProps/core.xml"
if core_name in parts:
    core = ET.fromstring(parts[core_name])
    for node in core.iter():
        if node.tag.endswith("}creator") or node.tag.endswith("}lastModifiedBy"):
            node.text = "Hoàng Văn Chung"
    parts[core_name] = ET.tostring(core, encoding="utf-8", xml_declaration=True)

output_path.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for name, payload in parts.items():
        zf.writestr(name, payload)

formula_errors = []
for name, payload in parts.items():
    if not name.startswith("xl/worksheets/") or not name.endswith(".xml"):
        continue
    root = ET.fromstring(payload)
    for cell in root.findall(f".//{qn(NS_MAIN, 'c')}"):
        formula = cell.find(qn(NS_MAIN, "f"))
        if formula is None or not formula.text:
            continue
        for error in ("#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "#N/A"):
            if error in formula.text:
                formula_errors.append({"part": name, "cell": cell.get("r"), "error": error})
(output_path.parent / "Template-Technical-Completed-validation.json").write_text(
    json.dumps({"output": str(output_path), "sheets": list(sheet_parts), "formula_errors": formula_errors}, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print(output_path)
