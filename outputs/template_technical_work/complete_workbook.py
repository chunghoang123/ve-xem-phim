from copy import copy
from datetime import datetime, timedelta
from pathlib import Path
import sys

from openpyxl import load_workbook
from openpyxl.styles import PatternFill, Font, Alignment
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding="utf-8")

INPUT = Path("Template-Technical.xlsx")
OUTPUT_DIR = Path("../completed")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT = OUTPUT_DIR / "Template-Technical-Completed.xlsx"

PROJECT = "AI Book Movie Tickets"
CLIENT = "Cinex / Hệ thống rạp phim"
TEAM = "Nhóm phát triển AI Book Movie Tickets"
PM = "Đặng Thành Trung"
START = datetime(2026, 7, 15)
END = datetime(2026, 10, 15)

wb = load_workbook(INPUT)


def setv(ws, cell, value):
    ws[cell] = value


def clone_row_style(ws, source_row, target_row, max_col=None):
    max_col = max_col or ws.max_column
    for col in range(1, max_col + 1):
        src = ws.cell(source_row, col)
        dst = ws.cell(target_row, col)
        if src.has_style:
            dst._style = copy(src._style)
        if src.number_format:
            dst.number_format = src.number_format
        if src.alignment:
            dst.alignment = copy(src.alignment)


def add_status_validation(ws, rng):
    from openpyxl.worksheet.datavalidation import DataValidation

    dv = DataValidation(type="list", formula1='"Not start,In progress,Done"', allow_blank=True)
    ws.add_data_validation(dv)
    dv.add(rng)


def fill_roadmap():
    ws = wb["0. Roadmap"]
    setv(ws, "B2", "KẾ HOẠCH CÔNG NGHỆ THÔNG TIN 2026-2027")
    setv(ws, "D2", 2026)
    setv(ws, "P2", 2027)
    months_2026 = [7, 8, 9, 10, 11, 12, "", "", "", "", "", ""]
    months_2027 = [1, 2, 3, 4, 5, 6, "", "", "", "", "", ""]
    for idx, value in enumerate(months_2026 + months_2027, start=4):
        ws.cell(3, idx).value = value

    rows = {
        5: (4, 5),
        6: (5, 7),
        9: (4, 7),
        10: (5, 8),
        11: (6, 8),
        12: (6, 7),
        13: (7, 9),
        14: (8, 10),
        15: (9, 10),
        16: (9, 11),
        17: (8, 10),
        18: (8, 10),
        19: (7, 9),
        20: (8, 10),
        21: (9, 11),
        22: (10, 12),
        23: (11, 15),
        24: (12, 16),
        27: (5, 7),
        30: (4, 6),
        31: (5, 8),
    }
    fill = PatternFill("solid", fgColor="4F81BD")
    done_fill = PatternFill("solid", fgColor="70AD47")
    for row, (start_col, end_col) in rows.items():
        for col in range(start_col, end_col + 1):
            ws.cell(row, col).value = "●"
            ws.cell(row, col).fill = done_fill if col <= 6 else fill
            ws.cell(row, col).font = Font(color="FFFFFF", bold=True)
            ws.cell(row, col).alignment = Alignment(horizontal="center", vertical="center")


def fill_charter():
    ws = wb["1. Project Charter"]
    values = {
        "B2": f"DỰ ÁN {PROJECT}",
        "B3": CLIENT,
        "B4": "Ban điều hành sản phẩm và đại diện vận hành rạp",
        "B5": PM,
        "B6": PM,
        "B7": TEAM,
        "B8": START,
        "E8": END,
        "B9": (
            "Triển khai hệ thống đặt vé xem phim trực tuyến có AI hỗ trợ tư vấn phim, "
            "tìm suất chiếu, chọn ghế, thanh toán PayOS, quản trị phim/rạp/suất chiếu/khuyến mãi "
            "và theo dõi booking theo thời gian thực."
        ),
        "B10": "Frontend React/Vite, backend Express/MySQL/Firebase, cổng thanh toán PayOS, tích hợp TMDB/Google Places khi có khóa API hợp lệ.",
        "E10": "Không triển khai hạ tầng production vật lý, không tích hợp hệ thống kế toán/CRM ngoài phạm vi.",
        "B11": "120 ngày công",
        "E11": TEAM,
        "B13": (
            "Mã nguồn ứng dụng, cơ sở dữ liệu, API backend, giao diện người dùng/admin, "
            "luồng đặt vé và thanh toán, tài liệu cấu hình môi trường, kịch bản kiểm thử và hướng dẫn bàn giao."
        ),
    }
    for cell, value in values.items():
        setv(ws, cell, value)
    for cell in ("B8", "E8"):
        ws[cell].number_format = "dd/mm/yyyy"


