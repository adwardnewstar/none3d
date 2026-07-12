import { supabase } from "@/supabase";

let _authListeners: Array<
  (user: { uid: string; username: string; isAdmin?: boolean } | null) => void
> = [];

/** 查询邮箱是否为超级管理员 */
export async function checkIsAdmin(email: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("n3d_admin_users")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/** 从 n3d_user_profiles 查询用户昵称 */
async function fetchNickname(uid: string): Promise<string | undefined> {
  try {
    const { data } = await supabase
      .from("n3d_user_profiles")
      .select("nickname")
      .eq("uid", uid)
      .maybeSingle();
    return data?.nickname || undefined;
  } catch {
    return undefined;
  }
}

/** 邮箱密码登录 */
export async function loginWithPassword(
  email: string,
  password: string,
): Promise<
  | { success: true; user: { uid: string; username: string; isAdmin: boolean } }
  | { success: false; error: string }
> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const msg = error?.message || "登录失败";
      return { success: false, error: msg };
    }

    const uid = data?.user?.id;
    if (!uid) {
      return { success: false, error: "登录失败，未获取到用户信息" };
    }

    const username = data.user.email || uid;
    const [isAdmin, nickname] = await Promise.all([
      checkIsAdmin(username),
      fetchNickname(uid),
    ]);
    const user = { uid, username, nickname, isAdmin };
    notifyAuthListeners(user);
    return { success: true, user };
  } catch (e: any) {
    const msg = e?.message || e?.toString?.() || "登录失败";
    return { success: false, error: msg };
  }
}

/** 退出登录 */
export async function logout(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
  notifyAuthListeners(null);
}

/** 获取当前登录用户（同步，从 localStorage 读取 Supabase 会话，isAdmin 需异步查询） */
export function getCurrentUser(): {
  uid: string;
  username: string;
  isAdmin: boolean;
} | null {
  try {
    const raw = localStorage.getItem("supabase.auth.token");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const user = parsed?.currentSession?.user || parsed?.user;
    if (!user?.id) return null;
    return { uid: user.id, username: user.email || user.id, isAdmin: false };
  } catch {
    return null;
  }
}

/** 监听认证状态变化，返回取消监听函数 */
export function onAuthChange(
  callback: (
    user: { uid: string; username: string; isAdmin?: boolean } | null,
  ) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      callback({
        uid: session.user.id,
        username: session.user.email || session.user.id,
      });
    } else {
      callback(null);
    }
  });
  // 初始状态
  callback(getCurrentUser());
  return () => data?.subscription?.unsubscribe?.() ?? (() => {});
}

function notifyAuthListeners(
  user: { uid: string; username: string; isAdmin?: boolean } | null,
) {
  _authListeners.forEach((l) => l(user));
}

/** 尝试恢复 Supabase 会话（自动） */
export async function tryAutoLogin(): Promise<{
  uid: string;
  username: string;
  nickname?: string;
  isAdmin: boolean;
} | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user;
    if (user) {
      localStorage.setItem("user_last_activity", String(Date.now()));
      const email = user.email || user.id;
      const [isAdmin, nickname] = await Promise.all([
        checkIsAdmin(email),
        fetchNickname(user.id),
      ]);
      return { uid: user.id, username: email, nickname, isAdmin };
    }
  } catch {
    // ignore
  }
  return null;
}

/** 检查登录态是否有效且未超时闲置（1 小时） */
export function isSessionValid(): boolean {
  const lastActivity = localStorage.getItem("user_last_activity");
  if (lastActivity && Date.now() - Number(lastActivity) > 3600000) {
    return false;
  }
  return true;
}

/** 更新最后活动时间 */
export function touchActivity() {
  localStorage.setItem("user_last_activity", String(Date.now()));
}
