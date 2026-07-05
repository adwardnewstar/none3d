import type { UserProfile } from "@/types";
import { supabase } from "@/supabase";

/** 数据库行 → TypeScript 映射 */
function mapProfile(row: any): UserProfile {
  return {
    _id: row.id,
    uid: row.uid,
    nickname: row.nickname || "",
    avatar: row.avatar || "",
    phone: row.phone || "",
    email: row.email || "",
    company: row.company || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 获取用户档案，不存在则返回 null */
export async function getProfile(uid: string): Promise<UserProfile | null> {
  if (!uid || uid === "_placeholder") return null;

  try {
    const { data, error } = await supabase
      .from("n3d_user_profiles")
      .select("*")
      .eq("uid", uid)
      .maybeSingle();

    if (error) throw error;
    return data ? mapProfile(data) : null;
  } catch (e) {
    console.warn("获取用户档案失败:", e);
    return null;
  }
}

/** 创建或更新用户档案 */
export async function upsertProfile(
  profile: Omit<UserProfile, "_id" | "createdAt" | "updatedAt">,
): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const dbData = {
      uid: profile.uid,
      nickname: profile.nickname,
      avatar: profile.avatar,
      phone: profile.phone || "",
      email: profile.email || "",
      company: profile.company || "",
      updated_at: now,
    };

    const { error } = await supabase.from("n3d_user_profiles").upsert(dbData, {
      onConflict: "uid",
      ignoreDuplicates: false,
    });

    if (error) throw error;
    return true;
  } catch (e) {
    console.error("保存用户档案失败:", e);
    return false;
  }
}
