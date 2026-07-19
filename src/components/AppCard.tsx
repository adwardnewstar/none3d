import { useState, useRef, useEffect } from "react";
import { MoreVertical, Edit2, Trash2, X, Check } from "lucide-react";
import ImageCropper from "./ImageCropper";
import type { AppItem } from "@/types";
import { useAppStore, useUserStore } from "@/store";

const UPLOAD_PROXY_URL =
  "https://zwnluqynchoidpiittdp.supabase.co/functions/v1/upload-proxy";

interface Props {
  app: AppItem;
  onDelete: (app: AppItem) => void;
}

export default function AppCard({ app, onDelete }: Props) {
  const { startView } = useAppStore();
  const user = useUserStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hamburgerVisible, setHamburgerVisible] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editTitle, setEditTitle] = useState(app.title);
  const [editDesc, setEditDesc] = useState(app.description);
  const [editIndexPath, setEditIndexPath] = useState(app.indexPath);
  const [editThumbnail, setEditThumbnail] = useState(app.thumbnail);
  const [saving, setSaving] = useState(false);
  const [dotCount, setDotCount] = useState(0);

  // Crop UI state
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropFrame, setCropFrame] = useState({ x: 0, y: 0, size: 100 }); // x%, y%, size%
  const [cropDrag, setCropDrag] = useState<{
    type: "frame" | "tl" | "tr" | "bl" | "br";
    startX: number;
    startY: number;
    initFrame: { x: number; y: number; size: number };
  } | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverWrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const [shadowPos, setShadowPos] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipRect, setTooltipRect] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!saving) {
      setDotCount(0);
      return;
    }
    const timer = setInterval(() => {
      setDotCount((n) => (n >= 3 ? 1 : n + 1));
    }, 400);
    return () => clearInterval(timer);
  }, [saving]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen && !deleteConfirm && !hamburgerVisible) return;
    const close = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setHamburgerVisible(false);
        setMenuOpen(false);
        setDeleteConfirm(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen, deleteConfirm, hamburgerVisible]);

  // 跨卡片通信：其他卡片长按时关闭当前卡片的汉堡包和菜单
  useEffect(() => {
    const close = () => {
      setHamburgerVisible(false);
      setMenuOpen(false);
    };
    window.addEventListener("close-card-menus", close);
    return () => window.removeEventListener("close-card-menus", close);
  }, []);

  const thumbSrc =
    app.thumbnail && app.thumbnail.startsWith("http") ? app.thumbnail : null;

  const handleEdit = () => {
    setMenuOpen(false);
    setEditTitle(app.title);
    setEditDesc(app.description);
    setEditIndexPath(app.indexPath);
    setEditThumbnail(app.thumbnail);
    setCropImage(null);
    setCropFrame({ x: 0, y: 0, size: 100 });
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

  // 封面文件选择
  const handleCoverFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setCropFile(file);
    setCropZoom(1);
    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result as string);
      setCropFrame({ x: 0, y: 0, size: 100 });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    handleCoverFile(file);
  };

  // 裁剪交互 — 使用 document 级事件保证拖拽稳定
  const handleCropPointerDown = (
    type: "frame" | "tl" | "tr" | "bl" | "br",
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    setCropDrag({
      type,
      startX: e.clientX,
      startY: e.clientY,
      initFrame: { ...cropFrame },
    });
  };

  useEffect(() => {
    if (!cropDrag) return;
    const wrap = coverWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - cropDrag.startX;
      const dy = e.clientY - cropDrag.startY;
      const dPct = (dx / rect.width) * 100;
      const { x: ix, y: iy, size: is } = cropDrag.initFrame;

      if (cropDrag.type === "frame") {
        const dPctY = (dy / rect.height) * 100;
        setCropFrame({
          x: Math.max(0, Math.min(100 - is, ix + dPct)),
          y: Math.max(0, Math.min(100 - is, iy + dPctY)),
          size: is,
        });
      } else {
        let newSize: number;
        if (cropDrag.type === "br" || cropDrag.type === "tr") {
          newSize = Math.max(20, Math.min(100, is + dPct));
        } else {
          newSize = Math.max(20, Math.min(100, is - dPct));
        }
        let nx = ix,
          ny = iy;
        if (cropDrag.type === "tl") {
          nx = ix + is - newSize;
          ny = iy + is - newSize;
        } else if (cropDrag.type === "tr") {
          ny = iy + is - newSize;
        } else if (cropDrag.type === "bl") {
          nx = ix + is - newSize;
        }
        setCropFrame({
          x: Math.max(0, nx),
          y: Math.max(0, ny),
          size: newSize,
        });
      }
    };

    const onUp = () => setCropDrag(null);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [cropDrag]);

  // 确认裁剪 → 按框体位置裁剪 → 上传 → 保存
  const handleCropConfirm = async () => {
    if (!cropImage || !cropFile || !coverWrapRef.current) return;
    setSaving(true);

    // 按框体位置裁剪原图到 640×512（5:4 比例）
    const wrapEl = coverWrapRef.current;

    // 用 new Image 加载原图（不再依赖 DOM 中的 img 标签）
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = cropImage;
    });

    const wrapRect = wrapEl.getBoundingClientRect();
    const Cw = wrapRect.width;
    const Ch = wrapRect.height;
    const Iw = img.naturalWidth;
    const Ih = img.naturalHeight;
    const scale = Math.max(Cw / Iw, Ch / Ih);
    const rw = Iw * scale * cropZoom;
    const rh = Ih * scale * cropZoom;
    const imgLeft = (Cw - rw) / 2;
    const imgTop = (Ch - rh) / 2;

    // 框体在容器中的像素坐标
    const fxC = (cropFrame.x / 100) * Cw;
    const fyC = (cropFrame.y / 100) * Ch;
    const fwC = (cropFrame.size / 100) * Cw;
    const fhC = (cropFrame.size / 100) * Ch;

    // 映射到原图坐标（考虑 zoom 缩放）
    const totalScale = scale * cropZoom;
    const sx = (fxC - imgLeft) / totalScale;
    const sy = (fyC - imgTop) / totalScale;
    const sw = fwC / totalScale;
    const sh = fhC / totalScale;

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 640, 512);
    const jpegBase64 = canvas.toDataURL("image/jpeg", 0.85);

    // 上传到 Supabase Storage
    const base64Data = jpegBase64.split(",")[1];
    const key = `covers/${app._id}.jpg`;
    let thumbUrl = editThumbnail;

    try {
      const res = await fetch(UPLOAD_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          content: base64Data,
          contentType: "image/jpeg",
        }),
      });
      const result = await res.json();
      if (result.url) {
        thumbUrl = `${result.url}?t=${Date.now()}`;
        setEditThumbnail(thumbUrl);
      } else {
        console.error("封面上传失败:", result.error);
      }
    } catch (err) {
      console.error("封面上传失败:", err);
    }

    // 保存表单数据到数据库
    try {
      const { supabase } = await import("@/supabase");
      const { error } = await supabase
        .from("n3d_app_items")
        .update({
          title: editTitle.trim(),
          description: editDesc?.trim() || "",
          index_path: editIndexPath.trim() || app.indexPath,
          thumbnail: thumbUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", app._id);

      if (!error) {
        const { updateApp } = useAppStore.getState();
        updateApp(app._id, {
          title: editTitle.trim(),
          description: editDesc?.trim() || "",
          indexPath: editIndexPath.trim() || app.indexPath,
          thumbnail: thumbUrl,
        });
        setCropImage(null);
        setCropFile(null);
        setEditOpen(false);
      }
    } catch (e) {
      console.error("保存失败:", e);
    }
    setSaving(false);
  };

  const handleCropCancel = () => {
    setCropImage(null);
    setCropFile(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    const maxOffset = 3;
    setShadowPos({
      x: Math.round(dx * maxOffset),
      y: Math.round(dy * maxOffset),
    });
  };

  const handleMouseLeave = () => {
    setShadowPos({ x: 0, y: 0 });
  };

  return (
    <>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => {
          // 移动端长按 → 关闭其他卡片 + 显示当前卡片的汉堡包（不展开菜单）
          e.preventDefault();
          window.dispatchEvent(new Event("close-card-menus"));
          setHamburgerVisible(true);
        }}
        className="group relative select-none overflow-hidden rounded-[10px] border-2 border-[var(--border-card)] bg-[var(--bg-card)] transition-shadow duration-200 hover:scale-[1.013]"
        style={{
          boxShadow:
            shadowPos.x || shadowPos.y
              ? `${shadowPos.x}px ${shadowPos.y}px 5px var(--shadow-hover-color)`
              : `0 4px 5px var(--shadow-card-color)`,
        }}
      >
        {user?.isAdmin && (
          <div ref={menuRef} className="absolute right-2 top-2 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-btn)] text-[var(--text-btn)] opacity-0 transition-all hover:bg-[var(--bg-btn-hover)] hover:text-[var(--text-hover)] group-hover:opacity-100"
              style={hamburgerVisible ? { opacity: 1 } : undefined}
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 z-20 flex flex-col items-center gap-1.5">
                <button
                  onClick={handleEdit}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-btn)] text-[var(--text-btn)] transition-colors hover:bg-[var(--bg-btn-hover)] hover:text-[var(--text-hover)]"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-btn)] text-red-400 transition-colors hover:bg-[var(--bg-btn-hover)]"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}

            {deleteConfirm && (
              <div className="absolute right-0 top-9 w-28 rounded-lg bg-[var(--bg-card)] p-3 shadow-lg ring-1 ring-white/10">
                <p className="mb-2 text-xs text-[var(--text-btn)]">
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
                    className="flex-1 rounded bg-[var(--bg-btn)] px-2 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-btn-hover)]"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <button onClick={() => startView(app)} className="w-full text-left">
          <div className="flex aspect-square flex-col overflow-hidden">
            {/* 封面 — 占 4/5 */}
            <div className="min-h-0 flex-[4] overflow-hidden bg-[var(--bg-card)]">
              {thumbSrc ? (
                <img
                  src={thumbSrc}
                  alt={app.title}
                  draggable={false}
                  className="h-full w-full select-none object-cover"
                  style={{ WebkitTouchCallout: "none" }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[var(--border-light)]">
                  <svg
                    className="h-24 w-24 sm:h-[168px] sm:w-[168px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.5"
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                </div>
              )}
            </div>
            {/* 标题栏 — 占 1/5，文字垂直居中 */}
            <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden bg-[var(--bg-card-header)] px-3 py-1.5 text-left">
              <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {app.title}
              </h3>
              {app.description && (
                <div
                  ref={descRef}
                  className="hidden sm:block"
                  onMouseEnter={() => {
                    if (descRef.current) {
                      const r = descRef.current.getBoundingClientRect();
                      setTooltipRect({
                        top: r.bottom + 4,
                        left: r.left,
                        width: r.width,
                      });
                      setShowTooltip(true);
                    }
                  }}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  <p className="mt-0.5 line-clamp-2 overflow-hidden text-xs leading-[1.35] text-[var(--text-muted)]">
                    {app.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </button>
      </div>

      {editOpen && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !cropDrag) setEditOpen(false);
          }}
        >
          <div className="w-80 select-none rounded-[10px] border-2 border-[var(--border-card)] bg-[var(--bg-card)] p-5 shadow-xl">
            {cropImage ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">
                    编辑信息
                  </h3>
                  <button
                    onClick={handleCropCancel}
                    className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-btn)] hover:text-[var(--text-hover)]"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* 表单字段 — 和普通视图顺序一致 */}
                <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                  名称
                </label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mb-3 w-full rounded border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-btn)]"
                  placeholder="模型名称"
                />

                <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                  详细信息
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  className="mb-3 w-full resize-none rounded border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-btn)]"
                  placeholder="模型描述"
                />

                <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                  3D 链接 URL
                </label>
                <input
                  value={editIndexPath}
                  onChange={(e) => setEditIndexPath(e.target.value)}
                  className="mb-3 w-full rounded border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-btn)]"
                  placeholder="https://..."
                />

                <ImageCropper
                  cropImage={cropImage}
                  cropFrame={cropFrame}
                  cropZoom={cropZoom}
                  saving={saving}
                  dotCount={dotCount}
                  onCropCancel={handleCropCancel}
                  onCropConfirm={handleCropConfirm}
                  onCropPointerDown={handleCropPointerDown}
                  onZoomChange={(z) => setCropZoom(z)}
                  coverWrapRef={
                    coverWrapRef as React.RefObject<HTMLDivElement | null>
                  }
                />
              </>
            ) : (
              <>
                {/* 编辑步骤 */}
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">
                    编辑信息
                  </h3>
                  <button
                    onClick={() => setEditOpen(false)}
                    className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-btn)] hover:text-[var(--text-hover)]"
                  >
                    <X size={16} />
                  </button>
                </div>

                <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                  名称
                </label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mb-3 w-full rounded border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-btn)]"
                  placeholder="模型名称"
                />

                <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                  详细信息
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  className="mb-3 w-full resize-none rounded border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-btn)]"
                  placeholder="模型描述"
                />

                <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                  3D 链接 URL
                </label>
                <input
                  value={editIndexPath}
                  onChange={(e) => setEditIndexPath(e.target.value)}
                  className="mb-3 w-full rounded border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-btn)]"
                  placeholder="https://..."
                />

                <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                  封面
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="mb-4 flex aspect-[5/4] w-full cursor-pointer items-center justify-center overflow-hidden rounded border border-dashed border-[var(--border-btn)] bg-[var(--bg-input)] transition-colors hover:border-white/30 hover:bg-[var(--bg-btn)]"
                >
                  {editThumbnail ? (
                    <img
                      src={editThumbnail}
                      alt="封面"
                      draggable={false}
                      className="h-full w-full select-none object-cover"
                      style={{ WebkitTouchCallout: "none" }}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-[var(--text-muted)]">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span className="text-xs">点击上传封面</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <button
                  onClick={handleSave}
                  disabled={saving || !editTitle.trim()}
                  className="flex w-full items-center justify-center gap-1.5 rounded bg-[var(--bg-btn-hover)] py-2 text-sm font-medium text-[var(--text-primary)] transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {saving ? (
                    `保存${".".repeat(dotCount || 3)}`
                  ) : (
                    <>
                      <Check size={14} />
                      保存
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 描述 tooltip */}
      {showTooltip && (
        <div
          className="fixed z-[5000] rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] p-2 shadow-xl"
          style={{
            top: tooltipRect.top,
            left: tooltipRect.left,
            width: tooltipRect.width,
          }}
        >
          <p className="text-xs leading-relaxed text-[var(--text-btn)]">
            {app.description}
          </p>
        </div>
      )}
    </>
  );
}