def fill_master_plan():
    ws = wb["3. Master Plan"]
    ws["A1"] = f"Dự án {PROJECT}"
    ws["A2"] = f"Đơn vị: {TEAM}"
    ws["A3"] = f"Người lập: {PM}"
    ws["G3"] = START
    ws["G3"].number_format = "dd/mm/yyyy"
    ws["G4"] = "Weekly"
    ws["G5"] = 14

    tasks = [
        (10, "1", "Khởi động dự án", "Thống nhất mục tiêu, phạm vi, vai trò và kênh phối hợp.", "PM", CLIENT, "Done", 0, 2, 0, 2),
        (11, "2", "Khảo sát, tổng hợp thông tin yêu cầu", "Làm rõ luồng đặt vé, chọn ghế, thanh toán, quản trị và AI chat.", "BA", CLIENT, "Done", 2, 7, 2, 7),
        (12, "3", "Thống nhất đầu bài và phương án triển khai", "Chốt backlog, công nghệ và tiêu chí nghiệm thu.", "PM/Tech Lead", CLIENT, "Done", 7, 10, 7, 10),
        (13, "4", "Ký kết/phê duyệt phạm vi", "Phê duyệt phạm vi phiên bản bàn giao.", "PM", CLIENT, "Done", 10, 12, 10, 12),
        (14, "5", "Kick-off dự án", "Khởi động triển khai với toàn bộ nhóm.", "PM", CLIENT, "Done", 12, 13, 12, 13),
        (16, "1", "Lập kế hoạch dự án", "Lập timeline, phân rã module và kế hoạch kiểm thử.", "PM", "Team", "Done", 0, 5, 0, 5),
        (17, "2", "Phân tích yêu cầu nghiệp vụ", "Đặc tả người dùng, admin, booking, thanh toán, khuyến mãi.", "BA", CLIENT, "Done", 5, 14, 5, 14),
        (18, "3", "Thiết kế kiến trúc hệ thống", "Thiết kế React frontend, Express API, MySQL/Firebase và dịch vụ tích hợp.", "Tech Lead", "Backend", "Done", 10, 18, 10, 18),
        (19, "4", "Thiết kế các module chức năng", "Thiết kế movie, cinema, showtime, seat, booking, payment, promotion, user.", "BA/Tech Lead", "Team", "In progress", 14, 24, 14, 24),
        (20, "5", "Thiết kế giao diện Web/App", "Hoàn thiện wireframe và UI cho trang người dùng/admin.", "Frontend", "BA", "In progress", 16, 28, 16, 28),
        (23, "1", "Nền tảng hệ thống", "Cấu hình Vite, Express, routing, middleware, biến môi trường.", "Tech Lead", "Team", "Done", 20, 28, 20, 28),
        (24, "1.1", "Đăng nhập/đăng xuất", "Xác thực email/password, Google OAuth, JWT và phân quyền.", "Backend", "Frontend", "Done", 24, 32, 24, 32),
        (26, "1.2", "Quản lý tài khoản", "Hồ sơ người dùng, đổi mật khẩu, vai trò admin/staff/user.", "Backend", "Frontend", "In progress", 28, 38, 28, 38),
        (29, "1.3", "Quản lý phim", "Danh sách phim, chi tiết phim, poster, trailer, TMDB sync.", "Frontend", "Backend", "In progress", 32, 46, 32, 46),
        (32, "1.4", "Quản lý rạp và suất chiếu", "Rạp, phòng chiếu, lịch chiếu, ghế và trạng thái giữ ghế.", "Backend", "Frontend", "In progress", 40, 56, 40, 56),
        (35, "1.5", "Đặt vé và chọn ghế", "Chọn suất chiếu, giữ ghế, tạo booking, xuất vé.", "Fullstack", "QA", "In progress", 50, 68, 50, 68),
        (38, "2", "Thanh toán PayOS", "Tạo link thanh toán, webhook, success/cancel flow, bill.", "Backend", "Frontend", "Not start", 62, 76, "", ""),
        (41, "3", "AI chat tư vấn phim", "Chat hỗ trợ tìm phim, tư vấn suất chiếu và câu hỏi thường gặp.", "AI/Backend", "Frontend", "Not start", 68, 84, "", ""),
        (44, "4", "Khuyến mãi", "CRUD mã khuyến mãi, áp dụng giảm giá khi checkout.", "Fullstack", "QA", "Not start", 76, 88, "", ""),
        (47, "5", "Dashboard quản trị", "Quản lý user, phim, rạp, suất chiếu, booking, doanh thu cơ bản.", "Frontend", "Backend", "Not start", 84, 98, "", ""),
        (50, "6", "Thông báo Email/SMS", "Gửi OTP, xác nhận vé, trạng thái giao dịch.", "Backend", "QA", "Not start", 92, 104, "", ""),
        (57, "1", "Kiểm thử chức năng", "Test auth, booking, payment, admin, promotion và AI chat.", "QA", "Team", "Not start", 98, 112, "", ""),
        (58, "2", "Kiểm thử tích hợp", "Kiểm thử PayOS webhook, Firebase, MySQL và API bên ngoài.", "QA", "Backend", "Not start", 106, 116, "", ""),
        (59, "3", "Sửa lỗi và tối ưu", "Fix lỗi, tối ưu UI/API, xử lý lỗi mạng/API key.", "Team", "QA", "Not start", 112, 124, "", ""),
        (60, "4", "UAT và nghiệm thu", "Demo cho người dùng, ghi nhận phản hồi, chốt nghiệm thu.", "PM", CLIENT, "Not start", 124, 132, "", ""),
    ]
    status_progress = {"Done": 1, "In progress": 0.45, "Not start": 0}
    for row, no, name, summary, owner, support, status, plan_start, plan_end, actual_start, actual_end in tasks:
        ws.cell(row, 1).value = no
        ws.cell(row, 2).value = name
        ws.cell(row, 3).value = summary
        ws.cell(row, 4).value = owner
        ws.cell(row, 5).value = support
        ws.cell(row, 6).value = status_progress[status]
        ws.cell(row, 7).value = START + timedelta(days=plan_start)
        ws.cell(row, 8).value = START + timedelta(days=plan_end)
        ws.cell(row, 9).value = f'=IF(OR(ISBLANK(G{row}),ISBLANK(H{row})),"",H{row}-G{row}+1)'
        if actual_start != "":
            ws.cell(row, 10).value = START + timedelta(days=actual_start)
            ws.cell(row, 11).value = START + timedelta(days=actual_end)
        else:
            ws.cell(row, 10).value = None
            ws.cell(row, 11).value = None
        ws.cell(row, 12).value = f'=IF(OR(ISBLANK(J{row}),ISBLANK(K{row})),"",K{row}-J{row}+1)'
        for col in (7, 8, 10, 11):
            ws.cell(row, col).number_format = "dd/mm/yyyy"
        ws.cell(row, 6).number_format = "0%"


