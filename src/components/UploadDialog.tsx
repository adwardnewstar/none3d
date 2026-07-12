import { useState } from "react";
import { X, Check, Loader2, Link } from "lucide-react";
import { upsertAppRecord } from "@/filebase";
import { useUserStore } from "@/store";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function UploadDialog({ open, onClose, onDone }: Props) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const reset = () => {
    setTitle("");
    setUrl("");
    setErrorMsg("");
  };

  const handleSubmit = async () => {
    if (!title.trim() || !url.trim()) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setErrorMsg("请输入有效的 URL（以 http:// 或 https:// 开头）");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const currentUser = useUserStore.getState().user;
      if (!currentUser) {
        useUserStore.getState().setShowAuthModal(true);
        setSubmitting(false);
        return;
      }

      await upsertAppRecord(title.trim(), url.trim());
      reset();
      onDone();
    } catch (err: any) {
      setErrorMsg(err.message || "保存失败");
    }
    setSubmitting(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-[10px] border-2 border-[var(--border-card)] bg-[var(--bg-card)] p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            新增 3D 展示
          </h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-btn)] hover:text-white disabled:opacity-30"
          >
            <X size={16} />
          </button>
        </div>

        <label className="mb-1 block text-xs text-[var(--text-secondary)]">
          名称
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-4 w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-white/20"
          placeholder="例如：样板中心投影模型"
          disabled={submitting}
        />

        <label className="mb-1 block text-xs text-[var(--text-secondary)]">
          Verge3D 项目链接
        </label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="mb-4 w-full rounded-lg border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-white/20"
          placeholder="https://none3d.s3.filebase.io/projects/xxx/index.html"
          disabled={submitting}
        />
        <p className="-mt-3 mb-4 text-xs text-[var(--text-muted)]">
          将处理好的 Verge3D 项目上传到静态托管服务，粘贴可访问的链接
        </p>

        {errorMsg && <p className="mb-3 text-xs text-red-400">{errorMsg}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !url.trim()}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--bg-btn-hover)] py-2 text-sm font-medium text-[var(--text-primary)] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {submitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Link size={14} />
              新增
            </>
          )}
        </button>
      </div>
    </div>
  );
}
