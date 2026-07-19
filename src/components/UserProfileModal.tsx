import { useState, useEffect, useRef } from "react";
import { X, Loader2, ChevronDown, ChevronUp, LogOut } from "lucide-react";
import { useUserStore } from "@/store";
import { generateAvatar } from "@/utils/avatar";
import { compressAvatar } from "@/utils/compressAvatar";
import { getProfile, upsertProfile } from "@/api/userProfile";
import { logout } from "@/api/auth";

interface Props {
  onClose: () => void;
}

export default function UserProfileModal({ onClose }: Props) {
  const { user, setAvatar: storeSetAvatar } = useUserStore();
  const uid = user?.uid || "";
  const email = user?.username || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatar, setAvatar] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");

  // 重置密码
  const [pwdOpen, setPwdOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [resettingPwd, setResettingPwd] = useState(false);

  const [saved, setSaved] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarCompressingRef = useRef(false);

  const defaultNickname = email.includes("@")
    ? email.split("@")[0].slice(0, 8)
    : email.slice(0, 8);

  useEffect(() => {
    const load = async () => {
      const cached = localStorage.getItem(`avatar_${uid}`);
      const initialAvatar = cached || generateAvatar(uid);
      setAvatar(initialAvatar);

      const profile = await getProfile(uid);
      if (profile) {
        setNickname(profile.nickname || defaultNickname);
        setPhone(profile.phone || "");
        setCompany(profile.company || "");
        if (profile.avatar) {
          setAvatar(profile.avatar);
          storeSetAvatar(profile.avatar);
        }
      } else {
        setNickname(defaultNickname);
      }
      setLoading(false);
    };
    load();
  }, [uid, defaultNickname]);

  // 头像上传处理
  const handleAvatarFile = async (file: File) => {
    if (avatarCompressingRef.current) return;
    if (!file.type.startsWith("image/")) return;
    avatarCompressingRef.current = true;
    try {
      const dataUrl = await compressAvatar(file);
      setAvatar(dataUrl);
      storeSetAvatar(dataUrl);
    } catch {
      // ignore
    }
    avatarCompressingRef.current = false;
  };

  const handleAvatarClick = () => {
    fileRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleAvatarFile(files[0]);
    }
    e.target.value = "";
  };

  // 粘贴上传
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") === 0) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          handleAvatarFile(file);
        }
        return;
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const success = await upsertProfile({
      uid,
      nickname: nickname.trim() || defaultNickname,
      avatar,
      phone,
      email,
      company,
    });
    if (success) {
      storeSetAvatar(avatar);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    setPwdMsg("");
    setPwdSuccess(false);

    if (!oldPassword) {
      setPwdMsg("请输入旧密码");
      return;
    }
    if (!newPassword) {
      setPwdMsg("请输入新密码");
      return;
    }
    if (newPassword.length < 8) {
      setPwdMsg("新密码至少 8 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg("两次输入的新密码不一致");
      return;
    }

    setResettingPwd(true);
    try {
      const { supabase } = await import("@/supabase");
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        setPwdMsg(error?.message || "修改失败");
      } else {
        setPwdSuccess(true);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (e: any) {
      setPwdMsg(e?.message || "修改失败");
    }
    setResettingPwd(false);
  };

  const handleLogout = async () => {
    await logout();
    useUserStore.setState({ user: null });
    onClose();
  };

  if (!uid) return null;

  return (
    <div
      className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onPaste={handlePaste}
    >
      <div
        ref={modalRef}
        className="w-96 rounded-[10px] border-2 border-[var(--border-card)] bg-[var(--bg-card)] p-6 shadow-xl"
      >
        {/* 头部 */}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            个人资料
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-btn)] hover:text-[var(--text-primary)]"
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2
              size={20}
              className="animate-spin text-[var(--text-secondary)]"
            />
          </div>
        ) : (
          <div className="space-y-3">
            {/* 头像 */}
            <div className="flex flex-col items-center gap-1.5">
              <input
                type="file"
                accept="image/*"
                ref={fileRef}
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={handleAvatarClick}
                className="h-20 w-20 overflow-hidden rounded-full border-2 border-[var(--border-btn)] transition-colors hover:border-white/40"
                title="点击上传头像"
              >
                <img
                  src={avatar}
                  alt="avatar"
                  className="h-full w-full object-cover"
                />
              </button>
              <span className="text-xs text-[var(--text-muted)]">
                点击或粘贴上传头像
              </span>
            </div>

            {/* 昵称 */}
            <div className="flex items-center rounded border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm focus-within:border-white/20">
              <span className="shrink-0 text-[var(--text-secondary)]">
                昵称：
              </span>
              <input
                type="text"
                placeholder="昵称"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={8}
                className="ml-1 flex-1 bg-transparent text-[var(--text-primary)] outline-none placeholder:text-gray-500"
              />
            </div>

            {/* 电话 */}
            <div className="flex items-center rounded border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm focus-within:border-white/20">
              <span className="shrink-0 text-[var(--text-secondary)]">
                电话：
              </span>
              <input
                type="text"
                placeholder="电话"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={20}
                className="ml-1 flex-1 bg-transparent text-[var(--text-primary)] outline-none placeholder:text-gray-500"
              />
            </div>

            {/* 邮箱（只读） */}
            <div className="flex items-center rounded border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm">
              <span className="shrink-0 text-[var(--text-secondary)]">
                邮箱：
              </span>
              <span className="ml-1 text-[var(--text-secondary)]">{email}</span>
            </div>

            {/* 公司 */}
            <div className="flex items-center rounded border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm focus-within:border-white/20">
              <span className="shrink-0 text-[var(--text-secondary)]">
                公司：
              </span>
              <input
                type="text"
                placeholder="公司（选填）"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={50}
                className="ml-1 flex-1 bg-transparent text-[var(--text-primary)] outline-none placeholder:text-gray-500"
              />
            </div>

            {/* 重置密码（可折叠） */}
            {pwdOpen && (
              <div className="space-y-3">
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => {
                    setOldPassword(e.target.value);
                    setPwdMsg("");
                    setPwdSuccess(false);
                  }}
                  placeholder="旧密码"
                  maxLength={100}
                  className="w-full rounded border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-gray-500 focus:border-white/20"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPwdMsg("");
                    setPwdSuccess(false);
                  }}
                  placeholder="新密码"
                  maxLength={100}
                  className="w-full rounded border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-gray-500 focus:border-white/20"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPwdMsg("");
                    setPwdSuccess(false);
                  }}
                  placeholder="确认新密码"
                  maxLength={100}
                  className="w-full rounded border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-gray-500 focus:border-white/20"
                />
                <button
                  onClick={handleResetPassword}
                  disabled={resettingPwd}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded bg-[var(--bg-btn)] px-3 py-1.5 text-sm text-[var(--text-btn)] transition-colors hover:bg-[var(--bg-btn-hover)] disabled:opacity-60"
                >
                  {resettingPwd && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  确认修改
                </button>
                {pwdMsg && (
                  <p
                    className={`text-xs ${pwdSuccess ? "text-green-400" : "text-red-400"}`}
                  >
                    {pwdSuccess ? "密码修改成功" : pwdMsg}
                  </p>
                )}
              </div>
            )}

            {/* 退出账户 + 底部按钮 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPwdOpen((v) => !v)}
                  className="rounded bg-[var(--bg-btn)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-btn-hover)]"
                >
                  重置密码
                </button>
                <button
                  onClick={handleLogout}
                  className="rounded bg-[var(--bg-btn)] px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-[var(--bg-btn-hover)]"
                >
                  退出账户
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="rounded px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-btn)]"
                >
                  关闭
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded bg-[var(--bg-btn-hover)] px-4 py-1.5 text-sm font-medium text-[var(--text-primary)] transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : null}
                  {saved ? "已保存" : "保存"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
