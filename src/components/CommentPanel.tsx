import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Send,
  MessageCircle,
  Loader2,
  MapPin,
  Edit3,
  Move,
  Trash2,
  X,
  Paperclip,
  Heart,
  ThumbsDown,
  LogOut,
  Settings,
  PanelLeftClose,
} from "lucide-react";
import { compressImage } from "@/utils/imageCompress";
import {
  queryComments,
  addComment,
  updateComment,
  deleteComment,
  calibrateComment,
  toggleLike,
  toggleDislike,
} from "@/api/comment";
import { logout } from "@/api/auth";
import { generateAvatar } from "@/utils/avatar";
import { useAppStore, useUserStore } from "@/store";
import type { CommentItem } from "@/types";

interface Props {
  appId: string;
}

/** 胶囊卡片 */
function CommentCapsule({
  comment,
  onCalibrate,
  onEdit,
  onMove,
  onDeleteCalibration,
  onDeleteComment,
  pinged,
  onExpand,
  onImageClick,
  isOwner,
}: {
  comment: CommentItem;
  onCalibrate: () => void;
  onEdit: () => void;
  onMove: () => void;
  onDeleteCalibration: () => void;
  onDeleteComment: () => void;
  pinged: boolean;
  onExpand: (expanded?: boolean) => void;
  onImageClick: (src: string) => void;
  isOwner: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && onExpand) onExpand(true);
  };

  return (
    <div
      className={`rounded-lg border bg-white transition-all duration-300 ${
        pinged
          ? "border-blue-500 shadow-lg ring-2 ring-blue-500/40 scale-[1.02]"
          : "border-gray-200"
      }`}
    >
      {/* 头部 - 点击展开/收起 */}
      <div
        onClick={handleToggle}
        className="flex cursor-pointer items-center gap-2 px-3 py-2.5"
      >
        {/* 标定状态圆点 */}
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            comment.isCalibrated ? "bg-green-500" : "bg-gray-300"
          }`}
        />
        <span className="text-sm font-medium text-gray-700">
          {comment.nickname}
        </span>
        <span className="text-xs text-gray-400">
          {new Date(comment.createdAt).toLocaleString("zh-CN", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        {/* X 删除按钮 - 仅作者可见 */}
        {isOwner && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteComment();
            }}
            className="ml-auto rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500"
            title="删除评论"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* 评论内容：折叠时一行省略，展开时全文 */}
      <p
        className={`cursor-pointer px-3 pb-1.5 text-sm text-gray-600 ${
          expanded ? "" : "truncate"
        }`}
        onClick={handleToggle}
      >
        {comment.content}
      </p>

      {expanded && comment.images && comment.images.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pb-2">
          {comment.images.map((img, i) => (
            <img
              key={i}
              src={img}
              alt="comment-img"
              className="h-16 w-16 cursor-pointer rounded border object-cover transition-opacity hover:opacity-75"
              onClick={(e) => {
                e.stopPropagation();
                if (onImageClick) onImageClick(img);
              }}
            />
          ))}
        </div>
      )}

      {/* 展开后的操作栏 - 仅作者可见 */}
      {expanded && isOwner && (
        <div className="flex items-center gap-1 border-t border-gray-100 px-2 py-1.5">
          <ActionBtn
            icon={<MapPin size={13} />}
            label="标定"
            disabled={comment.isCalibrated}
            onClick={onCalibrate}
          />
          <ActionBtn
            icon={<Edit3 size={13} />}
            label="编辑"
            disabled={!comment.isCalibrated}
            onClick={onEdit}
          />
          <ActionBtn
            icon={<Move size={13} />}
            label="移动"
            disabled={!comment.isCalibrated}
            onClick={onMove}
          />
          <ActionBtn
            icon={<Trash2 size={13} />}
            label="删除标定"
            disabled={!comment.isCalibrated}
            onClick={onDeleteCalibration}
          />
        </div>
      )}
    </div>
  );
}

/** 操作按钮 */
function ActionBtn({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
        disabled
          ? "cursor-not-allowed text-gray-300"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/** 回复输入框（嵌入胶囊内） */
function ReplyInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (text: string, images?: string[]) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addImage = async (file: File) => {
    if (images.length >= 2) return;
    setIsCompressing(true);
    try {
      const dataUrl = await compressImage(file);
      if (dataUrl) setImages((prev) => [...prev, dataUrl]);
    } catch {
      // ignore
    }
    setIsCompressing(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let fi = 0; fi < files.length && images.length < 2; fi++) {
      await addImage(files[fi]);
    }
    e.target.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") === 0) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) addImage(file);
        return;
      }
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = () => {
    if (text.trim() || images.length > 0) {
      onSubmit(text.trim(), images.length > 0 ? images : undefined);
      setText("");
      setImages([]);
    }
  };

  return (
    <div className="border-t border-gray-100 px-3 py-2">
      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative inline-block">
              <img
                src={img}
                alt="preview"
                className="h-12 w-12 rounded border object-cover"
              />
              <button
                onClick={() => removeImage(i)}
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-700 text-[10px] text-white hover:bg-red-500"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept="image/*"
          ref={fileRef}
          className="hidden"
          onChange={handleFile}
          multiple
        />
        <input
          type="text"
          placeholder="写下你的回复..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          className="flex-1 rounded-lg border bg-gray-50 px-2.5 py-1.5 text-sm text-gray-800 outline-none focus:border-blue-400 focus:bg-white"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && (text.trim() || images.length > 0)) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") {
              onCancel();
            }
          }}
          onPaste={handlePaste}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={isCompressing || images.length >= 2}
          className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          title={images.length >= 2 ? "最多 2 张图片" : "添加图片"}
        >
          {isCompressing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Paperclip size={14} />
          )}
        </button>
        <button
          onClick={submit}
          disabled={(!text.trim() && images.length === 0) || isCompressing}
          className="rounded-lg bg-blue-500 px-2.5 py-1.5 text-xs text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  );
}

/** 回复胶囊 */
function ReplyCapsule({
  reply,
  onDelete,
  onImageClick,
  isOwner,
}: {
  reply: CommentItem;
  onDelete: () => void;
  onImageClick?: (src: string) => void;
  isOwner: boolean;
}) {
  return (
    <div className="border-t border-gray-100 px-3 py-2 last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-600">
            {reply.nickname}
          </span>
          <span className="text-[10px] text-gray-400">
            {new Date(reply.createdAt).toLocaleString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="text-[10px] text-gray-300">回复</span>
        </div>
        {isOwner && (
          <button
            onClick={onDelete}
            className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500"
            title="删除回复"
          >
            <X size={12} />
          </button>
        )}
      </div>
      {reply.images && reply.images.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {reply.images.map((img, i) => (
            <img
              key={i}
              src={img}
              alt="reply-img"
              className="h-16 w-16 cursor-pointer rounded border object-cover transition-opacity hover:opacity-75"
              onClick={(e) => {
                e.stopPropagation();
                if (onImageClick) onImageClick(img);
              }}
            />
          ))}
        </div>
      )}
      <p className="mt-0.5 text-xs text-gray-500">{reply.content}</p>
    </div>
  );
}

/** 确认弹窗 */
function ConfirmDialog({
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
      <div className="w-80 rounded-xl bg-white p-5 shadow-lg">
        <h3 className="text-base font-medium text-gray-800">{title}</h3>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            {confirmLabel || "确认"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 编辑弹窗 */
function EditDialog({
  open,
  initialContent,
  onSave,
  onCancel,
}: {
  open: boolean;
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialContent);

  useEffect(() => {
    setText(initialContent);
  }, [initialContent, open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
      <div className="w-80 rounded-xl bg-white p-5 shadow-lg">
        <h3 className="text-base font-medium text-gray-800">编辑评论</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={3}
          className="mt-2 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-400 text-gray-800"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
          >
            取消
          </button>
          <button
            onClick={() => onSave(text)}
            disabled={!text.trim()}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CommentPanel({
  appId,
  sidebarOpen,
  onToggleSidebar,
}: {
  appId: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const {
    postToVerge3D,
    setOnPositionPicked,
    pingedCommentId,
    setPingedCommentId,
    annotationAction,
    setAnnotationAction,
  } = useAppStore();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [images, setImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // 登录用户
  const user = useUserStore((s) => s.user);
  const requireAuth = useUserStore((s) => s.requireAuth);

  // 检查当前用户是否是评论/回复的作者
  const isOwner = (comment: CommentItem) =>
    user?.uid && comment.userId === user.uid;

  // 回复状态
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replySubmitting, setReplySubmitting] = useState(false);
  // 展开全部回复（每条评论独立控制）
  const [showAllReplies, setShowAllReplies] = useState<Set<string>>(new Set());

  const toggleShowAllReplies = (id: string) => {
    setShowAllReplies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 按 parentId 分组（仅顶级评论有 children）
  const repliesByParent = useMemo(() => {
    const map: Record<string, CommentItem[]> = {};
    comments.forEach((c) => {
      if (c.parentId) {
        if (!map[c.parentId]) map[c.parentId] = [];
        map[c.parentId].push(c);
      }
    });
    return map;
  }, [comments]);

  const topLevelComments = useMemo(
    () => comments.filter((c) => !c.parentId),
    [comments],
  );

  // 按点赞数降序 → 时间升序 排列回复
  const sortReplies = useCallback((replies: CommentItem[]) => {
    return [...replies].sort((a, b) => {
      if (b.likes !== a.likes) return b.likes - a.likes;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, []);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(36, el.scrollHeight) + "px";
  }, []);

  // 弹窗状态
  const [editTarget, setEditTarget] = useState<CommentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommentItem | null>(null);
  const [deleteCommentTarget, setDeleteCommentTarget] =
    useState<CommentItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<CommentItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await queryComments(appId);
    setComments(data);
    setLoading(false);
  }, [appId]);

  useEffect(() => {
    load();
  }, [load]);

  // pingedCommentId 自动清除（600ms 后）
  useEffect(() => {
    if (pingedCommentId) {
      const timer = setTimeout(() => setPingedCommentId(null), 700);
      return () => clearTimeout(timer);
    }
  }, [pingedCommentId, setPingedCommentId]);

  // ===== 点赞 =====
  const handleToggleLike = useCallback(
    async (comment: CommentItem) => {
      const uid = user?.uid;
      if (!uid) {
        requireAuth();
        return;
      }
      const liked = comment.likedBy.includes(uid);
      const newLikes = liked ? comment.likes - 1 : comment.likes + 1;
      const userLiked = !liked;

      // 乐观更新本地状态
      setComments((prev) =>
        prev.map((c) =>
          c._id === comment._id
            ? {
                ...c,
                likes: newLikes,
                likedBy: liked
                  ? c.likedBy.filter((id) => id !== uid)
                  : [...c.likedBy, uid],
              }
            : c,
        ),
      );

      // 保存到数据库
      await toggleLike(comment._id, uid, liked);

      // 同步到 3D annotation dialog
      if (postToVerge3D && comment.isCalibrated) {
        postToVerge3D({
          type: "annotation-update-counts",
          commentId: comment._id,
          likes: newLikes,
          userLiked,
        });
      }
    },
    [user, postToVerge3D],
  );

  // ===== 踩 =====
  const handleToggleDislike = useCallback(
    async (comment: CommentItem) => {
      const uid = user?.uid;
      if (!uid) {
        requireAuth();
        return;
      }
      const disliked = comment.dislikedBy.includes(uid);
      const newDislikes = disliked
        ? comment.dislikes - 1
        : comment.dislikes + 1;
      const userDisliked = !disliked;

      setComments((prev) =>
        prev.map((c) =>
          c._id === comment._id
            ? {
                ...c,
                dislikes: newDislikes,
                dislikedBy: disliked
                  ? c.dislikedBy.filter((id) => id !== uid)
                  : [...c.dislikedBy, uid],
              }
            : c,
        ),
      );

      await toggleDislike(comment._id, uid, disliked);

      // 同步到 3D annotation dialog
      if (postToVerge3D && comment.isCalibrated) {
        postToVerge3D({
          type: "annotation-update-counts",
          commentId: comment._id,
          dislikes: newDislikes,
          userDisliked,
        });
      }
    },
    [user, postToVerge3D],
  );

  // ===== 回复提交 =====
  const handleSubmitReply = async (
    parentId: string,
    text: string,
    images?: string[],
  ) => {
    if (!requireAuth()) return;
    if (!text.trim() && (!images || images.length === 0)) return;
    setReplySubmitting(true);

    // 计算新回复数（当前回复数 + 1）
    const currentReplies = comments.filter((c) => c.parentId === parentId);
    const newReplyCount = currentReplies.length + 1;
    const parentComment = comments.find((c) => c._id === parentId);

    await addComment(
      appId,
      user?.username || "匿名用户",
      text,
      parentId,
      images,
    );
    await load();

    setReplySubmitting(false);

    // 同步 replyCount 到 3D annotation dialog
    if (postToVerge3D && parentComment?.isCalibrated) {
      postToVerge3D({
        type: "annotation-update-counts",
        commentId: parentId,
        replyCount: newReplyCount,
        likes: parentComment.likes,
        dislikes: parentComment.dislikes,
      });

      // 同步回复内容到 dialog
      postToVerge3D({
        type: "annotation-add-reply",
        commentId: parentId,
        nickname: user?.username || "匿名用户",
        content: text.trim(),
        replyCount: newReplyCount,
        images: images,
      });
    }
  };

  // ===== 删除回复 =====
  const handleDeleteReply = async (reply: CommentItem) => {
    if (!requireAuth()) return;
    if (!isOwner(reply)) return;
    await deleteComment(reply._id);
    await load();
  };

  // 监听来自 3D annotation 悬停弹窗的操作（点赞/踩/回复）
  useEffect(() => {
    if (!annotationAction || !user?.uid) return;
    const { type, commentId, text } = annotationAction;
    const target = comments.find((c) => c._id === commentId);
    if (!target) {
      setAnnotationAction(null);
      return;
    }
    if (type === "like") {
      handleToggleLike(target);
    } else if (type === "dislike") {
      handleToggleDislike(target);
    } else if (type === "reply") {
      if (text) {
        // 来自 3D dialog 的回复：直接提交
        handleSubmitReply(commentId, text, annotationAction.images);
      } else {
        setReplyToId((prev) => (prev === commentId ? null : commentId));
      }
    } else if (type === "delete") {
      if (!isOwner(target)) {
        setAnnotationAction(null);
        return;
      }
      // 来自 3D dialog 的删除操作
      if (target.isCalibrated && postToVerge3D) {
        postToVerge3D({ type: "remove-annotation", commentId });
      }
      deleteComment(commentId).then(() => {
        load();
      });
    }
    setAnnotationAction(null);
  }, [
    annotationAction,
    user?.uid,
    comments,
    handleToggleLike,
    handleToggleDislike,
    handleSubmitReply,
    setAnnotationAction,
    postToVerge3D,
    load,
  ]);

  // 底部主评论图片处理
  const handleMainFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let fi = 0; fi < files.length && images.length < 2; fi++) {
      const dataUrl = await compressImage(files[fi]);
      if (dataUrl) setImages((prev) => [...prev, dataUrl]);
    }
    e.target.value = "";
  };

  const handleMainPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") === 0) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          compressImage(file).then((dataUrl) => {
            if (dataUrl)
              setImages((prev) =>
                prev.length < 2 ? [...prev, dataUrl] : prev,
              );
          });
        }
        return;
      }
    }
  };

  const removeMainImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    if (!requireAuth()) return;
    setSubmitting(true);

    const ok = await addComment(
      appId,
      user?.username || "匿名用户",
      content,
      undefined,
      images,
    );
    if (ok) {
      setContent("");
      setImages([]);
      setTimeout(autoResize, 0);
      await load();
    }
    setSubmitting(false);
  };

  // ===== 标定 =====
  const handleCalibrate = (comment: CommentItem) => {
    if (!requireAuth()) return;
    if (!isOwner(comment)) return;
    if (postToVerge3D) {
      // 有 Verge3D 桥 → 请求标记位置，自动创建 annotation
      const capturedContent = comment.content;
      const existingReplies = comments
        .filter((c) => c.parentId === comment._id)
        .map((r) => ({ nickname: r.nickname, content: r.content }));
      postToVerge3D({ type: "get-marker-position", commentId: comment._id });

      // 注册回调：Verge3D 返回标记位置后自动创建 annotation
      setOnPositionPicked(async (commentId, position) => {
        // 更新本地状态（mock 数据需要）
        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId
              ? {
                  ...c,
                  isCalibrated: true,
                  position,
                  updatedAt: new Date().toISOString(),
                }
              : c,
          ),
        );
        await calibrateComment(commentId, position);
        if (postToVerge3D) {
          postToVerge3D({
            type: "create-annotation",
            commentId,
            position,
            content: capturedContent,
            likes: comment.likes,
            dislikes: comment.dislikes,
            replyCount: existingReplies.length,
            replies: existingReplies,
            nickname: comment.nickname,
            createdAt: comment.createdAt,
          });
        }
        setOnPositionPicked(null); // 清空回调，避免重复触发
      });
    } else {
      // 无桥接（回退）: mock 标定
      const mockPos = { x: 0, y: 0, z: 0 };
      setComments((prev) =>
        prev.map((c) =>
          c._id === comment._id
            ? {
                ...c,
                isCalibrated: true,
                position: mockPos,
                updatedAt: new Date().toISOString(),
              }
            : c,
        ),
      );
      calibrateComment(comment._id, mockPos);
    }
  };

  // ===== 编辑 =====
  const handleEditSave = async (text: string) => {
    if (!editTarget) return;
    if (!requireAuth()) return;
    if (!isOwner(editTarget)) {
      setEditTarget(null);
      return;
    }
    const capturedId = editTarget._id;
    await updateComment(capturedId, text);
    setEditTarget(null);
    await load();
    // 更新 3D 场景中 annotation 的弹窗内容
    if (postToVerge3D) {
      postToVerge3D({
        type: "update-annotation",
        commentId: capturedId,
        content: text,
      });
    }
  };

  // ===== 移动 =====
  const handleMoveConfirm = async () => {
    if (!moveTarget) return;
    if (!requireAuth()) return;
    if (!isOwner(moveTarget)) {
      setMoveTarget(null);
      return;
    }
    if (postToVerge3D) {
      const capturedId = moveTarget._id;
      postToVerge3D({ type: "get-marker-position", commentId: capturedId });

      setOnPositionPicked(async (commentId, position) => {
        // 更新本地状态
        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId
              ? { ...c, position, updatedAt: new Date().toISOString() }
              : c,
          ),
        );
        // 更新数据库
        await calibrateComment(commentId, position);
        // 更新 3D 场景中的 annotation 位置
        if (postToVerge3D) {
          postToVerge3D({
            type: "move-annotation",
            commentId,
            position,
          });
        }
        setOnPositionPicked(null);
        await load();
      });
    }
    setMoveTarget(null);
  };

  // ===== 删除标定（仅移除标注） =====
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    if (!requireAuth()) return;
    if (!isOwner(deleteTarget)) {
      setDeleteTarget(null);
      return;
    }
    const capturedId = deleteTarget._id;
    await calibrateComment(capturedId, null);
    if (postToVerge3D) {
      postToVerge3D({ type: "remove-annotation", commentId: capturedId });
    }
    setDeleteTarget(null);
    await load();
  };

  // ===== 删除评论（整条删除 + 移除标注） =====
  const handleDeleteComment = async () => {
    if (!deleteCommentTarget) return;
    if (!requireAuth()) return;
    if (!isOwner(deleteCommentTarget)) {
      setDeleteCommentTarget(null);
      return;
    }
    const capturedId = deleteCommentTarget._id;
    // 如果有标定，先移除 annotation
    if (deleteCommentTarget.isCalibrated && postToVerge3D) {
      postToVerge3D({ type: "remove-annotation", commentId: capturedId });
    }
    // 删除数据库记录
    await deleteComment(capturedId);
    setDeleteCommentTarget(null);
    await load();
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* 头部 */}
      <div className="flex items-center border-b px-4 py-3">
        {/* 折叠按钮 */}
        <button
          onClick={onToggleSidebar}
          className="mr-2 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          title="收起侧栏"
        >
          <PanelLeftClose size={16} />
        </button>

        {/* 中间：icon + 评论 + 条数 */}
        <div className="flex flex-1 items-center justify-center gap-2">
          <MessageCircle size={18} className="text-gray-600" />
          <span className="font-medium text-gray-800">评论</span>
          <span className="text-xs text-gray-400">{comments.length} 条</span>
        </div>

        {/* 右侧：用户操作 */}
        <div className="flex items-center gap-1">
          {user ? (
            <>
              <button
                onClick={() => useUserStore.getState().setProfileOpen(true)}
                className="h-7 w-7 overflow-hidden rounded-full border border-gray-300 transition-colors hover:border-gray-400"
                title="个人资料"
              >
                <img
                  src={
                    localStorage.getItem(`avatar_${user.uid}`) ||
                    generateAvatar(user.uid)
                  }
                  alt="avatar"
                  className="h-full w-full object-cover"
                />
              </button>
              <button
                onClick={() => {}}
                className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                title="设置"
              >
                <Settings size={14} />
              </button>
              <button
                onClick={async () => {
                  await logout();
                  useUserStore.setState({ user: null });
                }}
                className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500"
                title="退出"
              >
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={() => useUserStore.getState().setShowAuthModal(true)}
              className="text-xs text-blue-400 transition-colors hover:text-blue-500 hover:underline"
            >
              未登录
            </button>
          )}
        </div>
      </div>

      {/* 评论列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-gray-400" />
          </div>
        ) : comments.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            暂无评论
          </div>
        ) : (
          <div className="space-y-3">
            {topLevelComments.map((c) => {
              const replies = repliesByParent[c._id] || [];
              const sortedReplies = sortReplies(replies);
              const allExpanded = showAllReplies.has(c._id);
              const visibleReplies = allExpanded
                ? sortedReplies
                : sortedReplies.slice(-1);

              return (
                <div key={c._id}>
                  {/* 胶囊卡片 */}
                  <CommentCapsule
                    comment={c}
                    onCalibrate={() => handleCalibrate(c)}
                    onEdit={() => setEditTarget(c)}
                    onMove={() => setMoveTarget(c)}
                    onDeleteCalibration={() => setDeleteTarget(c)}
                    onDeleteComment={() => setDeleteCommentTarget(c)}
                    pinged={pingedCommentId === c._id}
                    onImageClick={setLightboxSrc}
                    isOwner={isOwner(c)}
                    onExpand={() => {
                      if (postToVerge3D && c.isCalibrated) {
                        postToVerge3D({
                          type: "ping-annotation",
                          commentId: c._id,
                        });
                      }
                    }}
                  />

                  {/* 👍 💬 放在胶囊外部 */}
                  <div className="flex items-center gap-4 px-3 py-1.5">
                    {/* 点赞 */}
                    <button
                      onClick={() => handleToggleLike(c)}
                      className={`flex items-center gap-1 text-xs transition-colors ${
                        c.likedBy.includes(user?.uid || "")
                          ? "text-red-500"
                          : "text-gray-400 hover:text-red-400"
                      }`}
                    >
                      <Heart
                        size={14}
                        fill={
                          c.likedBy.includes(user?.uid || "")
                            ? "currentColor"
                            : "none"
                        }
                      />
                      <span>赞</span>
                      {c.likes > 0 && <span>{c.likes}</span>}
                    </button>

                    {/* 踩 */}
                    <button
                      onClick={() => handleToggleDislike(c)}
                      className={`flex items-center gap-1 text-xs transition-colors ${
                        c.dislikedBy.includes(user?.uid || "")
                          ? "text-orange-500"
                          : "text-gray-400 hover:text-orange-400"
                      }`}
                    >
                      <ThumbsDown
                        size={14}
                        fill={
                          c.dislikedBy.includes(user?.uid || "")
                            ? "currentColor"
                            : "none"
                        }
                      />
                      <span>踩</span>
                      {c.dislikes > 0 && <span>{c.dislikes}</span>}
                    </button>

                    {/* 回复 */}
                    <button
                      onClick={() =>
                        setReplyToId(replyToId === c._id ? null : c._id)
                      }
                      className={`flex items-center gap-1 text-xs transition-colors ${
                        replyToId === c._id
                          ? "text-blue-500"
                          : "text-gray-400 hover:text-blue-400"
                      }`}
                    >
                      <MessageCircle size={14} />
                      <span>回复</span>
                      {replies.length > 0 && <span>{replies.length}</span>}
                    </button>
                  </div>

                  {/* 回复容器（带背景色区分） */}
                  {(replies.length > 0 || replyToId === c._id) && (
                    <div className="mb-2 ml-4 overflow-hidden rounded-lg border border-gray-100 bg-gray-50/80">
                      {/* 回复列表 */}
                      {visibleReplies.map((r) => (
                        <div key={r._id}>
                          <ReplyCapsule
                            reply={r}
                            onDelete={() => handleDeleteReply(r)}
                            onImageClick={setLightboxSrc}
                            isOwner={isOwner(r)}
                          />
                          {/* 回复的点赞在胶囊外部 */}
                          <div className="flex items-center gap-3 px-3 pb-1.5">
                            <button
                              onClick={() => handleToggleLike(r)}
                              className={`flex items-center gap-1 text-xs transition-colors ${
                                r.likedBy.includes(user?.uid || "")
                                  ? "text-red-500"
                                  : "text-gray-400 hover:text-red-400"
                              }`}
                            >
                              <Heart
                                size={14}
                                fill={
                                  r.likedBy.includes(user?.uid || "")
                                    ? "currentColor"
                                    : "none"
                                }
                              />
                              <span>赞</span>
                              {r.likes > 0 && <span>{r.likes}</span>}
                            </button>
                            {/* 踩 */}
                            <button
                              onClick={() => handleToggleDislike(r)}
                              className={`flex items-center gap-1 text-xs transition-colors ${
                                r.dislikedBy.includes(user?.uid || "")
                                  ? "text-orange-500"
                                  : "text-gray-400 hover:text-orange-400"
                              }`}
                            >
                              <ThumbsDown
                                size={14}
                                fill={
                                  r.dislikedBy.includes(user?.uid || "")
                                    ? "currentColor"
                                    : "none"
                                }
                              />
                              <span>踩</span>
                              {r.dislikes > 0 && <span>{r.dislikes}</span>}
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* "共 xx 条回复" 展开/收起 */}
                      {replies.length > 1 && (
                        <button
                          onClick={() => toggleShowAllReplies(c._id)}
                          className="w-full border-t border-gray-100 px-3 py-1.5 text-left text-xs text-blue-500 transition-colors hover:bg-gray-100/50"
                        >
                          {allExpanded
                            ? "收起回复"
                            : `共 ${replies.length} 条回复`}
                        </button>
                      )}

                      {/* 回复输入框 */}
                      {replyToId === c._id && (
                        <ReplyInput
                          onSubmit={(text, images) => {
                            handleSubmitReply(c._id, text, images);
                            setReplyToId(null);
                          }}
                          onCancel={() => setReplyToId(null)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="border-t px-4 py-3">
        {images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative inline-block">
                <img
                  src={img}
                  alt="preview"
                  className="h-12 w-12 rounded border object-cover"
                />
                <button
                  onClick={() => removeMainImage(i)}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-700 text-[10px] text-white hover:bg-red-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="file"
            accept="image/*"
            ref={fileRef}
            className="hidden"
            onChange={handleMainFile}
            multiple
          />
          <textarea
            ref={textareaRef}
            placeholder="写下你的评论..."
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setTimeout(autoResize, 0);
            }}
            maxLength={500}
            rows={1}
            className="min-h-[36px] max-h-[120px] flex-1 resize-none rounded-lg border bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-blue-400 focus:bg-white"
            onPaste={handleMainPaste}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={images.length >= 2}
            className="flex items-center justify-center rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            title={images.length >= 2 ? "最多 2 张图片" : "添加图片"}
          >
            <Paperclip size={14} />
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            className="flex min-h-[36px] items-center gap-1 self-end rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            发送
          </button>
        </div>
      </div>

      {/* 弹窗 */}
      <EditDialog
        key={editTarget?._id || "closed"}
        open={!!editTarget}
        initialContent={editTarget?.content || ""}
        onSave={handleEditSave}
        onCancel={() => setEditTarget(null)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除标定"
        message="确认要删除此评论的标定吗？场景中的 annotation 将被移除，评论内容会保留。"
        confirmLabel="删除标定"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={!!deleteCommentTarget}
        title="删除评论"
        message="确认要删除此评论吗？评论和场景中的 annotation 将被一起移除。"
        confirmLabel="删除"
        onConfirm={handleDeleteComment}
        onCancel={() => setDeleteCommentTarget(null)}
      />
      <ConfirmDialog
        open={!!moveTarget}
        title="移动注释位置"
        message="确认后，请在 3D 场景中点击一个新的位置来放置注释。"
        onConfirm={handleMoveConfirm}
        onCancel={() => setMoveTarget(null)}
      />

      {/* 图片放大弹窗 */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[100000] flex cursor-pointer items-center justify-center bg-black/85"
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            alt="enlarged"
            className="max-h-[90vh] max-w-[90vw] rounded shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
