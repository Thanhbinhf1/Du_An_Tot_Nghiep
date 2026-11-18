export const reviewReportReasons = {
  spam: "Quảng cáo hoặc nội dung rác",
  abuse: "Ngôn từ xúc phạm hoặc quấy rối",
  irrelevant: "Nội dung không liên quan đến sản phẩm",
  other: "Lý do khác",
};

export type ReviewReportReason = keyof typeof reviewReportReasons;
