import hashlib
from pathlib import Path
from zipfile import ZipFile

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


REF = Path("outputs/artifact_work/Example Report.docx")
SRS = Path("outputs/completed/SRS_DatVePhimAI_v2.1_CapNhatTheoHeThong.docx")
OUT = Path("outputs/completed/Example-Report-Completed-CineX.docx")
EXPECTED_SHA = "ec2fe7d38b1a4c9dd59aa9de7de01d0b2f87609151d3c770947b2cdc3314fb7b"


def set_text(p, text):
    if p.runs:
        p.runs[0].text = text
        for r in p.runs[1:]:
            r.text = ""
    else:
        p.add_run(text)


def add_p(doc, text, style="normal"):
    p = doc.add_paragraph(style=style)
    p.add_run(text)
    return p


def add_bullets(doc, items):
    for item in items:
        try:
            add_p(doc, item, "List Bullet")
        except KeyError:
            add_p(doc, "• " + item)


def add_table(doc, headers, rows):
    table = doc.add_table(rows=1, cols=len(headers))
    try:
        table.style = "Table Grid"
    except KeyError:
        pass
    for cell, value in zip(table.rows[0].cells, headers):
        set_text(cell.paragraphs[0], value)
        for run in cell.paragraphs[0].runs:
            run.bold = True
    tr_pr = table.rows[0]._tr.get_or_add_trPr()
    tr_pr.append(OxmlElement("w:tblHeader"))
    for values in rows:
        cells = table.add_row().cells
        for cell, value in zip(cells, values):
            set_text(cell.paragraphs[0], str(value))
    doc.add_paragraph()
    return table


def add_figure(doc, image, caption):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(str(image), width=Inches(5.8))
    c = add_p(doc, caption)
    c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for r in c.runs:
        r.italic = True


assert hashlib.sha256(REF.read_bytes()).hexdigest() == EXPECTED_SHA
doc = Document(REF)

# Fill retained front matter without altering its layout system.
for idx in (1, 17):
    set_text(doc.paragraphs[idx], "HỌC VIỆN CÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG")
for idx in (7, 23):
    set_text(doc.paragraphs[idx], "Xây dựng hệ thống đặt vé xem phim trực tuyến tích hợp trợ lý CineX AI")
for idx in (15, 31):
    set_text(doc.paragraphs[idx], "Hà Nội – 2026")
set_text(doc.paragraphs[43], "Em xin chân thành cảm ơn Học viện Công nghệ Bưu chính Viễn thông và Khoa Công nghệ Thông tin đã tạo điều kiện để em thực hiện đề tài có tính ứng dụng thực tế về hệ thống đặt vé xem phim trực tuyến.")
set_text(doc.paragraphs[44], "Quá trình thực hiện giúp em vận dụng kiến thức phân tích yêu cầu, thiết kế cơ sở dữ liệu, phát triển giao diện React, xây dựng API Express, bảo mật JWT và tích hợp dịch vụ thanh toán PayOS.")
set_text(doc.paragraphs[45], "Em trân trọng cảm ơn giảng viên hướng dẫn đã góp ý về phạm vi, nghiệp vụ và phương pháp kiểm thử. Những định hướng đó giúp sản phẩm được hoàn thiện theo hướng có thể vận hành và mở rộng.")
set_text(doc.paragraphs[46], "Do giới hạn thời gian và môi trường đồ án, báo cáo khó tránh khỏi thiếu sót. Em mong nhận được góp ý để tiếp tục nâng cao chất lượng sản phẩm.")
set_text(doc.paragraphs[47], "Em xin chân thành cảm ơn!")
set_text(doc.paragraphs[53], "Em cam đoan đề tài “Xây dựng hệ thống đặt vé xem phim trực tuyến tích hợp trợ lý CineX AI” là kết quả nghiên cứu và triển khai của cá nhân, dựa trên mã nguồn và tài liệu được nêu rõ trong báo cáo.")
set_text(doc.paragraphs[54], "Các kết quả, mô tả và kiểm thử được trình bày trung thực; tài liệu tham khảo được ghi nguồn và không sử dụng dữ liệu nhạy cảm của người dùng thật.")
set_text(doc.paragraphs[55], "Em chịu trách nhiệm về nội dung báo cáo và sẵn sàng hiệu chỉnh khi nhận được góp ý chuyên môn.")

