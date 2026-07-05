import { LogOut, Settings } from "lucide-react";
import { useUserStore } from "@/store";
import { logout } from "@/api/auth";
import { generateAvatar } from "@/utils/avatar";

export default function HomeHeader() {
  const { user, setShowAuthModal, setUser, setProfileOpen } = useUserStore();

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
      <div className="flex items-center gap-2">
        {/* 头像 */}
        <button
          onClick={() => setProfileOpen(true)}
          className="h-8 w-8 overflow-hidden rounded-full border-2 border-[#00d4ff]/50 transition-colors hover:border-[#00d4ff]"
          title="个人资料"
        >
          <img
            src={avatarUrl}
            alt="avatar"
            className="h-full w-full object-cover"
          />
        </button>

        {/* 设置 */}
        <button
          onClick={() => {}}
          className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          title="设置（即将推出）"
        >
          <Settings size={16} />
        </button>

        {/* 退出 */}
        <button
          onClick={handleLogout}
          className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-red-400"
          title="退出登录"
        >
          <LogOut size={16} />
        </button>
      </div>
    </>
  );
}
