"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { API_BASE_URL, readApiResponse } from "@/lib/api";
import { useDemoAuth } from "@/lib/demo-auth";
import { useStoreInfo } from "@/lib/useStoreInfo";

const content = {
  help: {
    title: "Trung tâm trợ giúp",
    intro: "Tìm câu trả lời nhanh về mua sắm, tài khoản, thanh toán và giao hàng.",
    sections: [
      ["Làm cách nào để đặt hàng?", "Chọn sản phẩm, kích cỡ, thêm vào giỏ hàng và tiếp tục tới trang thanh toán để nhập thông tin nhận hàng."],
      ["Tôi có thể theo dõi đơn hàng ở đâu?", "Mở mục Đơn hàng trong tài khoản hoặc dùng liên kết theo dõi trên trang xác nhận đơn hàng."],
      ["Làm sao để đổi hoặc trả sản phẩm?", "Tham khảo hướng dẫn và điều kiện đổi trả tại trang Đổi & Trả hàng."],
      ["Tôi có thể thay đổi thông tin giao hàng không?", "Cập nhật địa chỉ trong Sổ địa chỉ trước khi đặt hàng."],
    ],
  },
  shipping: {
    title: "Giao hàng",
    intro: "Đơn hàng được giao đến địa chỉ bạn chọn khi thanh toán.",
    sections: [
      ["Theo dõi giao hàng", "Xem trạng thái xử lý và giao hàng trong mục Đơn hàng của tôi."],
      ["Địa chỉ giao hàng", "Thêm hoặc cập nhật địa chỉ trong Sổ địa chỉ trước khi đặt hàng."],
    ],
  },
  returns: {
    title: "Đổi & Trả hàng",
    intro: "Hướng dẫn tham khảo cho khách hàng; điều kiện thực tế cần được cửa hàng xác nhận.",
    sections: [
      ["Điều kiện sản phẩm", "Sản phẩm cần còn nguyên nhãn mác, chưa qua sử dụng và có thông tin đơn hàng."],
      ["Yêu cầu hỗ trợ", "Liên hệ bộ phận hỗ trợ kèm mã đơn hàng để được hướng dẫn quy trình."],
      ["Hoàn tiền", "Phương thức và thời gian hoàn tiền phụ thuộc phương thức thanh toán và chính sách cửa hàng."],
    ],
  },
  privacy: {
    title: "Chính sách bảo mật",
    intro: "Thông tin tài khoản và dữ liệu mua hàng được lưu trong hệ thống cửa hàng.",
    sections: [
      ["Dữ liệu tài khoản", "Hệ thống lưu thông tin hồ sơ, địa chỉ nhận hàng, giỏ hàng và đơn hàng theo tài khoản."],
      ["Danh sách yêu thích", "Danh sách yêu thích đồng bộ theo tài khoản khi đăng nhập. Khách chưa đăng nhập lưu danh sách trên thiết bị hiện tại."],
      ["Thanh toán trực tuyến", "Khi bạn chọn một cổng thanh toán trực tuyến, hệ thống gửi thông tin giao dịch cần thiết đến cổng đó."],
    ],
  },
  terms: {
    title: "Điều khoản sử dụng",
    intro: "Thông tin về sản phẩm và quy trình đặt hàng tại cửa hàng.",
    sections: [
      ["Thông tin sản phẩm", "Giá và tình trạng hàng có thể khác nhau theo màu và kích cỡ. Hệ thống xác nhận lại khi đặt hàng."],
      ["Đơn hàng", "Khi đặt hàng thành công, bạn có thể xem chi tiết và phương thức thanh toán trong mục Đơn hàng của tôi."],
    ],
  },
};

function SupportDirectory() {
  const store = useStoreInfo();
  return (
    <aside className="support-directory" aria-label="Kênh hỗ trợ">
      <h2>Chăm sóc khách hàng</h2>
      {store?.hotline && <p><span>Điện thoại</span><a href={`tel:${store.hotline.replace(/[^\d+]/g, "")}`}>{store.hotline}</a></p>}
      {store?.email && <p><span>Email</span><a href={`mailto:${store.email}`}>{store.email}</a></p>}
      {store?.address && <p><span>Địa chỉ cửa hàng</span>{store.address}</p>}
      <Link href="/help">Câu hỏi thường gặp</Link>
    </aside>
  );
}

export function StoreInfoPage({ page }: { page: keyof typeof content }) {
  const data = content[page];
  return (
    <section className="info-page">
      <div className="breadcrumb"><Link href="/">Trang chủ</Link> / {data.title}</div>
      <h1>{data.title}</h1><p className="info-intro">{data.intro}</p>
      <div className="info-sections">{data.sections.map(([title, body]) => <article key={title}><h2>{title}</h2><p>{body}</p></article>)}</div>
      <div className="info-related"><Link href="/help">Trung tâm trợ giúp</Link><Link href="/contact">Liên hệ</Link><Link href="/shipping">Giao hàng</Link><Link href="/returns">Đổi & Trả hàng</Link></div>
    </section>
  );
}

export function ContactPage({ initialTopic = "don-hang" }: { initialTopic?: string }) {
  const { isHydrated } = useDemoAuth();
  const [ticketId, setTicketId] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    setSending(true);
    setError("");
    setTicketId("");
    try {
      const response = await fetch(`${API_BASE_URL}/contact`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const ticket = await readApiResponse<{ id: string }>(response);
      setTicketId(ticket.id);
      form.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gửi yêu cầu liên hệ.");
    } finally {
      setSending(false);
    }
  }
  return (
    <section className="info-page">
      <div className="breadcrumb"><Link href="/">Trang chủ</Link> / Liên hệ</div>
      <h1>Liên hệ hỗ trợ</h1><p className="info-intro">Gửi câu hỏi cho nhóm chăm sóc khách hàng.</p>
      <div className="support-contact-layout">
      <SupportDirectory />
      <form className="settings-card contact-form" method="post" onSubmit={submit}>
        <label className="form-field">Họ và tên<input name="name" autoComplete="name" maxLength={120} required /></label>
        <label className="form-field">Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
        <label className="form-field">Chủ đề<select name="topic" defaultValue={initialTopic}><option value="don-hang">Đơn hàng</option><option value="san-pham">Sản phẩm</option><option value="doi-tra">Đổi trả</option><option value="tai-khoan">Tài khoản</option><option value="khac">Khác</option></select></label>
        {initialTopic === "tai-khoan" && <p className="small muted">Ghi email đã đăng ký trong nội dung yêu cầu để cửa hàng kiểm tra và hướng dẫn khôi phục tài khoản.</p>}
        <label className="form-field">Nội dung<textarea name="message" rows={5} maxLength={3000} required /></label>
        <button className="pill-button dark" type="submit" disabled={!isHydrated || sending}>{sending ? "Đang gửi..." : "Gửi yêu cầu"}</button>
        {error && <p role="alert" className="form-error">{error}</p>}
        {ticketId && <p role="status" className="settings-success">Đã gửi yêu cầu. Mã liên hệ {ticketId}.</p>}
      </form>
      </div>
    </section>
  );
}
