# 🚀 VC - 优选订阅生成器

简洁高效的节点解析与订阅生成工具，后端基于 Vercel Serverless Function 驱动。

---

### ⚡ 一键部署

点击下方按钮即可一键 Fork 并自动部署至 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ptus815/vc)

---

### 🌟 特性

* **多协议支持**：支持 `vless` / `trojan` / `vmess` / `ss` / `hysteria2` 等常用协议解析。
* **一键导入客户端**：支持 Shadowrocket、v2rayNG、Clash Meta、FlClash、Sing-box 等多平台客户端订阅快速导入与下载。
* **Cloudflare CDN 加速**：支持绑定自定义域名并开启小黄云（Proxied）进行国内直连加速。

---

### 🛠️ 自定义域名配置说明

1. 在 Vercel 项目后台的 **Settings** -> **Domains** 添加你的二级域名（例如 `ve.yourdomain.com`）。
2. 前往 Cloudflare 控制台，添加对应 `CNAME` 解析并开启**已代理（小黄云）**。
3. 务必将 Cloudflare 的 **SSL/TLS** 加密模式设置为 **Full** 或 **Full (Strict)**。