from pathlib import Path
import sys

from openpyxl import load_workbook

sys.stdout.reconfigure(encoding="utf-8")

path = Path("../completed/Template-Technical-Completed.xlsx")
wb = load_workbook(path, data_only=False)

checks = {
    "1. Project Charter": ["B2", "B9", "B10", "B13"],
    "2. Price": ["A1", "A2", "B3", "G32", "H32", "G48"],
    "3. Master Plan": ["A1", "G3", "B10", "B18", "B47", "F10", "I10", "L10"],
    "4. Nhân sự dự án": ["A1", "B4", "B9", "B12"],
    "7. Cập nhật tiến độ": ["F2", "A13", "G13", "A19", "G19"],
}

for sheet_name, cells in checks.items():
    ws = wb[sheet_name]
    print(f"SHEET\t{sheet_name}")
    for cell in cells:
        value = ws[cell].value
        print(f"{cell}\t{value}")

formula_errors = []
for ws in wb.worksheets:
    for row in ws.iter_rows():
        for cell in row:
            value = cell.value
            if isinstance(value, str) and any(err in value for err in ("#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "#N/A")):
                formula_errors.append((ws.title, cell.coordinate, value))

print(f"FORMULA_ERROR_REFERENCES\t{len(formula_errors)}")
for item in formula_errors[:50]:
    print("\t".join(map(str, item)))

print(f"SAVED\t{path.resolve()}")
