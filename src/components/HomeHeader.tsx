import { useState, useRef, useEffect } from "react";
import { LogOut, User } from "lucide-react";
import { useUserStore } from "@/store";
import { logout } from "@/api/auth";
import { generateAvatar } from "@/utils/avatar";

export default function HomeHeader() {
  const { user, setShowAuthModal, setUser, setProfileOpen } = useUserStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!user) {
    return (
      <button
        onClick={() => setShowAuthModal(true)}
        className="rounded-full bg-[#00d4ff]/10 px-4 py-1.5 text-sm text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20"
      >
        登录
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

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setShowAuthModal(false);
  };

  return (
    <>
      <div className="relative flex items-center" ref={menuRef}>
        {/* 头像（点击切换菜单） */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="h-8 w-8 overflow-hidden rounded-full border-2 border-[#00d4ff]/50 transition-colors hover:border-[#00d4ff]"
          title="用户菜单"
        >
          <img
            src={avatarUrl}
            alt="avatar"
            className="h-full w-full object-cover"
          />
        </button>

        {/* 下拉菜单 */}
        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-40 overflow-hidden rounded-lg border border-white/10 bg-[#1a1a2e] shadow-xl z-50">
            <button
              onClick={() => {
                setProfileOpen(true);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <User size={14} />
              个人资料
            </button>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-red-400"
            >
              <LogOut size={14} />
              退出登录
            </button>
          </div>
        )}
      </div>
    </>
  );
}
