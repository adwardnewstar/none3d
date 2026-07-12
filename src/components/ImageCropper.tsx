interface CropFrame {
  x: number;
  y: number;
  size: number;
}

interface ImageCropperProps {
  cropImage: string;
  cropFrame: CropFrame;
  cropZoom: number;
  saving: boolean;
  dotCount: number;
  /** 外部传给 AppCard 的 handleCropCancel */
  onCropCancel: () => void;
  /** 外部传给 AppCard 的 handleCropConfirm */
  onCropConfirm: () => void;
  /** 外部传给 AppCard 的 handleCropPointerDown */
  onCropPointerDown: (
    type: "frame" | "tl" | "tr" | "bl" | "br",
    e: React.MouseEvent,
  ) => void;
  /** 外部传给 AppCard 的 onZoomChange */
  onZoomChange: (zoom: number) => void;
  coverWrapRef: React.RefObject<HTMLDivElement | null>;
}

export default function ImageCropper({
  cropImage,
  cropFrame,
  cropZoom,
  saving,
  dotCount,
  onCropCancel,
  onCropConfirm,
  onCropPointerDown,
  onZoomChange,
  coverWrapRef,
}: ImageCropperProps) {
  return (
    <>
      {/* 封面 — 裁剪视图 */}
      <label className="mb-1 block text-xs text-[var(--text-secondary)]">
        封面
      </label>
      <div
        ref={coverWrapRef}
        onWheel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onZoomChange(Math.max(0.5, Math.min(3, cropZoom - e.deltaY * 0.003)));
        }}
        className="relative mb-4 w-full overflow-hidden rounded-lg bg-black"
        style={{ aspectRatio: "5/4" }}
      >
        {/* 缩放后的图片 — 以容器中心为锚点 */}
        <div
          className="pointer-events-none absolute select-none"
          style={{
            top: "50%",
            left: "50%",
            width: "100%",
            height: "100%",
            transform: `translate(-50%, -50%) scale(${cropZoom})`,
            transformOrigin: "center center",
          }}
        >
          <img
            src={cropImage}
            alt="封面裁剪"
            draggable={false}
            className="h-full w-full object-cover"
          />
        </div>
        {/* 暗色遮罩 — 框外 */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute bg-black/50"
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: `${cropFrame.y}%`,
            }}
          />
          <div
            className="absolute bg-black/50"
            style={{
              bottom: 0,
              left: 0,
              right: 0,
              height: `${100 - cropFrame.y - cropFrame.size}%`,
            }}
          />
          <div
            className="absolute bg-black/50"
            style={{
              top: `${cropFrame.y}%`,
              left: 0,
              width: `${cropFrame.x}%`,
              height: `${cropFrame.size}%`,
            }}
          />
          <div
            className="absolute bg-black/50"
            style={{
              top: `${cropFrame.y}%`,
              right: 0,
              width: `${100 - cropFrame.x - cropFrame.size}%`,
              height: `${cropFrame.size}%`,
            }}
          />
        </div>
        {/* 框体边框 */}
        <div
          className="absolute cursor-move border-2 border-white/30"
          style={{
            top: `${cropFrame.y}%`,
            left: `${cropFrame.x}%`,
            width: `${cropFrame.size}%`,
            height: `${cropFrame.size}%`,
          }}
          onMouseDown={(e) => onCropPointerDown("frame", e)}
        >
          {/* 四角拖拽手柄 */}
          {(["tl", "tr", "bl", "br"] as const).map((c) => {
            const cursorMap = {
              tl: "cursor-nw-resize",
              tr: "cursor-ne-resize",
              bl: "cursor-sw-resize",
              br: "cursor-se-resize",
            };
            return (
              <div
                key={c}
                className={`absolute h-3 w-3 rounded-sm bg-white/60 ${cursorMap[c]}`}
                style={
                  c === "tl"
                    ? { top: -4, left: -4 }
                    : c === "tr"
                      ? { top: -4, right: -4 }
                      : c === "bl"
                        ? { bottom: -4, left: -4 }
                        : { bottom: -4, right: -4 }
                }
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onCropPointerDown(c, e);
                }}
              />
            );
          })}
        </div>
      </div>
      <p className="-mt-3 mb-4 text-xs text-[var(--text-secondary)]">
        拖拽框体移动，拖拽四角缩放，滚轮缩放图片
      </p>

      <div className="flex gap-2">
        <button
          onClick={onCropCancel}
          className="flex-1 rounded-lg border border-[var(--border-light)] px-3 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-menu-hover)]"
        >
          取消裁剪
        </button>
        <button
          onClick={onCropConfirm}
          disabled={saving}
          className="flex-1 rounded-lg bg-[var(--bg-btn-hover)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {saving ? `保存${".".repeat(dotCount || 3)}` : "确认并保存"}
        </button>
      </div>
    </>
  );
}