# Remove the sample grading-system body while preserving front matter, sections and final sectPr.
marker = next(p for p in doc.paragraphs if p.text.strip() == "LỜI MỞ ĐẦU")
body = doc._body._element
children = list(body)
start = children.index(marker._p)
for element in children[start + 1:]:
    if element.tag != qn("w:sectPr"):
        body.remove(element)
set_text(marker, "LỜI MỞ ĐẦU")
marker.style = "Heading 1"

# Extract the supplied SRS diagrams for reuse.
media_dir = Path("outputs/artifact_work/report_media")
media_dir.mkdir(parents=True, exist_ok=True)
srs_doc = Document(SRS)
images = []
for i, shape in enumerate(list(srs_doc.inline_shapes)[:5], 1):
    rid = shape._inline.graphic.graphicData.pic.blipFill.blip.embed
    part = srs_doc.part.related_parts[rid]
    ext = Path(part.partname).suffix or ".png"
    path = media_dir / f"srs-figure-{i}{ext}"
    path.write_bytes(part.blob)
    images.append(path)

add_p(doc, "Chuyển đổi số trong lĩnh vực giải trí làm thay đổi cách khách hàng tìm phim, chọn rạp và thanh toán. Một hệ thống đặt vé hiệu quả phải xử lý đồng thời trải nghiệm người dùng, tính nhất quán ghế, thời hạn thanh toán và khả năng vận hành của rạp.")
add_p(doc, "Đề tài CineX xây dựng ứng dụng web full-stack cho phép tra cứu phim và suất chiếu, chọn ghế, giữ ghế, mua bắp nước, thanh toán qua PayOS và nhận vé QR. Trợ lý CineX AI hỗ trợ hội thoại từng bước, nhưng mọi thao tác nghiệp vụ quan trọng vẫn được xác thực ở backend.")
add_p(doc, "Báo cáo gồm ba chương: tổng quan và công nghệ; phân tích, thiết kế hệ thống; triển khai, kiểm thử và đánh giá. Nội dung được đối chiếu với mã nguồn tại thời điểm 13/07/2026.")

