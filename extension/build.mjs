import { execSync } from "child_process";
import { cpSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const entries = ["content", "background", "offscreen"];

for (const entry of entries) {
  console.log(`\n[build] ${entry}.ts ...`);
  execSync(`npx vite build`, {
    cwd: __dirname,
    stdio: "inherit",
    env: { ...process.env, ENTRY: entry },
  });
}

// public 파일을 dist로 복사
const publicFiles = ["manifest.json", "offscreen.html", "icon48.png", "icon128.png"];
for (const file of publicFiles) {
  cpSync(resolve(__dirname, "public", file), resolve(__dirname, "dist", file));
}

console.log("\n[build] 완료 — dist/ 에 확장프로그램 로드 가능");
