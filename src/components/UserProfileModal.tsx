import { useState, useEffect, useRef } from "react";
import { X, Loader2, RefreshCw } from "lucide-react";
import { useUserStore } from "@/store";
import { generateAvatar } from "@/utils/avatar";
import { getProfile, upsertProfile } from "@/api/userProfile";
import { supabase } from "@/supabase";
import type { UserProfile } from "@/types";

interface Props {
  onClose: () => void;
}

export default function UserProfileModal({ onClose }: Props) {
  const { user } = useUserStore();
  const uid = user?.uid || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatar, setAvatar] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");

  // 重置密码
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [resettingPwd, setResettingPwd] = useState(false);

  const [saved, setSaved] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const cached = localStorage.getItem(`avatar_${uid}`);
      const initialAvatar = cached || generateAvatar(uid);
      setAvatar(initialAvatar);

      const profile = await getProfile(uid);
      if (profile) {
        setNickname(profile.nickname || "");
        setPhone(profile.phone || "");
        setEmail(profile.email || "");
        setCompany(profile.company || "");
        if (profile.avatar) {
          setAvatar(profile.avatar);
          localStorage.setItem(`avatar_${uid}`, profile.avatar);
        }
      } else {
        setNickname(user?.username || "");
      }
      setLoading(false);
    };
    load();
  }, [uid, user]);

  const handleRegenerateAvatar = () => {
    const newAvatar = generateAvatar(uid + Date.now());
    setAvatar(newAvatar);
    localStorage.setItem(`avatar_${uid}`, newAvatar);
  };

  const handleSave = async () => {
    setSaving(true);
    const success = await upsertProfile({
      uid,
      nickname: nickname.trim() || user?.username || "",
      avatar,
      phone,
      email,
      company,
    });
    if (success) {
      localStorage.setItem(`avatar_${uid}`, avatar);
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

  if (!uid) return null;

  return (
    <div
      className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={modalRef} className="w-96 rounded-xl bg-white p-6 shadow-xl">
        {/* 头部 */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">个人资料</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* 头像区 */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <img
                  src={avatar}
                  alt="avatar"
                  className="h-20 w-20 rounded-full border-2 border-gray-200 object-cover"
                />
                <button
                  onClick={handleRegenerateAvatar}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200"
                  title="随机换一个头像"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              <span className="text-xs text-gray-400">点击图标随机换头像</span>
            </div>

            {/* 昵称 */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                昵称
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400 focus:bg-white"
              />
            </div>

            {/* 电话 */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                电话
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={20}
                className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400 focus:bg-white"
              />
            </div>

            {/* 邮箱 */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={100}
                className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400 focus:bg-white"
              />
            </div>

            {/* 公司 */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                公司
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={50}
                className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400 focus:bg-white"
              />
            </div>

            {/* 重置密码 */}
            <div className="space-y-2 border-t pt-4">
              <label className="block text-xs font-medium text-gray-500">
                重置密码
              </label>
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
                className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400 focus:bg-white"
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
                className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400 focus:bg-white"
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
                className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400 focus:bg-white"
              />
              <button
                onClick={handleResetPassword}
                disabled={resettingPwd}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-60"
              >
                {resettingPwd ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                确认修改
              </button>
              {pwdMsg && (
                <p
                  className={`text-xs ${pwdSuccess ? "text-green-500" : "text-red-500"}`}
                >
                  {pwdSuccess ? "密码修改成功" : pwdMsg}
                </p>
              )}
            </div>

            {/* 保存 */}
            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100"
              >
                关闭
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {saved ? "已保存" : "保存"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
