type Props = {
  kind: "loading" | "empty" | "error" | "success";
  message: string;
  onRetry?: () => void;
};

export default function AdminFeedback({ kind, message, onRetry }: Props) {
  const role = kind === "error" ? "alert" : kind === "empty" ? undefined : "status";
  const className = kind === "error" ? "admin-alert" : kind === "success" ? "admin-success" : "admin-muted";

  return (
    <div className="admin-feedback">
      <p className={className} role={role}>{message}</p>
      {onRetry && <button type="button" onClick={onRetry}>Thử lại</button>}
    </div>
  );
}
