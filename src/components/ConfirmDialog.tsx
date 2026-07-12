/** 通用确认弹窗 */
export default function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-80 rounded-[10px] border-2 border-[var(--border-card)] bg-[var(--bg-card)] p-5 shadow-lg">
        <h3 className="text-base font-medium text-[var(--text-primary)]">
          {title}
        </h3>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-btn)]"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="rounded bg-[var(--bg-btn-hover)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-white/30"
          >
            {confirmLabel || "确认"}
          </button>
        </div>
      </div>
    </div>
  );
}
