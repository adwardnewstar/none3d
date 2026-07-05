/**
 * Filebase (S3-compatible) 文件上传/管理 + Supabase 数据库
 * 注意：上传功能已移除，改用纯 URL 链接方式。
 *       用户自行上传 Verge3D 项目到静态托管，然后在本项目输入 URL。
 */
import { supabase } from "@/supabase";

// ===== Supabase 数据库操作（保留） =====

/** 删除 App 数据库记录及其关联评论 */
export async function deleteAppRecord(appId: string): Promise<void> {
  const { error: commentErr } = await supabase
    .from("n3d_comments")
    .delete()
    .eq("app_id", appId);

  if (commentErr) {
    console.warn("[DB] 删除评论失败:", commentErr.message);
  }

  const { error } = await supabase
    .from("n3d_app_items")
    .delete()
    .eq("id", appId);

  if (error) throw new Error(`删除 App 记录失败: ${error.message}`);
}

/** 创建或更新 App 记录（按 title 匹配则 upsert） */
export async function upsertAppRecord(
  projectName: string,
  indexPath: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("n3d_app_items")
    .select("id")
    .eq("title", projectName)
    .maybeSingle();

  const record = {
    title: projectName,
    description: "",
    thumbnail: "",
    index_path: indexPath,
    folder_path: "",
    sort_order: 0,
    is_published: true,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("n3d_app_items")
      .update(record)
      .eq("id", existing.id);

    if (error) throw new Error(`更新记录失败: ${error.message}`);
    return existing.id;
  } else {
    const { data, error } = await supabase
      .from("n3d_app_items")
      .insert({ ...record, created_at: new Date().toISOString() })
      .select("id")
      .single();

    if (error) throw new Error(`创建记录失败: ${error.message}`);
    return data.id;
  }
}