def fill_price():
    ws = wb["2. Price"]
    ws["A1"] = f"DỰ ÁN {PROJECT}"
    ws["A2"] = f"Công ty: {TEAM}"
    ws["B3"] = f"Dự án: {PROJECT}"
    ws["E3"] = START
    ws["B4"] = f"Khách hàng: {CLIENT}"
    ws["E4"] = END
    for cell in ("E3", "E4"):
        ws[cell].number_format = "dd/mm/yyyy"

    rows = {
        12: (3, 3, "Kế hoạch dự án, WBS, timeline, risk log"),
        13: (5, 8, "Khảo sát nghiệp vụ đặt vé, rạp, suất chiếu, thanh toán"),
        14: (4, 6, "Kiến trúc frontend/backend/database/integration"),
        15: (7, 12, "Thiết kế module movie, cinema, showtime, booking, payment, admin"),
        16: (5, 8, "Thiết kế UI người dùng và admin"),
        19: (4, 6, "Auth, role, profile, JWT/Google OAuth"),
        21: (3, 4, "Đổi mật khẩu, cập nhật hồ sơ"),
        22: (5, 8, "Quản lý phim, poster, trailer, TMDB sync"),
        23: (6, 10, "Quản lý rạp, phòng chiếu, ghế"),
        24: (6, 10, "Quản lý suất chiếu và seat hold"),
        26: (4, 6, "Danh sách phim, tìm kiếm, lọc, chi tiết"),
        27: (5, 8, "Chọn suất chiếu, chọn ghế, checkout"),
        28: (5, 8, "PayOS payment, webhook, bill, success/cancel"),
        29: (4, 6, "Khuyến mãi, mã giảm giá"),
        30: (5, 8, "AI chat tư vấn phim và suất chiếu"),
        31: (6, 10, "Admin dashboard, bookings, users, cinemas, movies"),
        34: (4, 6, "Kiểm thử chức năng chính"),
        35: (3, 5, "Kiểm thử tích hợp thanh toán/API ngoài"),
        36: (4, 6, "Sửa lỗi và tối ưu"),
        37: (2, 3, "UAT và nghiệm thu"),
    }
    for row, (days, effort, comment) in rows.items():
        ws.cell(row, 4).value = days
        ws.cell(row, 5).value = effort
        ws.cell(row, 6).value = comment
    ws["D17"] = "=SUM(D19:D31)"
    ws["E17"] = "=SUM(E19:E31)"
    ws["B32"] = "Tổng hợp phân tích, phát triển và kiểm thử"
    ws["G32"] = "=SUM(D12:D16,D17,D34:D37)"
    ws["H32"] = "=SUM(E12:E16,E17,E34:E37)"
    ws["B48"] = "Tổng effort dự kiến"
    ws["G48"] = "=SUM(E12:E16,E17,E34:E37)"
    ws["H48"] = "manday"


