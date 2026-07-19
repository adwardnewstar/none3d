import { create } from "zustand";
import type { AppItem } from "@/types";

interface AnnotationAction {
  type:
    | "like"
    | "dislike"
    | "reply"
    | "delete"
    | "like-reply"
    | "dislike-reply"
    | "delete-reply";
  commentId: string;
  text?: string;
  images?: string[];
}

interface AppStore {
  /** 所有 App 列表 */
  apps: AppItem[];
  /** 加载状态 */
  loading: boolean;
  /** 当前查看的 App（全屏 iframe 时） */
  viewing: AppItem | null;
  /** 向 Verge3D iframe 发送消息 */
  postToVerge3D: ((msg: any) => void) | null;
  /** 位置拾取回调（用户点击场景后触发） */
  onPositionPicked:
    | ((
        commentId: string,
        position: { x: number; y: number; z: number },
      ) => void)
    | null;
  /** 待闪烁高亮的评论 ID（双向定位） */
  pingedCommentId: string | null;
  /** 来自 3D 视口 annotation 悬停弹窗的操作 */
  annotationAction: AnnotationAction | null;
  /** 设置 App 列表 */
  setApps: (apps: AppItem[]) => void;
  /** 更新单个 App 数据 */
  updateApp: (id: string, data: Partial<AppItem>) => void;
  /** 删除单个 App */
  removeApp: (id: string) => void;
  /** 开始查看 App */
  startView: (app: AppItem) => void;
  /** 关闭查看 */
  closeView: () => void;
  /** 设置 postMessage 发送函数 */
  setPostToVerge3D: (fn: ((msg: any) => void) | null) => void;
  /** 设置位置拾取回调 */
  setOnPositionPicked: (
    fn:
      | ((
          commentId: string,
          position: { x: number; y: number; z: number },
        ) => void)
      | null,
  ) => void;
  /** 设置待闪烁的评论 ID */
  setPingedCommentId: (id: string | null) => void;
  /** 设置来自视口的 annotation 操作 */
  setAnnotationAction: (action: AnnotationAction | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  apps: [],
  loading: true,
  viewing: null,
  postToVerge3D: null,
  onPositionPicked: null,
  pingedCommentId: null,
  annotationAction: null,
  setApps: (apps) => set({ apps, loading: false }),
  updateApp: (id, data) =>
    set((state) => ({
      apps: state.apps.map((a) => (a._id === id ? { ...a, ...data } : a)),
    })),
  removeApp: (id) =>
    set((state) => ({
      apps: state.apps.filter((a) => a._id !== id),
    })),
  startView: (app) => set({ viewing: app }),
  closeView: () => set({ viewing: null }),
  setPostToVerge3D: (fn) => set({ postToVerge3D: fn }),
  setOnPositionPicked: (fn) => set({ onPositionPicked: fn }),
  setPingedCommentId: (id) => set({ pingedCommentId: id }),
  setAnnotationAction: (action) => set({ annotationAction: action }),
}));

// ==================== 用户认证（前台评论系统） ====================

export interface UserInfo {
  uid: string;
  username: string;
  nickname?: string;
  isAdmin?: boolean;
}

type Theme = "dark" | "light";

function loadTheme(): Theme {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
  }
  // 首次访问，根据当前时间自动判断：6:00~18:00 浅色，其余深色
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("theme-dark", "theme-light");
  root.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
  localStorage.setItem("theme", theme);
}

// 主题初始化移至 App.tsx 中执行

interface UserStore {
  /** 当前登录用户 */
  user: UserInfo | null;
  /** 是否显示登录弹窗 */
  showAuthModal: boolean;
  /** 是否显示个人资料弹窗 */
  profileOpen: boolean;
  /** 登录成功后的待执行操作（被拦截的操作） */
  pendingAction: (() => void) | null;
  /** 当前主题 */
  theme: Theme;
  /** 设置当前用户 */
  setUser: (user: UserInfo | null) => void;
  /** 设置登录弹窗显隐 */
  setShowAuthModal: (show: boolean) => void;
  /** 设置个人资料弹窗显隐 */
  setProfileOpen: (open: boolean) => void;
  /** 设置待执行操作 */
  setPendingAction: (action: (() => void) | null) => void;
  /** 检查登录态，未登录或闲置超时自动弹窗 */
  requireAuth: (pendingAction?: () => void) => boolean;
  /** 设置管理员状态 */
  setAdmin: (isAdmin: boolean) => void;
  /** 切换主题 */
  setTheme: (theme: Theme) => void;
}

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  showAuthModal: false,
  profileOpen: false,
  pendingAction: null,
  theme: loadTheme(),

  setUser: (user) => set({ user }),

  setShowAuthModal: (show) => {
    if (!show) {
      set({ showAuthModal: false, pendingAction: null });
    } else {
      set({ showAuthModal: true });
    }
  },

  setProfileOpen: (open) => set({ profileOpen: open }),

  setPendingAction: (action) => set({ pendingAction: action }),

  requireAuth: (pendingAction) => {
    const { user } = get();
    if (!user) {
      set({ showAuthModal: true, pendingAction: pendingAction || null });
      return false;
    }
    // 检查闲置超时（1 小时）
    const lastActivity = localStorage.getItem("user_last_activity");
    if (lastActivity && Date.now() - Number(lastActivity) > 3600000) {
      set({ showAuthModal: true, pendingAction: pendingAction || null });
      return false;
    }
    // 更新活动时间
    localStorage.setItem("user_last_activity", String(Date.now()));
    return true;
  },

  setAdmin: (isAdmin) => {
    const { user } = get();
    if (user) {
      set({ user: { ...user, isAdmin } });
    }
  },

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));
