import { useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import AuthModal from "@/components/AuthModal";
import UserProfileModal from "@/components/UserProfileModal";
import { useUserStore } from "@/store";
import { onAuthChange, tryAutoLogin } from "@/api/auth";

export default function App() {
  const setUser = useUserStore((s) => s.setUser);
  const showAuthModal = useUserStore((s) => s.showAuthModal);
  const profileOpen = useUserStore((s) => s.profileOpen);
  const setProfileOpen = useUserStore((s) => s.setProfileOpen);
  const pendingAction = useUserStore((s) => s.pendingAction);
  const executedRef = useRef(false);

  // 应用启动：尝试自动恢复登录态
  useEffect(() => {
    // 1. 监听 Supabase SDK 的认证状态变化
    const unsub = onAuthChange((user) => {
      if (user) {
        // 保留已有的 isAdmin（onAuthChange 不返回 isAdmin，避免被覆盖）
        const currentUser = useUserStore.getState().user;
        setUser({
          ...user,
          isAdmin: user.isAdmin ?? currentUser?.isAdmin ?? false,
        });
      } else {
        setUser(null);
      }
    });

    // 2. 尝试用保存的凭据自动登录（7 天内）
    tryAutoLogin().then((user) => {
      if (user) {
        setUser(user);
      }
    });

    return unsub;
  }, [setUser]);

  // 登录成功后执行待操作
  useEffect(() => {
    if (!showAuthModal && pendingAction && !executedRef.current) {
      executedRef.current = true;
      // 用 requestAnimationFrame 确保状态已更新
      requestAnimationFrame(() => {
        pendingAction();
        executedRef.current = false;
      });
    }
    if (showAuthModal) {
      executedRef.current = false;
    }
  }, [showAuthModal, pendingAction]);

  // [DEBUG] 追踪头像点击
  useEffect(() => {
    console.log(
      "[App] profileOpen 状态变化:",
      profileOpen,
      "user:",
      useUserStore.getState().user?.uid,
    );
  }, [profileOpen]);

  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </Router>
      {/* 全局弹窗（Router 外，避免 CSS containing block / 路由匹配问题） */}
      <AuthModal />
      {profileOpen && (
        <UserProfileModal onClose={() => setProfileOpen(false)} />
      )}
    </>
  );
}
