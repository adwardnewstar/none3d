-- ============================================================
-- 超级管理员表 - 在 Supabase SQL Editor 中运行此脚本
-- 打开 https://supabase.com/dashboard/project/zwnluqynchoidpiittdp/sql/new
-- ============================================================

-- 1. 创建管理员表
CREATE TABLE IF NOT EXISTS public.n3d_admin_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 插入超级管理员（452363508@qq.com）
INSERT INTO public.n3d_admin_users (email) VALUES ('452363508@qq.com')
ON CONFLICT (email) DO NOTHING;

-- 3. 启用行级安全
ALTER TABLE public.n3d_admin_users ENABLE ROW LEVEL SECURITY;

-- 4. 允许所有已登录用户查询（前端需要读取此表判断管理员身份）
CREATE POLICY "authenticated can read n3d_admin_users"
  ON public.n3d_admin_users
  FOR SELECT
  TO authenticated
  USING (true);

-- 5. 验证
SELECT * FROM public.n3d_admin_users;
