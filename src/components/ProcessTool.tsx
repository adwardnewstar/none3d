import { useState } from "react";
import JSZip from "jszip";
import {
  X,
  FolderOpen,
  Download,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  processHtml,
  processCss,
  processJs,
  categorizeFile,
  shouldSkip,
  MARKER_DRAG_JS,
  ANNOTATION_JS,
} from "@/utils/verge3d-processor";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FileEntry {
  /** 在 zip 中的相对路径，如 "assets/textures/tex.png" */
  zipPath: string;
  file: File;
}

type Status = "idle" | "selected" | "processing" | "done" | "error";

/** 是否 png/jpg 图片文件 */
function isImage(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "png" || ext === "jpg";
}

async function walkDir(
  dirHandle: FileSystemDirectoryHandle,
  prefix: string,
  result: FileEntry[],
): Promise<void> {
  for await (const entry of (dirHandle as any).values()) {
    if (entry.kind === "directory") {
      // 跳过整个目录（media/、v3d_app_data/）
      // 注意：不传 excludeImages，避免跳过 png/jpg 目录
      if (shouldSkip(entry.name, true)) continue;
      await walkDir(
        entry as FileSystemDirectoryHandle,
        `${prefix}${entry.name}/`,
        result,
      );
    } else {
      const file = await (entry as FileSystemFileHandle).getFile();
      const zipPath = `${prefix}${entry.name}`;
      // 只跳过非图片的 skip 类别（blend/xml/bin/hdr/gltf/media 目录内的）
      const cat = categorizeFile(zipPath, true);
      if (cat === "skip" && !isImage(zipPath)) continue;
      result.push({ zipPath, file });
    }
  }
}