doc.add_heading("CHƯƠNG 1: TỔNG QUAN VỀ HỆ THỐNG CINE X", level=1)
doc.add_heading("1.1. Bối cảnh và bài toán", level=2)
add_p(doc, "Quy trình mua vé truyền thống yêu cầu khách đến quầy, chờ nhân viên kiểm tra lịch và ghế. Các website đặt vé đơn giản lại dễ phát sinh xung đột khi nhiều người chọn cùng một ghế, trạng thái thanh toán cập nhật chậm hoặc giá bị tin trực tiếp từ trình duyệt.")
add_p(doc, "CineX giải quyết bài toán bằng cơ chế giữ ghế có thời hạn, transaction cơ sở dữ liệu, bảng booking-seat, thanh toán PayOS có webhook xác minh và vé điện tử. Hệ thống đồng thời cung cấp khu vực quản trị cho phim, rạp, suất chiếu, người dùng, khuyến mãi và bắp nước.")
doc.add_heading("1.2. Mục tiêu", level=2)
add_bullets(doc, [
    "Hoàn thiện luồng từ xem phim đến nhận vé QR trên một giao diện responsive.",
    "Ngăn đặt trùng ghế và tự giải phóng tài nguyên khi hết thời gian giữ/thanh toán.",
    "Không tin giá do client gửi; tính lại vé, bắp nước và phí dịch vụ ở server.",
    "Tách quyền user, staff và admin; hỗ trợ đăng nhập email/password và Firebase social login.",
    "Cung cấp trợ lý hội thoại CineX AI và luồng giao diện thường làm phương án dự phòng.",
])
doc.add_heading("1.3. Phạm vi và giới hạn", level=2)
add_table(doc, ["Trong phạm vi", "Ngoài phạm vi/điều kiện"], [
    ["Phim, rạp, suất, ghế, booking, PayOS, QR, khuyến mãi, bắp nước, admin, CineX AI", "Hạ tầng rạp vật lý, kế toán/CRM, hoàn tiền tự động sau khi vé đã xác nhận"],
    ["MySQL local và migrations", "Triển khai production đa vùng, SLA thương mại"],
    ["TMDB/Google Places/Firebase có tích hợp", "Phụ thuộc DNS, billing và khóa API hợp lệ"],
])
doc.add_heading("1.4. Công nghệ sử dụng", level=2)
add_table(doc, ["Lớp", "Công nghệ", "Vai trò"], [
    ["Frontend", "React 19, Vite 8, Tailwind CSS", "SPA, routing, responsive UI, trang user/admin"],
    ["Backend", "Node.js, Express 5", "REST API, middleware, nghiệp vụ booking/payment"],
    ["Dữ liệu", "MySQL, Firebase Auth", "Dữ liệu nghiệp vụ và xác thực social"],
    ["Thanh toán", "PayOS", "Checkout URL, QR, webhook và tra cứu trạng thái"],
    ["Tích hợp", "TMDB, Google Places", "Làm giàu dữ liệu phim và tìm rạp; có fallback"],
])
doc.add_heading("1.5. Kế hoạch thực hiện", level=2)
add_p(doc, "Dự án được chia thành các nhóm công việc: khảo sát/SRS; kiến trúc và dữ liệu; frontend/backend; booking và PayOS; trợ lý hội thoại; quản trị; kiểm thử, tài liệu và UAT. Kế hoạch chi tiết được quản lý trong Template-Technical và Calendar đi kèm.")

doc.add_page_break()
doc.add_heading("CHƯƠNG 2: PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG", level=1)
doc.add_heading("2.1. Tác nhân và yêu cầu chức năng", level=2)
add_table(doc, ["Tác nhân", "Chức năng chính"], [
    ["Khách/User", "Xem phim, lọc lịch chiếu, chọn/giữ ghế, bắp nước, PayOS, lịch sử vé, CineX AI"],
    ["Staff", "Hỗ trợ booking, xác minh/sử dụng ticket, vận hành suất chiếu theo quyền"],
    ["Admin", "CRUD phim, rạp, suất, khuyến mãi, người dùng, bắp nước; dashboard và cấu hình lịch"],
    ["PayOS", "Tạo phiên thanh toán và gửi webhook đã ký"],
])
if len(images) >= 2:
    add_figure(doc, images[1], "Hình 2.1 – Sơ đồ use case tổng quát của hệ thống")
doc.add_heading("2.2. Kiến trúc tổng thể", level=2)
add_p(doc, "Kiến trúc ba lớp gồm SPA React, Express REST API và MySQL. Frontend gọi API qua lớp api.js; backend định tuyến theo miền nghiệp vụ, áp dụng authenticate/authorize trước controller, sau đó service/model thực hiện transaction và truy vấn tham số hóa.")
add_bullets(doc, [
    "Public API: phim, rạp, suất chiếu, khuyến mãi và chat tùy chọn xác thực.",
    "Protected API: hồ sơ, giữ ghế, booking, payment, lịch sử và hội thoại.",
    "Privileged API: quản trị, ticket verify/use và cấu hình hệ thống.",
])
doc.add_heading("2.3. Thiết kế dữ liệu", level=2)
if images:
    add_figure(doc, images[0], "Hình 2.2 – Sơ đồ quan hệ dữ liệu nghiệp vụ cốt lõi")
