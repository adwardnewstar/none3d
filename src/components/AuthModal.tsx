import { useState, useEffect, useRef } from "react";
import { Loader2, LogIn } from "lucide-react";
import { loginWithPassword } from "@/api/auth";
import { useUserStore } from "@/store";

export default function AuthModal() {
  const { showAuthModal, setShowAuthModal, setUser, pendingAction } =
    useUserStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  // 打开时预填保存的凭据
  useEffect(() => {
    if (showAuthModal) {
      const saved = localStorage.getItem("user_credentials");
      if (saved) {
        try {
          const { username: savedUser, password: savedPass } =
            JSON.parse(saved);
          setUsername(savedUser || "");
          setPassword(savedPass || "");
        } catch {
          // 解析失败，忽略
        }
      }
      setTimeout(() => usernameRef.current?.focus(), 100);
    } else {
      setError("");
      setLoading(false);
    }
  }, [showAuthModal]);

  const handleLogin = async () => {
    if (!username.trim()) {
      setError("请输入用户名");
      return;
    }
    if (!password) {
      setError("请输入密码");
      return;
    }

    setLoading(true);
    setError("");

    const result = await loginWithPassword(username.trim(), password);
    if (result.success) {
      setUser(result.user);
      setShowAuthModal(false);
    } else {
      const msg = (result as { error: string }).error;
      if (
        msg.includes("password") ||
        msg.includes("401") ||
        msg.includes("unauthorized") ||
        msg.includes("Invalid") ||
        msg.includes("incorrect")
      ) {
        setError("用户名或密码错误");
      } else {
        setError(msg.length > 30 ? "登录失败，请重试" : msg);
      }
    }
    setLoading(false);
  };

  if (!showAuthModal) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-80 rounded-[10px] border-2 border-[var(--border-card)] bg-[var(--bg-card)] p-6 shadow-xl">
        <div className="mb-4 text-center">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            登录
          </h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            请登录后进行评论操作
          </p>
        </div>

        <div className="space-y-3">
          <input
            ref={usernameRef}
            type="text"
            placeholder="用户名"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleLogin()}
            maxLength={50}
            className="w-full rounded border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-input)] outline-none placeholder:text-gray-500 focus:border-white/20"
            disabled={loading}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleLogin()}
            maxLength={100}
            className="w-full rounded border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-input)] outline-none placeholder:text-gray-500 focus:border-white/20"
            disabled={loading}
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="mt-2 text-center text-xs text-red-500">{error}</p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setShowAuthModal(false)}
            className="rounded px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors bg-[var(--bg-btn)] hover:bg-[var(--bg-btn-hover)]"
            disabled={loading}
          >
            取消
          </button>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="flex items-center gap-1.5 rounded bg-[var(--bg-btn-hover)] px-4 py-1.5 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-btn-hover)] disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <LogIn size={14} />
            )}
            登录
          </button>
        </div>
      </div>
    </div>
  );
}