export default function ProcessTool({ open, onClose }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [projectName, setProjectName] = useState("");
  const [excludedSet, setExcludedSet] = useState<Set<string>>(new Set());

  const reset = () => {
    setEntries([]);
    setExcludedSet(new Set());
    setStatus("idle");
    setMessage("");
    setProjectName("");
  };

  const handleSelectFolder = async () => {
    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker();
      setStatus("processing");
      setMessage("正在读取文件...");

      const list: FileEntry[] = [];
      await walkDir(dirHandle, "", list);

      if (list.length === 0) {
        setStatus("idle");
        setMessage("未找到需要处理的文件");
        return;
      }

      setProjectName(dirHandle.name);
      list.sort((a, b) => a.zipPath.localeCompare(b.zipPath));

      // 默认将所有 png/jpg 加入排除列表
      const initialExcluded = new Set<string>();
      for (const e of list) {
        if (isImage(e.zipPath)) initialExcluded.add(e.zipPath);
      }
      setExcludedSet(initialExcluded);
      setEntries(list);
      setStatus("selected");
      setMessage(`选中 ${list.length} 个文件`);
    } catch (e: any) {
      if (
        e.name === "AbortError" ||
        e.message?.includes("abort") ||
        e.message?.includes("dismissed")
      ) {
        setStatus("idle");
        return;
      }
      setStatus("error");
      setMessage(`选择文件夹失败：${e.message}`);
    }
  };

  const toggleExclude = (path: string) => {
    setExcludedSet((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleProcess = async () => {
    if (entries.length === 0) return;
    setStatus("processing");
    setMessage("正在处理...");

    try {
      const zip = new JSZip();
      let processed = 0;
      const skipped: string[] = [];

      for (const entry of entries) {
        // 跳过用户勾选的图片
        if (excludedSet.has(entry.zipPath)) {
          skipped.push(entry.zipPath);
          continue;
        }

        const isRootLevel = !entry.zipPath.includes("/");
        const cat = categorizeFile(entry.zipPath, true);

        // 只在根目录的文件才做处理（匹配 BAT 行为），子目录文件原样复制
        if (isRootLevel && cat === "html") {
          const html = await entry.file.text();
          zip.file(entry.zipPath, processHtml(html, projectName));
        } else if (isRootLevel && cat === "css") {
          const css = await entry.file.text();
          zip.file(entry.zipPath, processCss(css));
        } else if (isRootLevel && cat === "js") {
          const js = await entry.file.text();
          zip.file(entry.zipPath, processJs(js));
        } else {
          // 其他文件（含子目录内所有文件）原样复制
          zip.file(
            entry.zipPath,
            new Uint8Array(await entry.file.arrayBuffer()),
          );
        }
        processed++;
      }

      // 注入共用文件
      zip.file("marker-drag.js", MARKER_DRAG_JS);
      zip.file("annotation.js", ANNOTATION_JS);
      processed += 2;

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName}-processed.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const skipCount = skipped.length;
      const skipNote = skipCount > 0 ? `（已排除 ${skipCount} 张图片）` : "";
      setStatus("done");
      setMessage(`处理完成！共 ${processed} 个文件${skipNote}`);
    } catch (err: any) {
      setStatus("error");
      setMessage(`处理失败：${err.message}`);
    }
  };

  if (!open) return null;

  const imageFiles = entries.filter((e) => isImage(e.zipPath));
  const nonImageFiles = entries.filter((e) => !isImage(e.zipPath));
  const excludedCount = excludedSet.size;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && status !== "processing") onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-[10px] border-2 border-[var(--border-card)] bg-[var(--bg-card)] p-6 shadow-xl">
        {/* 头部 */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            Verge3D 项目处理工具
          </h3>
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={status === "processing"}
            className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-btn)] hover:text-white disabled:opacity-30"
          >
            <X size={16} />
          </button>
        </div>

        {/* 选择文件夹 */}
        {status === "idle" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <button
              onClick={handleSelectFolder}
              className="flex items-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-btn)] bg-[var(--bg-input)] px-8 py-6 text-sm text-[var(--text-btn)] transition-all hover:border-[var(--border-btn-hover)] hover:bg-[var(--bg-btn)]"
            >
              <FolderOpen size={20} />
              选择 Verge3D 项目文件夹
            </button>
            <p className="text-xs text-[var(--text-muted)]">
              选择项目根目录（包含 .html、.js、.css 等文件）
            </p>
          </div>
        )}

        {/* 文件列表 + 复选 */}
        {status === "selected" && (
          <>
            {/* 其他文件（非图片） */}
            <div className="mb-3">
              <div className="mb-1 text-xs text-[var(--text-muted)]">
                {nonImageFiles.length} 个其他文件（HTML/CSS/JS/KTX2 等）
              </div>
              <div className="max-h-24 overflow-y-auto rounded-lg bg-black/20 p-2 text-xs text-[var(--text-secondary)]">
                {nonImageFiles.slice(0, 30).map((e) => (
                  <div key={e.zipPath} className="truncate px-1 py-0.5">
                    📄 {e.zipPath}
                  </div>
                ))}
                {nonImageFiles.length > 30 && (
                  <div className="px-1 py-0.5 text-gray-600">
                    ...还有 {nonImageFiles.length - 30} 个
                  </div>
                )}
              </div>
            </div>

            {/* png/jpg 图片文件：逐个复选 */}
            {imageFiles.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>图片文件（{imageFiles.length} 个）</span>
                  <button
                    onClick={() => {
                      if (excludedSet.size === imageFiles.length) {
                        // 全部取消排除（全保留）
                        setExcludedSet(new Set());
                      } else {
                        // 全部排除
                        setExcludedSet(
                          new Set(imageFiles.map((e) => e.zipPath)),
                        );
                      }
                    }}
                    className="text-[var(--text-secondary)] hover:underline"
                  >
                    {excludedSet.size === imageFiles.length
                      ? "全部保留"
                      : "全部排除"}
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto rounded-lg bg-black/20 p-2">
                  {imageFiles.map((e) => {
                    const excluded = excludedSet.has(e.zipPath);
                    return (
                      <label
                        key={e.zipPath}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs transition-colors hover:bg-white/5"
                      >
                        <input
                          type="checkbox"
                          checked={excluded}
                          onChange={() => toggleExclude(e.zipPath)}
                          className="accent-white/30"
                        />
                        <span
                          className={`truncate flex-1 ${excluded ? "text-gray-600 line-through" : "text-[var(--text-btn)]"}`}
                        >
                          {e.zipPath}
                        </span>
                        <span className="text-gray-600">
                          {excluded ? "排除" : "保留"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* 状态 */}
        {message && (
          <div
            className={`mb-4 flex items-center gap-2 text-xs ${
              status === "done"
                ? "text-green-400"
                : status === "error"
                  ? "text-red-400"
                  : "text-[var(--text-btn)]"
            }`}
          >
            {status === "processing" && (
              <Loader2 size={14} className="animate-spin" />
            )}
            {status === "done" && <Check size={14} />}
            {status === "error" && <AlertCircle size={14} />}
            {message}
          </div>
        )}

        {/* 按钮 */}
        {status === "selected" && (
          <button
            onClick={handleProcess}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--bg-btn-hover)] py-2 text-sm font-medium text-[var(--text-primary)] transition-opacity hover:opacity-90"
          >
            <Download size={14} />
            处理并下载 ZIP
            {excludedCount > 0 && `（排除 ${excludedCount} 张图片）`}
          </button>
        )}

        {status === "done" && (
          <button
            onClick={reset}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-600 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Check size={14} />
            完成，继续处理下一个
          </button>
        )}

        {status === "error" && (
          <button
            onClick={() => setStatus("selected")}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-yellow-600 py-2 text-sm font-medium text-[var(--text-primary)] transition-opacity hover:opacity-90"
          >
            重试
          </button>
        )}
      </div>
    </div>
  );
}
