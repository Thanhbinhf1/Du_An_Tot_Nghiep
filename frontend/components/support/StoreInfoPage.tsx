"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

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
    intro: "Thông tin giao hàng áp dụng cho luồng cửa hàng demo.",
    sections: [
      ["Thời gian giao hàng", "Đơn hàng demo hiển thị trạng thái ngay trên trang theo dõi. Thời gian giao hàng thật cần được xác nhận khi kết nối đơn vị vận chuyển."],
      ["Phí giao hàng", "Giao hàng được minh họa miễn phí. Mức phí thật sẽ được tính theo địa chỉ và chính sách cửa hàng."],
      ["Nhận tại cửa hàng", "Bạn có thể chọn cửa hàng nhận hàng trong trang thanh toán. Đây là lựa chọn mô phỏng."],
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
    intro: "Phiên bản này là giao diện demo; dữ liệu mẫu được lưu cục bộ trên trình duyệt.",
    sections: [
      ["Dữ liệu demo", "Thông tin đăng nhập, giỏ hàng, yêu thích và đơn hàng demo được lưu trong bộ nhớ trình duyệt của thiết bị hiện tại."],
      ["Không gửi dữ liệu", "Các biểu mẫu demo không gửi thông tin tới máy chủ hoặc bên thứ ba."],
      ["Xóa dữ liệu", "Bạn có thể xóa dữ liệu demo bằng cách xóa dữ liệu trang web trong cài đặt trình duyệt."],
    ],
  },
  terms: {
    title: "Điều khoản sử dụng",
    intro: "Website hiện là bản trình diễn frontend phục vụ mục đích phát triển và kiểm thử.",
    sections: [
      ["Thông tin sản phẩm", "Giá, mô tả, tình trạng hàng và hình ảnh có thể là dữ liệu minh họa."],
      ["Đơn hàng demo", "Việc đặt hàng trên website không tạo đơn hàng mua bán thật và không phát sinh thanh toán."],
      ["Liên hệ", "Nếu cần hỗ trợ, vui lòng sử dụng biểu mẫu tại trang Liên hệ."],
    ],
  },
};

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

export function ContactPage() {
  const [sent, setSent] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
    event.currentTarget.reset();
  }
  return (
    <section className="info-page">
      <div className="breadcrumb"><Link href="/">Trang chủ</Link> / Liên hệ</div>
      <h1>Liên hệ hỗ trợ</h1><p className="info-intro">Gửi câu hỏi cho nhóm chăm sóc khách hàng demo.</p>
      <form className="settings-card contact-form" onSubmit={submit}>
        <label className="form-field">Họ và tên<input autoComplete="name" required /></label>
        <label className="form-field">Email<input type="email" autoComplete="email" required /></label>
        <label className="form-field">Chủ đề<select defaultValue="don-hang"><option value="don-hang">Đơn hàng</option><option value="san-pham">Sản phẩm</option><option value="doi-tra">Đổi trả</option><option value="khac">Khác</option></select></label>
        <label className="form-field">Nội dung<textarea rows={5} required /></label>
        <button className="pill-button dark" type="submit">Gửi yêu cầu</button>
        {sent && <p role="status" className="settings-success">Yêu cầu demo đã được ghi nhận trên trang này; chưa gửi tới máy chủ.</p>}
      </form>
    </section>
  );
}
