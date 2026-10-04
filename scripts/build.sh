#!/usr/bin/env bash
# @yfwu2020/dsh-recent-sessions 构建脚本
#
#   ① 依赖：本包 node_modules（npm i 装齐 devDependencies + 自动落 peerDependencies）
#   ② host 半：src/index.ts + src/client/index.ts → lib/（tsc，产出 .js + .d.ts）
#   ③ client 半：tsdown 打成 lib/client.js（ModuleLoader.load 工厂格式）
#
# 不依赖 DSH 源码 checkout：peerDependencies 走公开 npm，
# 所以任何机器 `npm i && bash scripts/build.sh` 都能构建。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -d node_modules/typescript ]; then
  echo "=== 依赖缺失，先 npm i ===" >&2
  npm install --no-audit --no-fund
fi

echo "=== tsc $(node_modules/.bin/tsc -v) ==="
# ⚠️ 必须检查退出码：裸调用时类型错误只打印不中断，会打出"构建完成"的假绿灯。
node_modules/.bin/tsc -p tsconfig.json || { echo "build: 类型检查未通过，已中止" >&2; exit 1; }

echo "=== client bundle：src/client/index.ts → lib/client.js（tsdown）==="
node_modules/.bin/tsdown

echo "=== 构建完成 ==="
ls -l lib
