#!/usr/bin/env bash
# 生成可直接部署到 EdgeOne Pages 的 dist 目录
set -e
cd "$(dirname "$0")"
rm -rf dist
mkdir -p dist/functions/api dist/data
cp index.html admin.html package.json edgeone.json dist/
cp data/apps.json dist/data/
cp functions/api/login.js functions/api/apps.js dist/functions/api/
mkdir -p dist/node-functions/api
cp node-functions/api/*.js dist/node-functions/api/
echo "✅ dist 已生成（$(du -sh dist | cut -f1)）"
