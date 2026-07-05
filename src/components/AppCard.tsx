import { useState, useRef, useEffect } from "react";
import { MoreVertical, Edit2, Trash2, X, Check } from "lucide-react";
import type { AppItem } from "@/types";
import { useAppStore, useUserStore } from "@/store";

interface Props {
  app: AppItem;
  onDelete: (app: AppItem) => void;
}

export default function AppCard({ app, onDelete }: Props) {
  const { startView } = useAppStore();
  const user = useUserStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editTitle, setEditTitle] = useState(app.title);
  const [editDesc, setEditDesc] = useState(app.description);
  const [editIndexPath, setEditIndexPath] = useState(app.indexPath);
  const [editThumbnail, setEditThumbnail] = useState(app.thumbnail);
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen && !deleteConfirm) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setDeleteConfirm(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen, deleteConfirm]);

  const thumbSrc =
    app.thumbnail && app.thumbnail.startsWith("http") ? app.thumbnail : null;

  const handleEdit = () => {
    setMenuOpen(false);
    setEditTitle(app.title);
    setEditDesc(app.description);
    setEditIndexPath(app.indexPath);
    setEditThumbnail(app.thumbnail);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      const { supabase } = await import("@/supabase");
      const { error } = await supabase
        .from("n3d_app_items")
        .update({
          title: editTitle.trim(),
          description: editDesc?.trim() || "",
          index_path: editIndexPath.trim() || app.indexPath,
          thumbnail: editThumbnail.trim() || app.thumbnail,
          updated_at: new Date().toISOString(),
        })
        .eq("id", app._id);

      if (!error) {
        const { updateApp } = useAppStore.getState();
        updateApp(app._id, {
          title: editTitle.trim(),
          description: editDesc?.trim() || "",
          indexPath: editIndexPath.trim() || app.indexPath,
          thumbnail: editThumbnail.trim() || app.thumbnail,
        });
        setEditOpen(false);
      }
    } catch (e) {
      console.error("保存失败:", e);
    }
    setSaving(false);
  };

  const handleDeleteClick = () => {
    setMenuOpen(false);
    setDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    setDeleteConfirm(false);
    onDelete(app);
  };

  return (
    <>
      <div className="group relative overflow-hidden rounded-xl bg-[#1a1f3a] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(0,212,255,0.3)]">
        {user?.isAdmin && (
          <div ref={menuRef} className="absolute right-2 top-2 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white/70 opacity-0 transition-all hover:bg-black/60 hover:text-white group-hover:opacity-100"
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 w-40 overflow-hidden rounded-lg bg-[#0d1137] py-1 shadow-lg ring-1 ring-white/10">
                <button
                  onClick={handleEdit}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-300 transition-colors hover:bg-white/10"
                >
                  <Edit2 size={12} />
                  编辑
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                >
                  <Trash2 size={12} />
                  删除
                </button>
              </div>
            )}

            {deleteConfirm && (
              <div className="absolute right-0 top-9 w-44 rounded-lg bg-[#0d1137] p-3 shadow-lg ring-1 ring-white/10">
                <p className="mb-2 text-xs text-gray-300">
                  确定删除「{app.title}」？将同步删除所有评论。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirmDelete}
                    className="flex-1 rounded bg-red-500/20 px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/30"
                  >
                    删除
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="flex-1 rounded bg-white/10 px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-white/20"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <button onClick={() => startView(app)} className="w-full text-left">
          <div className="aspect-video w-full overflow-hidden bg-[#0a0e27]">
            {thumbSrc ? (
              <img
                src={thumbSrc}
                alt={app.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-2xl text-[#00d4ff]/30">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
            )}
          </div>

          <div className="p-3 text-left">
            <h3 className="text-sm font-medium text-white transition-colors group-hover:text-[#00d4ff]">
              {app.title}
            </h3>
            {app.description && (
              <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">
                {app.description}
              </p>
            )}
          </div>
        </button>
      </div>

      {editOpen && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditOpen(false);
          }}
        >
          <div className="w-80 rounded-xl bg-[#151b3d] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">编辑信息</h3>
              <button
                onClick={() => setEditOpen(false)}
                className="rounded p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <label className="mb-1 block text-xs text-gray-400">名称</label>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#00d4ff]/50"
              placeholder="模型名称"
            />

            <label className="mb-1 block text-xs text-gray-400">详细信息</label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={2}
              className="mb-3 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#00d4ff]/50"
              placeholder="模型描述"
            />

            <label className="mb-1 block text-xs text-gray-400">
              3D 链接 URL
            </label>
            <input
              value={editIndexPath}
              onChange={(e) => setEditIndexPath(e.target.value)}
              className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#00d4ff]/50"
              placeholder="https://..."
            />

            <label className="mb-1 block text-xs text-gray-400">
              缩略图 URL
            </label>
            <input
              value={editThumbnail}
              onChange={(e) => setEditThumbnail(e.target.value)}
              className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#00d4ff]/50"
              placeholder="https://..."
            />

            <button
              onClick={handleSave}
              disabled={saving || !editTitle.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#00d4ff] py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {saving ? (
                "保存中..."
              ) : (
                <>
                  <Check size={14} />
                  保存
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
