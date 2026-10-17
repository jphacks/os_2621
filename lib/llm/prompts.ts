import fs from "fs/promises";
import path from "path";

const PROMPTS_DIR = path.join(process.cwd(), "prompts");
const COMMON_SAFETY_FILE = "_common_safety.md";

/**
 * prompts/*.md を読み込み、必要に応じて共通安全ルール（_common_safety.md）を先頭に連結し、
 * {{key}} 形式のプレースホルダーを置換して返す。
 */
export async function loadPrompt(
  promptName: string,
  variables?: Record<string, string | number>,
  options?: { includeCommonSafety?: boolean; promptsDir?: string }
): Promise<string> {
  const normalizedName = promptName.replace(/\.md$/, "");
  if (!/^[a-zA-Z0-9_-]+$/.test(normalizedName)) {
    throw new Error(`Invalid prompt name: ${promptName}`);
  }

  const baseDir = options?.promptsDir ?? PROMPTS_DIR;
  const includeCommon =
    options?.includeCommonSafety ?? normalizedName !== "_common_safety";

  const targetPath = path.join(baseDir, `${normalizedName}.md`);
  const promptBody = await fs.readFile(targetPath, "utf-8");

  let combined = promptBody.trim();

  if (includeCommon) {
    const commonPath = path.join(baseDir, COMMON_SAFETY_FILE);
    try {
      const commonSafety = await fs.readFile(commonPath, "utf-8");
      if (commonSafety.trim()) {
        combined = `${commonSafety.trim()}\n\n${combined}`;
      }
    } catch {
      // _common_safety.md が未作成の場合はスキップ
    }
  }

  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      combined = combined.replaceAll(`{{${key}}}`, String(value));
    }
  }

  return combined;
}
