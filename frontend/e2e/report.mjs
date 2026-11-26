import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export default class MarkdownReporter {
  records = [];
  errors = [];
  onError(error) { this.errors.push(error.message); }
  onTestEnd(test, result) {
    const meta = test.annotations.find((item) => item.type === "case");
    this.records.push({ meta: meta ? JSON.parse(meta.description) : { id: test.title.split(" ")[0], title: test.title, steps: "Xem spec", expected: "Xem spec", files: test.location.file, preconditions: "Môi trường local QA" }, project: test.parent.project()?.name ?? "unknown", status: result.status, actual: test.annotations.filter((item) => ["actual", "skip"].includes(item.type)).map((item) => item.description).join("; "), errors: result.errors.map((error) => error.message).join("\n"), attachments: result.attachments, duration: result.duration });
  }
  async onEnd(result) {
    const details = JSON.parse(await readFile(new URL("./case-details.json", import.meta.url), "utf8"));
    const counts = { PASS: 0, FAIL: 0, BLOCKED: 0 };
    const rows = this.records.map((record) => {
      const status = record.status === "passed" ? "PASS" : record.status === "skipped" ? "BLOCKED" : "FAIL";
      counts[status] += 1; return { ...record, meta: { ...record.meta, ...details[record.meta.id] }, verdict: status };
    });
    let report = `# E2E TEST REPORT — VSC_BAPD\n\nNgày: ${new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "full", timeStyle: "short" }).format(new Date())}.\n\nKết quả: **${counts.PASS} PASS · ${counts.FAIL} FAIL · ${counts.BLOCKED} BLOCKED**, ${rows.length} lượt test; Playwright overall ${result.status}. Không suy rộng PASS cho tính năng chưa chạy.\n\nMôi trường: frontend ${process.env.E2E_NEXT_DEV === "1" ? "Next dev" : "Next production"} tại http://127.0.0.1:3101; API http://127.0.0.1:5100; MongoDB replica set loopback tạm, tên fstyle_e2e_<random>. Chromium desktop 1440×900 và mobile iPhone13 390×844 (emulation Chromium, không phải Safari thật). 1 worker, retries=0. Browser chặn request ra host ngoài localhost. Credentials QA tự sinh, .env không sửa.\n\nSePay nhận thông báo chuyển khoản thử với khóa QA; MoMo dùng cổng loopback. VNPay chỉ seed dữ liệu lịch sử để kiểm tra callback. Không chứng nhận cổng thanh toán thật. Không tạo giao dịch tiền thật. Database assertions đọc trực tiếp MongoDB tách biệt; không dùng persistence mock trong bộ E2E này.\n\nChạy lại: backend dependencies đã có; tại frontend chạy \`npm run test:e2e\`. Runner build backend, tạo replica set và dữ liệu QA, khởi động API và frontend trên cổng riêng, chạy hai project, rồi dừng tài nguyên tạm. Có thể đặt E2E_NEXT_DEV=1 để thử qua Next dev hoặc E2E_REUSE_BUILD=1 để dùng bản build QA cùng API. HTML report: [playwright-report/index.html](frontend/playwright-report/index.html); JSON: [e2e-results.json](frontend/e2e-results.json). Logs bootstrap/server: frontend/e2e/.runtime/*.log (chỉ dữ liệu QA).\n\n| Test ID | Scenario | Project | Status | Thời gian |\n|---|---|---|---|---|\n`;
    for (const row of rows) report += `| ${row.meta.id} | ${row.meta.title} | ${row.project} | **${row.verdict}** | ${row.duration}ms |\n`;
    const apiOnly = rows.filter((row) => row.meta.layer?.startsWith("API →")).length;
    report += `\nPhạm vi: ${new Set(rows.map((row) => row.meta.id)).size} scenario duy nhất chạy trong hai project. ${apiOnly} lượt API/DB không thao tác UI; các lượt còn lại dùng browser hoặc bị BLOCKED. Việc lặp API trong project mobile không chứng minh responsive của luồng đó. Mỗi case ghi riêng phạm vi bên dưới.\n`;
    try {
      const previous = JSON.parse(await readFile("e2e/.runtime/attempt-1-results.json", "utf8"));
      report += `\n## Lịch sử chạy và phân loại lỗi\n\nLần đầy đủ đầu: ${previous.stats.expected} PASS, ${previous.stats.unexpected} FAIL, ${previous.stats.skipped} BLOCKED. Giữ [report lần đầu](frontend/e2e/.runtime/attempt-1-report.md), [JSON lần đầu](frontend/e2e/.runtime/attempt-1-results.json) và ảnh/trace gốc. 18 lượt lỗi selector của bộ test (scope trùng màu/form, tên button/select/gallery không đúng); 2 lượt SMART-002 phát hiện API detail thiếu audiences. Đã sửa DTO detail và bổ sung backend regression trước khi chạy lại. Lỗi khai báo fixture ở bước khởi tạo suite cũng đã sửa, không tính là PASS. Kết quả bảng trên chỉ là lần chạy hiện tại.\n`;
    } catch { /* First complete run has no history artifact yet. */ }
    try {
      const previous = JSON.parse(await readFile("e2e/.runtime/attempt-2-results.json", "utf8"));
      report += `\nLần 2: ${previous.stats.expected} PASS, ${previous.stats.unexpected} FAIL, ${previous.stats.skipped} BLOCKED. Lỗi còn lại thuộc suite: route-announcer trùng role alert; filter chưa mở details; chưa đợi sản phẩm mới mount; đếm sai class card; sort bị fixture sản phẩm chưa mở bán từ project trước tác động. Đã sửa cách scope/chờ/filter fixture, giữ [report lần2](frontend/e2e/.runtime/attempt-2-report.md) và [JSON lần2](frontend/e2e/.runtime/attempt-2-results.json). Không sửa assertion để bỏ qua lỗi ứng dụng.\n`;
    } catch { /* Second run history is optional. */ }
    try {
      const previous = JSON.parse(await readFile("e2e/.runtime/attempt-4-results.json", "utf8"));
      report += `\nLượt4 của đợt kiểm thử trước (không phải source của bảng hiện tại): ${previous.stats.expected} PASS, ${previous.stats.unexpected} FAIL, ${previous.stats.skipped} BLOCKED. Một ca mobile sort còn giả định mọi sản phẩm có giá; fixture Admin đã tạo sản phẩm chưa mở bán (price fallback0). Đã nêu rõ precondition hàng còn kho và kiểm tra loại fixture chưa mở bán trước khi kiểm tra sort/pagination. [Report lượt4](frontend/e2e/.runtime/attempt-4-report.md), [JSON lượt4](frontend/e2e/.runtime/attempt-4-results.json). Lượt3 dừng sau4 ca, không có kết luận suite: [log gián đoạn](frontend/e2e/.runtime/attempt-3-interrupted.log).\n`;
    } catch { /* Fourth run history is optional. */ }
    for (const row of rows) {
      report += `\n## ${row.meta.id} — ${row.project} — ${row.verdict}\n\n- Test Scenario: ${row.meta.title}\n- Preconditions: ${row.meta.preconditions}\n- Test Steps: ${row.meta.steps}\n- Expected Result: ${row.meta.expected}\n- Actual Result: ${row.verdict === "PASS" ? (row.actual || `Đã chạy các assertion của kịch bản và không phát hiện sai lệch: ${row.meta.expected}`) : row.errors || row.actual || "Không thực thi; xem lý do BLOCKED trong spec."}\n- File liên quan: ${Array.isArray(row.meta.files) ? row.meta.files.join(", ") : row.meta.files}\n- Root Cause: ${row.verdict === "FAIL" ? "Chưa kết luận tự động; cần đối chiếu error/trace với source. Không tự đổi lỗi test thành PASS." : row.verdict === "BLOCKED" ? "Thiếu môi trường/thông tin provider được phép dùng; không gọi production." : "Không phát hiện lỗi trong phạm vi assertion đã chạy."}\n`;
      for (const attachment of row.attachments) if (attachment.path) report += `- Evidence ${attachment.name}: [${path.basename(attachment.path)}](${path.resolve(attachment.path).replaceAll("\\", "/")})\n`;
      if (row.meta.layer) report += `- Phạm vi đã chạy: ${row.meta.layer}.\n`;
      if (row.meta.id === "SMART-002") report += "- Root Cause đã xác định ở lần đầu: API getProductById thiếu audiences trong DTO; đã đồng bộ với API list và thêm regression backend. Kết quả hiện tại nằm ở status của test này.\n";
    }
    if (this.errors.length) report += `\n## Runner errors\n\n${this.errors.join("\n\n")}\n`;
    report += "\n## Giới hạn\n\nPASS chỉ áp dụng assertions được liệt kê. Chưa kiểm định SMTP/Google thật, tải lớn, mọi trình duyệt, mọi kích thước hoặc độ chính xác stylist. Nghiệp vụ khuyến mại combo/hoàn tiền đầy đủ và các nhánh ngoài assertions phải được đánh giá riêng. Xem FIX_REPORT.md cho danh sách tồn tại sau audit.\n";
    const target = process.env.E2E_TEST_MATCH ? "e2e/.runtime/targeted-report.md" : "../E2E_TEST_REPORT.md";
    await writeFile(path.resolve(target), report);
  }
}
