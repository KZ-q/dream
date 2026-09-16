#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 dist/workshop 纯静态作品站打包成单文件 HTML（内联 CSS/JS + 内嵌 content.json），
   生成的文件放在 dist/workshop/ 内，与 assets/ 同目录，file:// 双击即可打开，也能直接上传给 ChatGPT。"""
import os, re, json

BASE = os.path.join(os.path.dirname(__file__), "dist", "workshop")
OUT  = os.path.join(BASE, "kongzhuqi-portfolio.html")

html    = open(os.path.join(BASE, "index.html"), encoding="utf-8").read()
css     = open(os.path.join(BASE, "css", "style.css"), encoding="utf-8").read()
js      = open(os.path.join(BASE, "js", "main.js"), encoding="utf-8").read()
content = open(os.path.join(BASE, "content.json"), encoding="utf-8").read()

# content.json 安全嵌入：转义可能的 </script>
safe_content = content.replace("</", "<\\/")

# 1) 内联样式表
# 注意：必须用 lambda 作为替换，str 替换串会被 re.sub 当作转义处理而破坏内容
html = re.sub(r'<link\s+rel="stylesheet"[^>]*href="css/style\.css"[^>]*/?>',
              lambda m: "<style>\n" + css + "\n</style>", html, count=1)

# 2) fetch 垫片：让 file:// 下无需网络也能读到 content.json
shim = (
    "<script>\n"
    "window.__SITE_CONTENT__ = " + safe_content + ";\n"
    "(function(){\n"
    "  var __orig = window.fetch ? window.fetch.bind(window) : null;\n"
    "  window.fetch = function(u, o){\n"
    "    if (typeof u === 'string' && u.indexOf('content.json') !== -1) {\n"
    "      return Promise.resolve(new Response(JSON.stringify(window.__SITE_CONTENT__), {headers:{'Content-Type':'application/json'}}));\n"
    "    }\n"
    "    return __orig ? __orig(u, o) : Promise.reject(new Error('no fetch'));\n"
    "  };\n"
    "})();\n"
    "</script>\n"
)

# 3) 内联主脚本（替换外链 <script src="js/main.js"></script>）
html = re.sub(r'<script\s+src="js/main\.js"[^>]*></script>',
              lambda m: shim + "<script>\n" + js + "\n</script>", html, count=1)

with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)

print("✔ 单文件已生成:", OUT)
print("   大小: %.1f KB" % (os.path.getsize(OUT) / 1024))
# 自检：关键片段是否都在
for tok in ["<style>", "window.__SITE_CONTENT__", "bgm-breathing.mp3", "assets/images/cover-dongri.jpg"]:
    print(("   ✔" if tok in html else "   �’ 缺失: ") + tok)
