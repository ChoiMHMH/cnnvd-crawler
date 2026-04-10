import { defineConfig } from "vite";
import { resolve } from "path";

/**
 * Chrome 확장프로그램 빌드 설정.
 * content script, background, offscreen 각각을 별도 IIFE 번들로 출력한다.
 * Rollup의 IIFE format은 multiple inputs를 지원하지 않으므로
 * 각 entry를 개별 빌드로 처리한다.
 */

const entries = ["content", "background", "offscreen"] as const;
const target = process.env.ENTRY;

if (target && !entries.includes(target as (typeof entries)[number])) {
  throw new Error(`Unknown ENTRY: ${target}. Must be one of: ${entries.join(", ")}`);
}

const entryName = (target ?? "content") as (typeof entries)[number];

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: !target,
    rollupOptions: {
      input: resolve(__dirname, `src/${entryName}.ts`),
      output: {
        entryFileNames: `${entryName}.js`,
        format: "iife",
      },
    },
    target: "es2022",
    minify: false,
  },
});