add_table(doc, ["Nhóm bảng", "Bảng tiêu biểu", "Mục đích"], [
    ["Danh mục", "movies, cinemas, screens, showtimes, seats", "Dữ liệu phim và lịch chiếu"],
    ["Giao dịch", "seat_holds, seat_hold_seats, bookings, booking_seats", "Khóa ghế, đơn hàng và giá tại thời điểm đặt"],
    ["Thanh toán", "bills, payments, payment_webhook_logs", "Theo dõi vòng đời và chống xử lý lặp"],
    ["Vé", "tickets", "Mã vé, QR, trạng thái sử dụng"],
    ["Bảo mật", "refresh_tokens, token_blacklist", "Rotation và thu hồi JWT"],
    ["Mở rộng", "concessions, promotions, app_settings, conversations", "Bắp nước, ưu đãi, cấu hình và hội thoại"],
])
doc.add_heading("2.4. Luồng giữ ghế và đặt vé", level=2)
add_p(doc, "Khi người dùng chọn ghế, backend kiểm tra ghế tồn tại, không is_booked, không bị hold ACTIVE của người khác và không xuất hiện trong booking còn hiệu lực. Seat hold có mã riêng và thời hạn; booking được tạo từ hold trong transaction với trạng thái PENDING_PAYMENT.")
add_table(doc, ["Trạng thái", "Ý nghĩa", "Chuyển tiếp"], [
    ["ACTIVE", "Ghế đang được giữ", "CONVERTED, EXPIRED, RELEASED"],
    ["PENDING_PAYMENT", "Booking/bill chờ thanh toán", "CONFIRMED, CANCELLED, EXPIRED"],
    ["CONFIRMED", "Webhook hợp lệ, đã phát hành vé", "Ticket USED khi check-in"],
])
if len(images) >= 4:
    add_figure(doc, images[3], "Hình 2.3 – Sơ đồ chuyển trạng thái booking")
doc.add_heading("2.5. Luồng thanh toán PayOS", level=2)
add_p(doc, "PaymentService tạo order code, checkout URL và QR từ bill đã được server tính. WebhookService xác minh chữ ký PayOS, kiểm tra order code, amount, giao dịch trùng và trạng thái hiện tại trước khi gọi transaction xác nhận thanh toán.")
add_bullets(doc, [
    "Webhook không hợp lệ được ghi log INVALID_SIGNATURE/FAILED.",
    "Webhook hợp lệ nhưng lặp lại được đánh dấu DUPLICATE và không phát hành vé lần hai.",
    "Khi thành công, payment/bill = PAID, booking = CONFIRMED, booking_seats = BOOKED và ticket được tạo.",
    "Frontend nhận cập nhật qua polling hoặc SSE và hiển thị trang thành công/hủy.",
])
doc.add_heading("2.6. CineX AI", level=2)
add_p(doc, "Trợ lý hiện tại triển khai hội thoại trạng thái thay vì phụ thuộc hoàn toàn vào LLM. Conversation lưu bước chọn phim, khu vực, rạp, ngày, suất, ghế và thanh toán. Các handler truy vấn dữ liệu thật, chuẩn hóa phản hồi và đưa ra suggestedActions.")
if len(images) >= 3:
    add_figure(doc, images[2], "Hình 2.4 – Luồng đặt vé qua CineX AI")
doc.add_heading("2.7. Bảo mật và toàn vẹn", level=2)
add_bullets(doc, [
    "Mật khẩu băm bằng bcrypt; đăng nhập có JWT access 15 phút và refresh 7 ngày.",
    "Refresh token lưu hash, quay vòng khi sử dụng; access token có JTI và blacklist khi đăng xuất.",
    "RBAC được áp dụng tại route; dữ liệu booking/bill kiểm tra quyền sở hữu.",
    "SQL dùng tham số; transaction và khóa FOR UPDATE cho các đoạn cạnh tranh.",
    "Giá bắp nước và tổng tiền lấy từ database/cấu hình server, không lấy từ payload client.",
])

