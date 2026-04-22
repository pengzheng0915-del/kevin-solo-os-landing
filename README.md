# KEVIN SOLO-OS 落地页

> 一人企业操作系统的官方落地页 | 拒绝万元割韭菜，做知识的罗宾汉

## 📋 项目简介

这是 KEVIN SOLO-OS（一人企业操作系统）的产品落地页，采用极简黑白设计风格，用于展示产品核心价值、提供试看内容，并引流至付费平台。

**核心功能：**
- ✅ 响应式设计，完美适配移动端和桌面端
- ✅ 极简黑白配色，现代高端视觉风格
- ✅ 滚动动画效果，提升用户体验
- ✅ 多个 CTA 按钮，优化转化路径
- ✅ 免费试看内容展示
- ✅ 清晰的价值主张和定价展示

## 🚀 快速部署

### 方式一：Gitee Pages（推荐，国内访问快）

**步骤 1：注册 Gitee 账号**
1. 访问 [https://gitee.com](https://gitee.com) 注册账号
2. 完成实名认证（Gitee Pages 需要）

**步骤 2：创建仓库**
1. 登录后点击右上角 "+" → "新建仓库"
2. 仓库名称：`kevin-solo-os-landing`（或自定义）
3. 选择"公开"
4. 不要勾选"使用 Readme 文件初始化仓库"
5. 点击"创建"

**步骤 3：推送代码**
```bash
# 在项目目录下执行
cd kevin-solo-os-landing

# 初始化 Git（如果还没有初始化）
git init

# 添加所有文件
git add .

# 创建首次提交
git commit -m "Initial commit: KEVIN SOLO-OS landing page"

# 添加 Gitee 远程仓库（替换 YOUR_USERNAME 为你的用户名）
git remote add origin https://gitee.com/YOUR_USERNAME/kevin-solo-os-landing.git

# 推送到 Gitee
git branch -M main
git push -u origin main
```

**步骤 4：启用 Gitee Pages**
1. 进入你的仓库页面
2. 点击"服务" → "Gitee Pages"
3. 选择部署分支：`main`
4. 选择部署目录：`/`（根目录）
5. 点击"启动"

**步骤 5：访问你的网站**
- 网站地址：`https://YOUR_USERNAME.gitee.io/kevin-solo-os-landing`
- 首次部署需要等待几分钟

**更新网站：**
```bash
# 修改文件后
git add .
git commit -m "Update content"
git push

# 然后在 Gitee Pages 页面点击"更新"按钮
```

---

### 方式二：Vercel（国际化，自动部署）

**步骤 1：准备代码**
```bash
# 确保代码已提交到 Git
git init
git add .
git commit -m "Initial commit"
```

**步骤 2：部署到 Vercel**
1. 访问 [https://vercel.com](https://vercel.com) 注册账号
2. 点击"New Project"
3. 选择"Import Git Repository"或直接上传文件夹
4. 如果使用 GitHub/GitLab，授权并选择仓库
5. 项目设置保持默认即可
6. 点击"Deploy"

**步骤 3：获取访问链接**
- 部署完成后会自动生成链接：`https://your-project.vercel.app`
- 每次推送代码到 Git 仓库，Vercel 会自动重新部署

**绑定自定义域名（可选）：**
1. 在 Vercel 项目设置中点击"Domains"
2. 添加你的域名
3. 按照提示配置 DNS 记录

---

### 方式三：GitHub Pages

**步骤 1：创建 GitHub 仓库**
1. 访问 [https://github.com](https://github.com) 并登录
2. 点击右上角 "+" → "New repository"
3. 仓库名称：`kevin-solo-os-landing`
4. 选择"Public"
5. 点击"Create repository"

**步骤 2：推送代码**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kevin-solo-os-landing.git
git push -u origin main
```

**步骤 3：启用 GitHub Pages**
1. 进入仓库页面
2. 点击"Settings" → "Pages"
3. Source 选择：`main` 分支，`/`（root）目录
4. 点击"Save"

**步骤 4：访问网站**
- 网站地址：`https://YOUR_USERNAME.github.io/kevin-solo-os-landing`

---

## 🎨 自定义内容

### 修改文字内容
编辑 `index.html` 文件，找到对应的文字部分进行修改：

```html
<!-- 例如修改标题 -->
<h1 class="hero-title">KEVIN<br>SOLO-OS</h1>

<!-- 修改价格 -->
<span class="price-amount">¥99</span>
```

### 修改 CTA 链接
将所有 `https://paywall-platform.vercel.app/` 替换为你的实际付费平台链接：

```html
<a href="你的付费平台链接" class="cta-button" target="_blank">立即开始 →</a>
```

### 修改颜色
编辑 `css/style.css` 文件：

```css
/* 主色调（黑色） */
background-color: #000000;
color: #000000;

/* 如果想改成其他颜色，全局替换即可 */
/* 例如改成深蓝色：#1a1a2e */
```

### 添加图片
1. 在项目根目录创建 `images/` 文件夹
2. 将图片放入该文件夹
3. 在 HTML 中引用：
```html
<img src="images/your-image.jpg" alt="描述">
```

### 修改试看内容
编辑 `index.html` 中的 `preview-content` 部分，替换为你的实际内容。

---

## 📁 文件结构

```
kevin-solo-os-landing/
├── index.html          # 主页面（包含所有内容结构）
├── css/
│   └── style.css      # 样式文件（黑白极简设计）
├── js/
│   └── script.js      # 交互脚本（滚动动画、CTA 追踪）
├── .gitignore         # Git 忽略文件
└── README.md          # 项目说明文档（本文件）
```

---

## 🛠️ 技术栈

- **HTML5** - 语义化标签，SEO 友好
- **CSS3** - 响应式设计，Grid/Flexbox 布局
- **Vanilla JavaScript** - 原生 JS，无外部依赖
- **Intersection Observer API** - 高性能滚动动画

**特点：**
- ✅ 零依赖，加载速度快
- ✅ 完全响应式，移动端优先
- ✅ 现代浏览器兼容（Chrome, Firefox, Safari, Edge）
- ✅ SEO 优化，搜索引擎友好

---

## 📊 性能优化建议

1. **图片优化**（如果添加图片）
   - 使用 WebP 格式
   - 压缩图片大小
   - 使用懒加载

2. **CDN 加速**
   - 使用 Cloudflare 等 CDN 服务
   - 提升全球访问速度

3. **分析工具集成**
   - 在 `js/script.js` 中添加 Google Analytics 或百度统计代码
   - 追踪 CTA 点击转化率

---

## 🔧 常见问题

**Q: Gitee Pages 更新后网站没变化？**  
A: 需要在 Gitee Pages 页面手动点击"更新"按钮。

**Q: 想绑定自定义域名怎么办？**  
A: 
- Gitee Pages：需要 Gitee Pages Pro（付费）
- Vercel/Netlify：免费支持自定义域名
- 国内域名需要 ICP 备案

**Q: 如何添加更多页面？**  
A: 创建新的 HTML 文件（如 `about.html`），并在导航中添加链接。

**Q: 可以添加表单收集用户信息吗？**  
A: 可以，推荐使用：
- 金数据（国内）
- Typeform（国际）
- 或自建后端 API

---

## 📞 技术支持

如有问题或需要定制开发，请联系：
- 付费平台：https://paywall-platform.vercel.app/

---

## 📄 许可证

本项目代码可自由使用和修改。

---

**祝你的一人企业蓬勃发展！🚀**
