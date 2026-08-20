// 纯前端 HTML 压缩：不引入任何运行时依赖，复用项目已有的 esbuild 来压缩内联 <script>(JS) 与 <style>(CSS)。
// 同时去除 HTML 注释、折叠标签间的多余空白（保留 <pre>/<textarea> 内的内容、保留属性值）。
//
// 为什么不用通用 HTML minifier：本项目前端是巨型手写的纯 JS 应用（约 300KB），通用 minifier 对
// 内联 JS 的处理不如 esbuild 稳妥；esbuild 已经是 @songloft/plugin-builder 的依赖，零额外安装。
import { transformSync } from 'esbuild';

// 是否在受保护区域（pre/textarea）内 —— 这些块内的空白必须原样保留
function isProtected(tagName) {
  return tagName === 'pre' || tagName === 'textarea';
}

// 折叠一段纯文本节点的空白：多个空白合并成一个空格，并去掉首尾空白。
// 注意：不在此破坏 <pre>/<textarea> 的内容（调用方已跳过）。
function collapseWs(text) {
  return text.replace(/\s+/g, ' ').trim();
}

// esbuild 的 loader 名是 js / css，不是 script / style
function minifyBlock(type, content) {
  if (!content.trim()) return content;
  const loader = type === 'script' ? 'js' : 'css';
  try {
    // esbuild 默认 minify 不会重命名顶层声明（onclick="fn()" 仍可用），只压缩局部变量、去注释、去空白
    const r = transformSync(content, { loader, minify: true });
    return r.code;
  } catch (e) {
    console.warn(`  ⚠ ${type} 压缩失败，保留原样：${e && e.message ? e.message : e}`);
    return content;
  }
}

export function minifyHtml(html) {
  let out = '';
  let i = 0;
  const n = html.length;
  let protectedDepth = 0; // 进入 pre/textarea 后计数，避免其内部的 < 被当标签

  while (i < n) {
    // ---- HTML 注释（保留 <!DOCTYPE）----
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      if (end === -1) { out += html.slice(i); break; }
      i = end + 3;
      continue;
    }

    // ---- 标签 ----
    if (html[i] === '<' && protectedDepth === 0) {
      const gt = html.indexOf('>', i);
      if (gt === -1) { out += html.slice(i); break; }
      const tagText = html.slice(i, gt + 1);

      // <script> / <style>：压缩内部内容
      const open = tagText.match(/^<(script|style)\b/i);
      if (open) {
        const tagName = open[1].toLowerCase();
        const closeTag = `</${tagName}>`;
        const ci = html.indexOf(closeTag, gt + 1);
        if (ci === -1) { out += html.slice(i); break; }
        const content = html.slice(gt + 1, ci);
        out += `${tagText}${minifyBlock(tagName, content)}${closeTag}`;
        i = ci + closeTag.length;
        continue;
      }

      // <pre>/<textarea>：进入保护区域
      const prot = tagText.match(/^<(pre|textarea)\b/i);
      if (prot) protectedDepth++;

      // 自闭合的 pre/textarea（极少见）需回退深度
      if (prot && /\/>\s*$/.test(tagText)) protectedDepth = Math.max(0, protectedDepth - 1);

      out += tagText;
      i = gt + 1;
      continue;
    }

    // ---- 文本节点 ----
    const lt = html.indexOf('<', i);
    const text = lt === -1 ? html.slice(i) : html.slice(i, lt);
    if (protectedDepth > 0) {
      out += text; // 保护区域内原样保留
    } else {
      out += collapseWs(text);
    }
    i = lt === -1 ? n : lt;
  }

  return out;
}