def fill_staff():
    ws = wb["4. Nhân sự dự án"]
    ws["A1"] = f"DANH SÁCH NHÂN SỰ THAM GIA DỰ ÁN {PROJECT}"
    staff = [
        (4, 1, PM, TEAM, "Project Manager", "Quản lý dự án", "0900000001", "pm@cinex.local", "Điều phối chung"),
        (5, 2, "Nguyễn Minh Anh", TEAM, "Business Analyst", "Phân tích nghiệp vụ", "0900000002", "ba@cinex.local", ""),
        (6, 3, "Trần Quốc Bảo", TEAM, "Tech Lead / Backend", "Thiết kế API, DB, tích hợp", "0900000003", "backend@cinex.local", ""),
        (7, 4, "Lê Hoài Nam", TEAM, "Frontend Developer", "React/Vite UI", "0900000004", "frontend@cinex.local", ""),
        (8, 5, "Phạm Thanh Hằng", TEAM, "QA Engineer", "Kiểm thử hệ thống", "0900000005", "qa@cinex.local", ""),
        (9, 6, "Bùi Gia Khang", TEAM, "DevOps/Support", "Cấu hình môi trường", "0900000006", "devops@cinex.local", ""),
        (12, 1, "Đại diện vận hành rạp", CLIENT, "Product Owner", "Nghiệm thu nghiệp vụ", "0900000010", "po@cinex.local", ""),
        (13, 2, "Nhân sự quầy vé", CLIENT, "Key User", "Kiểm thử luồng bán vé", "0900000011", "ticket@cinex.local", ""),
        (14, 3, "Nhân sự marketing", CLIENT, "Key User", "Kiểm thử khuyến mãi", "0900000012", "marketing@cinex.local", ""),
    ]
    for row, *values in staff:
        for col, value in enumerate(values, start=1):
            ws.cell(row, col).value = value