doc.add_page_break()
doc.add_heading("CHƯƠNG 3: CÀI ĐẶT VÀ KIỂM THỬ HỆ THỐNG", level=1)
doc.add_heading("3.1. Cấu trúc triển khai", level=2)
add_table(doc, ["Thư mục", "Nội dung"], [
    ["src/pages, src/components", "Trang người dùng, checkout, profile, thanh toán và khu vực admin"],
    ["src/lib", "API client, Firebase và context dùng chung"],
    ["server/routes/controllers", "REST endpoints và điều phối request/response"],
    ["server/services/models", "Nghiệp vụ, transaction, webhook, scheduler và truy cập dữ liệu"],
    ["server/database", "Schema, seed và migrations"],
    ["tests", "Kiểm thử tự động bằng Node test runner"],
])
doc.add_heading("3.2. Giao diện người dùng và quản trị", level=2)
add_p(doc, "Giao diện người dùng có Home, Movies, MovieDetail, Showtimes, SeatSelection, Checkout, Profile, Promotions và các trang kết quả PayOS. Khu vực admin tách layout và các trang Movies, Showtimes, Bookings, Promotions, Cinemas, Users và Concessions.")
add_p(doc, "Các danh sách lớn dùng phân trang; checkout hiển thị ghế, bắp nước, phí, tổng tiền, QR và nút mở PayOS. Trạng thái lỗi/hết hạn được phản hồi rõ ràng, đồng thời giải phóng hold khi người dùng rời luồng phù hợp.")
doc.add_heading("3.3. Backend và API", level=2)
add_table(doc, ["Nhóm API", "Endpoint tiêu biểu", "Bảo vệ"], [
    ["Booking v1", "POST /api/v1/seat-holds; POST /api/v1/bookings", "JWT user"],
    ["Payment v1", "POST /api/v1/payments/payos; GET status/stream", "JWT user"],
    ["Webhook", "POST /api/v1/webhooks/payos", "Chữ ký PayOS"],
    ["Ticket", "POST /api/tickets/verify; /:code/use", "admin/staff"],
    ["Admin", "/api/admin, /api/users, /api/roles", "admin"],
    ["Chat", "POST /api/ai/chat", "optional auth"],
])
doc.add_heading("3.4. Kiểm thử", level=2)
add_p(doc, "Tại thời điểm cập nhật, bộ kiểm thử tự động tập trung vào ranh giới tin cậy của tổng tiền. Kết quả chạy ngày 13/07/2026: 3 bài kiểm thử, 3 đạt, 0 lỗi.")
add_table(doc, ["Mã", "Kịch bản", "Kết quả"], [
    ["T01", "Bắp rang 45.000đ cộng vào bill và phí dịch vụ đúng", "Đạt"],
    ["T02", "Client gửi price=1 nhưng server vẫn dùng giá cấu hình", "Đạt"],
    ["T03", "Loại sản phẩm lạ bị loại; số lượng được giới hạn", "Đạt"],
])
add_p(doc, "Các kịch bản cần bổ sung gồm cạnh tranh giữ cùng ghế, timeout booking, webhook trùng/sai chữ ký/sai số tiền, rotation refresh token, phân quyền admin và kiểm thử end-to-end với PayOS sandbox.")
doc.add_heading("3.5. Đánh giá kết quả", level=2)
add_bullets(doc, [
    "Luồng cốt lõi từ phim đến vé QR đã có đủ thành phần frontend, backend và dữ liệu.",
    "Cơ chế transaction, giữ ghế và webhook giúp giảm rủi ro sai lệch trạng thái.",
    "Hệ thống vẫn phụ thuộc cấu hình ngoài; cần CI, logging tập trung và test tích hợp trước production.",
    "Màn hình check-in và giám sát CineX AI có backend nền tảng nhưng còn cần hoàn thiện trải nghiệm vận hành.",
])

