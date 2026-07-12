import { Sun, Moon, Plus, Wrench, LogIn } from "lucide-react";
import { useUserStore } from "@/store";
import { generateAvatar } from "@/utils/avatar";

interface Props {
  onUploadOpen?: () => void;
  onProcessOpen?: () => void;
}

export default function HomeHeader({
  onUploadOpen,
  onProcessOpen,
}: Props = {}) {
  const { user, setShowAuthModal, setProfileOpen, theme, setTheme } =
    useUserStore();
  // 主题切换：直接切换深色/浅色

  if (!user) {
    return (
      <button
        onClick={() => setShowAuthModal(true)}
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--border-btn)] bg-[var(--bg-input)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-btn-hover)] hover:text-[var(--text-hover)]"
        title="登录"
      >
        <LogIn size={18} />
      </button>
    );
  }

  const avatarUrl =
    localStorage.getItem(`avatar_${user.uid}`) ||
    (() => {
      const av = generateAvatar(user.uid);
      localStorage.setItem(`avatar_${user.uid}`, av);
      return av;
    })();

  return (
    <>
      <div className="flex items-center gap-2">
        {/* 管理按钮 */}
        {user?.isAdmin && (
          <>
            <button
              onClick={onUploadOpen}
              className="max-md:hidden flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--border-btn)] bg-[var(--bg-input)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-btn-hover)] hover:text-[var(--text-hover)]"
              title="新增 3D 展示"
            >
              <Plus size={18} />
            </button>
            <button
              onClick={onProcessOpen}
              className="max-md:hidden flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--border-btn)] bg-[var(--bg-input)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-btn-hover)] hover:text-[var(--text-hover)]"
              title="处理 Verge3D"
            >
              <Wrench size={18} />
            </button>
          </>
        )}
        {/* 主题切换按钮 — 点击直接切换 */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--border-btn)] bg-[var(--bg-input)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-btn-hover)] hover:text-[var(--text-hover)]"
          title={theme === "dark" ? "切换浅色" : "切换深色"}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* 用户头像 — 点击直接进入资料页 */}
        <button
          onClick={() => setProfileOpen(true)}
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--border-btn)] bg-[var(--bg-input)] transition-colors hover:border-[var(--border-btn-hover)]"
          title="用户资料"
        >
          <img
            src={avatarUrl}
            alt="avatar"
            className="h-full w-full object-cover"
          />
        </button>
      </div>
    </>
  );
}