def fill_tracking():
    ws = wb["7. Cập nhật tiến độ"]
    ws["F2"] = f"DỰ ÁN {PROJECT}"
    ws["F4"] = f"Project Manager: {PM}"
    ws["F5"] = "Workstream Lead: Tech Lead / Backend / Frontend"
    ws["F6"] = f"Updated by: {PM}"
    ws["F7"] = "Updated on: 10/07/2026"

    actions = [
        (13, 1, START, "Kick-off", "Khởi tạo dự án", "Chốt phạm vi dự án", "Thống nhất mục tiêu, milestone và người phụ trách.", "Completed", START + timedelta(days=2), START + timedelta(days=2), PM, "Hoàn thành"),
        (14, 2, START + timedelta(days=5), "Workshop", "Phân tích", "Đặc tả nghiệp vụ", "Hoàn thiện user flow đặt vé, chọn ghế, thanh toán và admin.", "Completed", START + timedelta(days=14), START + timedelta(days=14), "BA", "Đã chốt backlog"),
        (15, 3, START + timedelta(days=12), "Technical", "Thiết kế", "Thiết kế kiến trúc", "Chốt React/Vite, Express, MySQL/Firebase, PayOS.", "Completed", START + timedelta(days=18), START + timedelta(days=18), "Tech Lead", "Đã có thiết kế"),
        (16, 4, START + timedelta(days=20), "Development", "Frontend", "Hoàn thiện UI người dùng", "Trang phim, chi tiết phim, suất chiếu, chọn ghế, checkout.", "In Progress", START + timedelta(days=56), START + timedelta(days=60), "Frontend", "Đang triển khai"),
        (17, 5, START + timedelta(days=24), "Development", "Backend", "API booking/payment", "Booking, seat hold, PayOS webhook, bill và ticket.", "In Progress", START + timedelta(days=76), START + timedelta(days=80), "Backend", "Cần kiểm thử webhook"),
        (18, 6, START + timedelta(days=68), "Development", "AI", "AI chat tư vấn phim", "Kết nối dịch vụ chat với dữ liệu phim/suất chiếu.", "Not Started", START + timedelta(days=84), "", "AI/Backend", "Chờ hoàn tất API lõi"),
        (19, 7, START + timedelta(days=98), "QA", "Kiểm thử", "Kiểm thử tích hợp", "Test toàn bộ luồng end-to-end và xử lý lỗi API ngoài.", "Not Started", START + timedelta(days=116), "", "QA", ""),
    ]
    for row, *values in actions:
        for col, value in enumerate(values, start=1):
            ws.cell(row, col).value = value
        for col in (2, 8, 9):
            ws.cell(row, col).number_format = "dd/mm/yyyy"
    add_status_validation(ws, "G13:G19")


def fill_master_planxxx():
    ws = wb["2. Master Planxxx"]
    ws["A2"] = f"TRIỂN KHAI DỰ ÁN {PROJECT.upper()}"
    workstreams = {
        17: "WORKSTREAM 1: Nền tảng & kiến trúc",
        23: "WORKSTREAM 2: Booking & thanh toán",
        29: "WORKSTREAM 3: AI chat & tích hợp dữ liệu",
        34: "WORKSTREAM 4: Admin, kiểm thử & bàn giao",
    }
    for row, title in workstreams.items():
        ws.cell(row, 1).value = title
    updates = {
        18: ("WS01.1", "Thiết kế kiến trúc frontend/backend/database", "Done", "Tech Lead"),
        19: ("WS01.2", "Cấu hình môi trường, auth, database migration", "In progress", "Backend"),
        20: ("WS01.3", "Chuẩn hóa API routes và middleware", "In progress", "Backend"),
        21: ("WS01.4", "Tối ưu giao diện nền tảng React/Vite", "Not start", "Frontend"),
        24: ("WS02.1", "Tạo luồng chọn phim, suất chiếu và ghế", "In progress", "Frontend"),
        25: ("WS02.2", "Tạo booking, giữ ghế và xuất vé", "In progress", "Backend"),
        26: ("WS02.3", "Tích hợp PayOS và webhook thanh toán", "Not start", "Backend"),
        27: ("WS02.4", "Kiểm thử thanh toán success/cancel", "Not start", "QA"),
        30: ("WS03.1", "Thiết kế dữ liệu hội thoại AI", "Not start", "AI/Backend"),
        31: ("WS03.2", "Tích hợp TMDB/Google Places khi có API key", "Not start", "Backend"),
        32: ("WS03.3", "Hoàn thiện ChatBox tư vấn phim", "Not start", "Frontend"),
        35: ("WS04.1", "Admin dashboard và quản lý dữ liệu", "Not start", "Frontend"),
        36: ("WS04.2", "Kiểm thử chức năng, tích hợp, UAT", "Not start", "QA"),
        37: ("WS04.3", "Tài liệu bàn giao và hướng dẫn vận hành", "Not start", "PM"),
    }
    for row, values in updates.items():
        for col, value in enumerate(values, start=1):
            ws.cell(row, col).value = value


fill_roadmap()
fill_charter()
fill_master_planxxx()
fill_price()
fill_master_plan()
fill_staff()
fill_tracking()

for ws in wb.worksheets:
    for row in ws.iter_rows():
        for cell in row:
            if isinstance(cell.value, str):
                cell.alignment = copy(cell.alignment)
                cell.alignment = Alignment(
                    horizontal=cell.alignment.horizontal,
                    vertical=cell.alignment.vertical or "center",
                    wrap_text=True,
                )

wb.save(OUTPUT)
print(OUTPUT.resolve())