doc.add_heading("KẾT LUẬN", level=1)
add_p(doc, "Đề tài đã xây dựng được hệ thống CineX theo kiến trúc full-stack, bao phủ tra cứu phim, suất chiếu, giữ ghế, booking, PayOS, vé QR, bắp nước, quản trị và trợ lý hội thoại. Điểm quan trọng của giải pháp là đặt toàn bộ quyết định giá và trạng thái giao dịch ở backend.")
add_p(doc, "Hướng phát triển tiếp theo là tăng độ phủ kiểm thử, hoàn thiện check-in trên thiết bị di động, báo cáo doanh thu nâng cao, giám sát hội thoại, hoàn tiền có kiểm soát và triển khai production với quan sát hệ thống đầy đủ.")
doc.add_heading("TÀI LIỆU THAM KHẢO", level=1)
for ref in [
    "React Documentation — https://react.dev/",
    "Vite Documentation — https://vite.dev/",
    "Express Documentation — https://expressjs.com/",
    "MySQL 8.0 Reference Manual — https://dev.mysql.com/doc/",
    "Firebase Authentication — https://firebase.google.com/docs/auth",
    "PayOS Documentation — https://payos.vn/docs/",
    "TMDB API Documentation — https://developer.themoviedb.org/docs",
    "Google Places API — https://developers.google.com/maps/documentation/places/web-service",
]:
    add_p(doc, ref)

doc.core_properties.title = "Báo cáo bài tập lớn – AI Book Movie Tickets / CineX"
doc.core_properties.author = "Hoàng Văn Chung"
settings = doc.settings._element
if settings.find(qn("w:updateFields")) is None:
    update = OxmlElement("w:updateFields")
    update.set(qn("w:val"), "true")
    settings.append(update)

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUT)

# Fill cover text-box slots by stable XML text-node positions while preserving run formatting.
with ZipFile(OUT) as zin:
    package = {item.filename: zin.read(item.filename) for item in zin.infolist()}
from xml.etree import ElementTree as ET
from copy import deepcopy
root = ET.fromstring(package["word/document.xml"])
text_nodes = [node for node in root.iter() if node.tag.endswith("}t")]
cover_values = {
    6: ": ........................................", 8: ": Học viện Công nghệ Bưu chính Viễn thông",
    10: ": Công nghệ thông tin", 12: ": D24TX", 14: ": Hoàng Văn Chung", 16: ": Chưa cung cấp",
    29: ": ........................................", 31: ": Học viện Công nghệ Bưu chính Viễn thông",
    33: ": Công nghệ thông tin", 35: ": D24TX", 37: ": Hoàng Văn Chung", 39: ": Chưa cung cấp",
}
for index, value in cover_values.items():
    if index < len(text_nodes):
        text_nodes[index].text = value

# Restore the fourth source section by placing a source-derived section break before Chapter 2.
with ZipFile(REF) as ref_zip:
    ref_root = ET.fromstring(ref_zip.read("word/document.xml"))
ref_sects = [node for node in ref_root.iter() if node.tag == qn("w:sectPr")]
final_sects = [node for node in root.iter() if node.tag == qn("w:sectPr")]
if len(final_sects) < len(ref_sects):
    for paragraph in root.iter(qn("w:p")):
        text = "".join(node.text or "" for node in paragraph.iter(qn("w:t")))
        if text == "CHƯƠNG 2: PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG":
            ppr = paragraph.find(qn("w:pPr"))
            if ppr is None:
                ppr = ET.Element(qn("w:pPr"))
                paragraph.insert(0, ppr)
            ppr.append(deepcopy(ref_sects[-2]))
            break
package["word/document.xml"] = ET.tostring(root, encoding="utf-8", xml_declaration=True)
with ZipFile(OUT, "w") as zout:
    for name, payload in package.items():
        zout.writestr(name, payload)

print(OUT)
