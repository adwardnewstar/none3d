import { useEffect, useRef, useCallback, useState } from "react";
import {
  X,
  Eye,
  EyeOff,
  MapPin,
  PlusCircle,
  Loader2,
  Send,
  Paperclip,
  PanelLeftOpen,
  PanelLeftClose,
  ChevronUp,
  Move,
} from "lucide-react";
import { useAppStore, useUserStore } from "@/store";
import { addComment, deleteComment, queryComments } from "@/api/comment";
import { compressImage } from "@/utils/imageCompress";
import ConfirmDialog from "./ConfirmDialog";
import CommentPanel from "./CommentPanel";
import { CommentItem } from "@/types";

export default function AppViewer() {
  const {
    viewing,
    closeView,
    setPostToVerge3D,
    onPositionPicked,
    setPingedCommentId,
    setAnnotationAction,
  } = useAppStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onPickedRef = useRef(onPositionPicked);

  onPickedRef.current = onPositionPicked;

  // 视口右上角按钮状态
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [coordinatesVisible, setCoordinatesVisible] = useState(true);

  // 坐标操作模式
  const [axisModeActive, setAxisModeActive] = useState(false);
  const [activeAxis, setActiveAxis] = useState<"x" | "y" | "z" | null>(null);
  const axisModeSavedRef = useRef<{
    annotations: boolean;
    coordinates: boolean;
  } | null>(null);

  const [iframeLoading, setIframeLoading] = useState(false);

  // 侧边栏折叠状态（默认折叠）
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 确认标定流程
  const [awaitingMarkerPos, setAwaitingMarkerPos] = useState(false);
  const [calibratePos, setCalibratePos] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);

  const [calibrateContent, setCalibrateContent] = useState("");
  const [calibrateSubmitting, setCalibrateSubmitting] = useState(false);
  const [calibrateImages, setCalibrateImages] = useState<string[]>([]);
  const calibrateFileRef = useRef<HTMLInputElement>(null);

  // 获取 postMessage 发送函数（闭包引用 iframeRef）
  const send = useCallback((msg: any) => {
    const cw = iframeRef.current?.contentWindow;
    if (cw) {
      cw.postMessage(msg, "*");
    } else {
      console.warn(
        "[AppViewer] contentWindow not available, cannot send:",
        msg.type,
      );
    }
  }, []);

  // 删除评论确认弹窗
  const [deleteTarget, setDeleteTarget] = useState<CommentItem | null>(null);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    send({ type: "remove-annotation", commentId: deleteTarget._id });
    await deleteComment(deleteTarget._id);
    setDeleteTarget(null);
    setAnnotationAction(null);
    // 通知 CommentPanel 刷新
    window.dispatchEvent(
      new CustomEvent("comment-deleted", { detail: { id: deleteTarget._id } }),
    );
  }, [deleteTarget, send, setAnnotationAction]);

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
    setAnnotationAction(null);
  }, [setAnnotationAction]);

  // ref 保存恢复函数，避免 handleMessage useCallback 闭包陈旧
  const restoreCalibratedRef = useRef<() => void>(() => {});
  useEffect(() => {
    restoreCalibratedRef.current = async () => {
      if (!viewing) return;
      try {
        const comments = await queryComments(viewing._id);
        // 提取所有回复的映射（parentId → reply list）
        const replyMap: Record<
          string,
          {
            _id: string;
            nickname: string;
            content: string;
            images?: string[];
            isBest?: boolean;
            likes: number;
            dislikes: number;
            createdAt: string;
          }[]
        > = {};
        for (const c of comments) {
          if (c.parentId) {
            if (!replyMap[c.parentId]) replyMap[c.parentId] = [];
            replyMap[c.parentId].push({
              _id: c._id,
              nickname: c.nickname,
              content: c.content,
              images: c.images || [],
              isBest: c.isBest,
              likes: c.likes,
              dislikes: c.dislikes,
              createdAt: c.createdAt,
            });
          }
        }
        for (const c of comments) {
          if (c.isCalibrated && !c.parentId && c.position) {
            const replies = replyMap[c._id] || [];
            send({
              type: "create-annotation",
              commentId: c._id,
              position: c.position,
              content: c.content,
              likes: c.likes,
              dislikes: c.dislikes,
              replyCount: replies.length,
              replies,
              nickname: c.nickname,
              createdAt: c.createdAt,
              images: c.images || [],
            });
          }
        }
      } catch (err) {
        console.error("[AppViewer] restore annotations error:", err);
      }
    };
  }, [viewing, send]);

  // 设置 postToVerge3D 发送函数到 store
  useEffect(() => {
    if (!viewing) return;
    setPostToVerge3D((msg: any) => send(msg));
    return () => setPostToVerge3D(null);
  }, [viewing, send, setPostToVerge3D]);

  // 监听 Verge3D iframe 发来的消息
  const handleMessage = useCallback(
    (e: MessageEvent) => {
      const msg = e.data;
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case "annotation-bridge-ready":
          restoreCalibratedRef.current();
          break;

        case "position-picked":
          if (onPickedRef.current) {
            onPickedRef.current(msg.commentId, msg.position);
          }
          break;

        case "marker-position":
          // 视口确认标定：等待标记位置
          if (awaitingMarkerPos) {
            setAwaitingMarkerPos(false);
            setCalibratePos(msg.position);
            setCalibrateContent("");
          } else if (onPickedRef.current) {
            onPickedRef.current(msg.commentId, msg.position);
          }
          break;

        case "annotation-removed":
          break;

        case "ping-comment":
          setPingedCommentId(msg.commentId);
          break;

        case "annotation-action":
          // 来自 3D annotation 悬停弹窗的操作
          if (msg.action === "focus-comment") {
            setSidebarOpen(true);
            setPingedCommentId(msg.commentId);
            window.dispatchEvent(new CustomEvent("sidebar-opened-by-toggle"));
            break;
          }
          if (msg.action === "focus-comment-and-expand") {
            setSidebarOpen(true);
            setPingedCommentId(msg.commentId);
            window.dispatchEvent(
              new CustomEvent("expand-all-replies", {
                detail: { commentId: msg.commentId },
              }),
            );
            break;
          }
          setAnnotationAction({
            type: msg.action,
            commentId: msg.commentId,
            text: msg.text,
            images: msg.images,
          });
          break;
      }
    },
    [
      awaitingMarkerPos,
      setPingedCommentId,
      setAnnotationAction,
      setSidebarOpen,
    ],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // 标定显示切换
  const toggleAnnotations = () => {
    const next = !annotationsVisible;
    setAnnotationsVisible(next);
    send({ type: next ? "show-annotations" : "hide-annotations" });
  };

  // 坐标显示切换
  const toggleCoordinates = () => {
    const next = !coordinatesVisible;
    setCoordinatesVisible(next);
    send({ type: next ? "show-coordinates" : "hide-coordinates" });
  };

  // 坐标操作模式
  const toggleAxisMode = () => {
    if (axisModeActive) {
      // 退出：恢复保存的状态
      const saved = axisModeSavedRef.current;
      setAxisModeActive(false);
      setActiveAxis(null);
      send({ type: "set-active-axis", axis: null });
      if (saved) {
        setAnnotationsVisible(saved.annotations);
        setCoordinatesVisible(saved.coordinates);
        send({
          type: saved.annotations ? "show-annotations" : "hide-annotations",
        });
        send({
          type: saved.coordinates ? "show-coordinates" : "hide-coordinates",
        });
      }
      axisModeSavedRef.current = null;
    } else {
      // 进入：保存当前状态，强制坐标显示，隐藏标注
      axisModeSavedRef.current = {
        annotations: annotationsVisible,
        coordinates: coordinatesVisible,
      };
      setAxisModeActive(true);
      if (!coordinatesVisible) {
        setCoordinatesVisible(true);
        send({ type: "show-coordinates" });
      }
      if (annotationsVisible) {
        setAnnotationsVisible(false);
        send({ type: "hide-annotations" });
      }
    }
  };

  const handleSelectAxis = (axis: "x" | "y" | "z") => {
    const next = activeAxis === axis ? null : axis;
    setActiveAxis(next);
    send({ type: "set-active-axis", axis: next });
    console.log("[AppViewer] sending set-axis-edge-glow, axis:", next);
    send({ type: "set-axis-edge-glow", axis: next });
  };

  // 确认标定：获取标记组位置（与侧边栏逻辑一致）
  const user = useUserStore((s) => s.user);
  const requireAuth = useUserStore((s) => s.requireAuth);
  const startViewCalibrate = () => {
    if (!requireAuth()) return;
    setAwaitingMarkerPos(true);
    send({ type: "get-marker-position", commentId: "__view_calibrate__" });
  };

  // 标定图片处理
  const handleCalibrateFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let fi = 0; fi < files.length && calibrateImages.length < 2; fi++) {
      const dataUrl = await compressImage(files[fi]);
      if (dataUrl)
        setCalibrateImages((prev) =>
          prev.length < 2 ? [...prev, dataUrl] : prev,
        );
    }
    e.target.value = "";
  };

  const handleCalibratePaste = (
    e: React.ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") === 0) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          compressImage(file).then((dataUrl) => {
            if (dataUrl)
              setCalibrateImages((prev) =>
                prev.length < 2 ? [...prev, dataUrl] : prev,
              );
          });
        }
        return;
      }
    }
  };

  const removeCalibrateImage = (idx: number) => {
    setCalibrateImages((prev) => prev.filter((_, i) => i !== idx));
  };

  // 确认标定：提交
  const handleCalibrateConfirm = async () => {
    if (!calibratePos || !calibrateContent.trim()) return;
    if (!requireAuth()) return;
    setCalibrateSubmitting(true);

    const nickname = user?.nickname || user?.username || "匿名用户";
    const content = calibrateContent.trim();
    const images = calibrateImages.length > 0 ? calibrateImages : undefined;
    const isCalibrated = true;
    const position = calibratePos;
    const createdAt = new Date().toISOString();

    // 统一的添加逻辑：创建一个带标定数据的评论
    let commentId: string | null = null;

    // 创建带有标定数据的评论到数据库（DEV/生产均落库）
    commentId = await addComment(
      viewing?._id || "",
      nickname,
      content,
      undefined,
      images,
      isCalibrated,
      position,
    );

    // 通过浏览器事件通知 CommentPanel 新增评论（双模式通用）
    if (commentId) {
      window.dispatchEvent(
        new CustomEvent("viewport-calibrate", {
          detail: {
            _id: commentId,
            appId: viewing?._id,
            parentId: null,
            userId: user?.uid ?? null,
            nickname,
            content,
            isCalibrated,
            position,
            likes: 0,
            likedBy: [],
            dislikes: 0,
            dislikedBy: [],
            createdAt,
            updatedAt: createdAt,
            images,
          },
        }),
      );
    }

    if (commentId && calibratePos) {
      // 在 3D 场景中创建 annotation
      send({
        type: "create-annotation",
        commentId,
        position: calibratePos,
        content,
        likes: 0,
        dislikes: 0,
        replyCount: 0,
        nickname,
        createdAt,
        images,
      });
    }

    setCalibratePos(null);
    setCalibrateContent("");
    setCalibrateImages([]);
    setCalibrateSubmitting(false);
  };

  // 直接用 src 加载外部链接
  useEffect(() => {
    if (!viewing) return;
    setIframeLoading(true);
    // 等待 iframe 加载完成后关闭 loading
  }, [viewing?.indexPath]);

  if (!viewing) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-page)]">
      {/* 顶部栏：关闭(左) + 标题(中) + 评论按钮(右) — 绝对定位浮在 iframe 上 */}
      <div className="absolute left-0 right-0 top-0 z-50 flex h-12 items-center justify-between px-4">
        {/* 左侧：关闭 */}
        <button
          onClick={closeView}
          className="flex items-center gap-1.5 rounded-full bg-[var(--bg-btn)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-btn-hover)]"
        >
          <X size={14} />
          关闭
        </button>

        {/* 中间：标题 */}
        <span className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-[var(--text-primary)]">
          {viewing.title}
        </span>

        {/* 右侧：评论按钮（侧栏折叠时显示） */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-[var(--bg-btn)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-btn-hover)]"
            title="展开评论"
          >
            <PanelLeftClose size={14} className="hidden md:inline" />
            <ChevronUp size={14} className="md:hidden" />
            评论
          </button>
        )}
        {/* 侧栏展开时右侧留空占位，保持标题居中 */}
      </div>

      {/* 主体：iframe + 底部按钮 */}
      <div className="relative flex-1">
        {iframeLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-page)]">
            <div className="h-[120px] w-[120px] animate-spin rounded-full border-[4px] border-[var(--spinner-bg)] border-t-[var(--spinner-fg)]" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          onLoad={() => {
            console.log("[AppViewer] iframe loaded OK");
            setIframeLoading(false);
          }}
          onError={(e) => {
            console.error("[AppViewer] iframe error:", e);
            setIframeLoading(false);
          }}
          src={viewing.indexPath}
          className="h-full w-full border-none"
          allow="fullscreen; autoplay; xr-spatial-tracking"
          title={viewing.title}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />

        {/* 底部居中：操作按钮 */}
        <div className="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-end gap-2">
          {/* 坐标操作按钮组 */}
          <div className="flex flex-col items-center gap-1">
            {axisModeActive && (
              <div className="mb-1 flex flex-col items-center gap-1">
                {(["z", "y", "x"] as const).map((ax) => (
                  <button
                    key={ax}
                    onClick={() => handleSelectAxis(ax)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs shadow-sm backdrop-blur transition-colors ${
                      activeAxis === ax
                        ? "border-orange-700/80 bg-orange-500/90 text-white"
                        : "border-red-800/40 bg-red-600/30 text-red-200 hover:bg-red-600/50"
                    }`}
                    title={`选中${ax.toUpperCase()}轴`}
                  >
                    {ax.toUpperCase()}轴
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={toggleAxisMode}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur transition-colors ${
                axisModeActive
                  ? "border-orange-800/80 bg-orange-600/80 text-white hover:bg-orange-700"
                  : "border-red-800/40 bg-red-600/30 text-white hover:bg-red-600/50"
              }`}
              title={axisModeActive ? "退出坐标操作" : "进入坐标操作"}
            >
              <Move size={14} />
              <span className="max-md:hidden">坐标操作</span>
            </button>
          </div>

          <button
            onClick={toggleAnnotations}
            disabled={axisModeActive}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur transition-colors ${
              axisModeActive
                ? "border-black/40 bg-black/20 text-gray-600 cursor-not-allowed"
                : annotationsVisible
                  ? "border-blue-800/80 bg-blue-600/80 text-white hover:bg-blue-700"
                  : "border-black/60 bg-black/40 text-gray-400 hover:bg-black/60"
            }`}
            title={annotationsVisible ? "隐藏标注" : "显示标注"}
          >
            {annotationsVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            <span className="max-md:hidden">
              {annotationsVisible ? "隐藏标注" : "显示标注"}
            </span>
          </button>

          <button
            onClick={axisModeActive ? undefined : toggleCoordinates}
            disabled={axisModeActive}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur transition-colors ${
              axisModeActive
                ? "border-black/40 bg-black/20 text-gray-600 cursor-not-allowed"
                : coordinatesVisible
                  ? "border-blue-800/80 bg-blue-600/80 text-white hover:bg-blue-700"
                  : "border-black/60 bg-black/40 text-gray-400 hover:bg-black/60"
            }`}
            title={coordinatesVisible ? "隐藏标记组" : "显示标记组"}
          >
            <MapPin size={14} />
            <span className="max-md:hidden">
              {coordinatesVisible ? "隐藏坐标" : "显示坐标"}
            </span>
          </button>

          <button
            onClick={startViewCalibrate}
            disabled={axisModeActive || awaitingMarkerPos}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur transition-colors ${
              axisModeActive
                ? "border-black/40 bg-black/20 text-gray-600 cursor-not-allowed"
                : "border-green-800/80 bg-green-600/80 text-white hover:bg-green-700 disabled:opacity-60"
            }`}
            title="获取标记组位置生成标定"
          >
            <PlusCircle size={14} />
            <span className="max-md:hidden">确认标定</span>
          </button>
        </div>
      </div>

      {/* 侧边栏：桌面从右侧滑入，手机从底部滑出 */}
      <div
        className={`fixed z-50 border-l-2 border-[var(--border-card)] bg-[var(--bg-card)] transition-all duration-300 ease-out
          md:bottom-0 md:right-0 md:top-0 md:w-[380px]
          ${sidebarOpen ? "md:translate-x-0 md:opacity-100" : "md:translate-x-full md:opacity-0"}
          max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:h-[50vh] max-md:border-t-2 max-md:border-[var(--border-card)]
          ${sidebarOpen ? "max-md:translate-y-0" : "max-md:translate-y-full"}`}
      >
        <CommentPanel
          appId={viewing._id}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => {
            setSidebarOpen((v) => !v);
            window.dispatchEvent(new CustomEvent("sidebar-opened-by-toggle"));
          }}
          onRequestDeleteComment={setDeleteTarget}
        />
      </div>

      {/* 确认标定弹窗 */}
      {calibratePos && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-80 rounded-[10px] border-2 border-[var(--border-card)] bg-[var(--bg-card)] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-[var(--text-primary)]">
                标定内容
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                位置: ({calibratePos.x.toFixed(2)}, {calibratePos.y.toFixed(2)},{" "}
                {calibratePos.z.toFixed(2)})
              </p>
            </div>
            <textarea
              placeholder="请输入内容"
              value={calibrateContent}
              onChange={(e) => setCalibrateContent(e.target.value)}
              maxLength={500}
              rows={3}
              className="mt-2 w-full resize-none rounded border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-btn-hover)]"
              onPaste={handleCalibratePaste}
            />
            {calibrateImages.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {calibrateImages.map((img, i) => (
                  <div key={i} className="relative inline-block">
                    <img
                      src={img}
                      alt="preview"
                      className="h-12 w-12 rounded border object-cover"
                    />
                    <button
                      onClick={() => removeCalibrateImage(i)}
                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-700 text-[10px] text-[var(--text-primary)] hover:bg-red-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <input
                type="file"
                accept="image/*"
                ref={calibrateFileRef}
                className="hidden"
                onChange={handleCalibrateFile}
                multiple
              />
              <button
                onClick={() => {
                  setCalibratePos(null);
                  setCalibrateContent("");
                  setCalibrateImages([]);
                }}
                className="mr-auto rounded bg-[var(--bg-btn)] px-3 py-1.5 text-sm text-[var(--text-btn)] transition-colors hover:bg-[var(--bg-btn-hover)]"
              >
                取消
              </button>
              <button
                onClick={() => calibrateFileRef.current?.click()}
                disabled={calibrateImages.length >= 2}
                className="flex items-center gap-1 rounded px-2 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-btn)] hover:text-[var(--text-btn)] disabled:opacity-50"
                title={
                  calibrateImages.length >= 2 ? "最多 2 张图片" : "添加图片"
                }
              >
                <Paperclip size={14} />
              </button>
              <button
                onClick={handleCalibrateConfirm}
                disabled={!calibrateContent.trim() || calibrateSubmitting}
                className="flex items-center gap-1 rounded bg-[var(--bg-btn-hover)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-white/30 disabled:opacity-50"
              >
                {calibrateSubmitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                生成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除评论确认弹窗 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除评论"
        message="确认要删除此评论吗？评论和场景中的 annotation 将被一起移除。"
        confirmLabel="删除"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
