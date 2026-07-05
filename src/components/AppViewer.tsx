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
} from "lucide-react";
import { useAppStore, useUserStore } from "@/store";
import { addComment } from "@/api/comment";
import { compressImage } from "@/utils/imageCompress";
import CommentPanel from "./CommentPanel";

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
  const [calibrateNickname, setCalibrateNickname] = useState("");
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
            setCalibrateNickname("");
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
          setAnnotationAction({
            type: msg.action,
            commentId: msg.commentId,
            text: msg.text,
            images: msg.images,
          });
          break;
      }
    },
    [awaitingMarkerPos, setPingedCommentId, setAnnotationAction],
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

  // 确认标定：获取标记组位置（与侧边栏逻辑一致）
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

    const nickname = calibrateNickname.trim() || "匿名用户";
    const commentId = "cmt-" + Date.now();

    if (import.meta.env.DEV) {
      // mock 模式：先通知 CommentPanel 刷新（通过自定义事件）
      send({
        type: "create-annotation",
        commentId,
        position: calibratePos,
        content: calibrateContent.trim(),
        likes: 0,
        dislikes: 0,
        replyCount: 0,
        nickname: calibrateNickname.trim() || "匿名用户",
        createdAt: new Date().toISOString(),
        images: calibrateImages.length > 0 ? calibrateImages : undefined,
      });
      // 通过浏览器事件通知 CommentPanel 新增评论
      window.dispatchEvent(
        new CustomEvent("viewport-calibrate", {
          detail: {
            _id: commentId,
            appId: viewing?._id,
            parentId: null,
            nickname,
            content: calibrateContent.trim(),
            isCalibrated: true,
            position: calibratePos,
            likes: 0,
            likedBy: [],
            dislikes: 0,
            dislikedBy: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            images: calibrateImages.length > 0 ? calibrateImages : undefined,
          },
        }),
      );
    } else {
      // 生产：先创建评论到数据库
      const ok = await addComment(
        viewing?._id || "",
        nickname,
        calibrateContent.trim(),
        undefined,
        calibrateImages.length > 0 ? calibrateImages : undefined,
      );
      if (ok) {
        send({
          type: "create-annotation",
          commentId,
          position: calibratePos,
          content: calibrateContent.trim(),
          images: calibrateImages.length > 0 ? calibrateImages : undefined,
        });
      }
    }

    setCalibratePos(null);
    setCalibrateContent("");
    setCalibrateNickname("");
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
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* 顶部栏：关闭(左) + 标题(中) + 评论按钮(右) — 在 iframe 外面 */}
      <div className="relative z-50 flex h-12 shrink-0 items-center justify-between bg-black/90 px-4">
        {/* 左侧：关闭 */}
        <button
          onClick={closeView}
          className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/20"
        >
          <X size={14} />
          关闭
        </button>

        {/* 中间：标题 */}
        <span className="absolute left-1/2 -translate-x-1/2 text-sm text-white/80">
          {viewing.title}
        </span>

        {/* 右侧：评论按钮（侧栏折叠时显示） */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/20"
            title="展开评论"
          >
            <PanelLeftOpen size={14} />
            评论
          </button>
        )}
        {/* 侧栏展开时右侧留空占位，保持标题居中 */}
      </div>

      {/* 主体：iframe + 底部按钮 */}
      <div className="relative flex-1">
        {iframeLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00d4ff] border-t-transparent" />
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

        {/* 底部居中：三个操作按钮 */}
        <div className="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2">
          <button
            onClick={toggleAnnotations}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs backdrop-blur transition-colors ${
              annotationsVisible
                ? "bg-blue-600/80 text-white hover:bg-blue-700"
                : "bg-black/40 text-gray-400 hover:bg-black/60"
            }`}
            title={annotationsVisible ? "隐藏标注" : "显示标注"}
          >
            {annotationsVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            <span className="max-md:hidden">显示标注</span>
          </button>

          <button
            onClick={toggleCoordinates}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs backdrop-blur transition-colors ${
              coordinatesVisible
                ? "bg-blue-600/80 text-white hover:bg-blue-700"
                : "bg-black/40 text-gray-400 hover:bg-black/60"
            }`}
            title={coordinatesVisible ? "隐藏标记组" : "显示标记组"}
          >
            <MapPin size={14} />
            <span className="max-md:hidden">显示坐标</span>
          </button>

          <button
            onClick={startViewCalibrate}
            disabled={awaitingMarkerPos}
            className="flex items-center gap-1.5 rounded-full bg-green-600/80 px-3 py-1.5 text-xs text-white backdrop-blur transition-colors hover:bg-green-700 disabled:opacity-60"
            title="获取标记组位置生成标定"
          >
            <PlusCircle size={14} />
            <span className="max-md:hidden">确认标定</span>
          </button>
        </div>
      </div>

      {/* 侧边栏：桌面从右侧滑入，手机从底部滑出 */}
      {/* 折叠态遮罩（仅手机端） */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed z-50 border-l border-gray-200 bg-white transition-all duration-300 ease-out
          md:bottom-0 md:right-0 md:top-0 md:w-[380px]
          ${sidebarOpen ? "md:translate-x-0 md:opacity-100" : "md:translate-x-full md:opacity-0"}
          max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:h-[50vh] max-md:rounded-t-xl
          ${sidebarOpen ? "max-md:translate-y-0" : "max-md:translate-y-full"}`}
      >
        <CommentPanel
          appId={viewing._id}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
      </div>

      {/* 确认标定弹窗 */}
      {calibratePos && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
          <div className="w-80 rounded-xl bg-white p-5 shadow-lg">
            <h3 className="text-base font-medium text-gray-800">
              在标定位置生成标定
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              位置: ({calibratePos.x.toFixed(2)}, {calibratePos.y.toFixed(2)},{" "}
              {calibratePos.z.toFixed(2)})
            </p>
            <input
              type="text"
              placeholder="你的昵称（可选）"
              value={calibrateNickname}
              onChange={(e) => setCalibrateNickname(e.target.value)}
              maxLength={20}
              className="mt-3 w-full rounded-lg border bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-blue-400 focus:bg-white"
            />
            <textarea
              placeholder="请输入内容"
              value={calibrateContent}
              onChange={(e) => setCalibrateContent(e.target.value)}
              maxLength={500}
              rows={3}
              className="mt-2 w-full resize-none rounded-lg border bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-blue-400 focus:bg-white"
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
                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-700 text-[10px] text-white hover:bg-red-500"
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
                  setCalibrateNickname("");
                  setCalibrateImages([]);
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                onClick={() => calibrateFileRef.current?.click()}
                disabled={calibrateImages.length >= 2}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                title={
                  calibrateImages.length >= 2 ? "最多 2 张图片" : "添加图片"
                }
              >
                <Paperclip size={14} />
              </button>
              <button
                onClick={handleCalibrateConfirm}
                disabled={!calibrateContent.trim() || calibrateSubmitting}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
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
    </div>
  );
}
