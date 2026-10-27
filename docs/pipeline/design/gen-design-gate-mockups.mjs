// Design-gate high-fidelity mockup generator (v1.2.83, round 11)
// Pure string templates -> SVG. No external deps.
// Render: FONTCONFIG_FILE=/tmp/fonts/fonts.conf NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules \
//   node -e "require('sharp')('x.svg',{density:144}).png().toFile('x.png')"
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.env.OUT || '/tmp/mock'
mkdirSync(OUT, { recursive: true })

const F = 'Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
const C = {
  canvas: '#F8FAFC', surface: '#FFFFFF', surface2: '#F1F5F9', surface3: '#E8EDF5',
  line: '#E2E8F0', line2: '#CBD5E1', field: '#7C8A9E',
  ink: '#0F172A', ink2: '#475569', ink3: '#64748B', ink4: '#94A3B8',
  brand: '#2563EB', brand2: '#1D4ED8', brandSoft: '#EFF6FF', brandLine: '#BFDBFE',
  ok: '#15803D', okSoft: '#ECFDF5', okBorder: '#A7F3D0', okDot: '#16A34A',
  warn: '#B45309', warnDeep: '#92400E', warnSoft: '#FFFBEB', warnFill: '#FEF3C7', warnBorder: '#FDE68A', warnDot: '#D97706',
  err: '#B91C1C', errSoft: '#FEF2F2', errBorder: '#FECACA',
  hero0: '#1D3E8F', hero1: '#0B1220', heroBlue: '#60A5FA', heroLink: '#93C5FD',
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function text(x, y, str, o = {}) {
  const {
    size = 12, weight = 400, fill = C.ink, anchor = 'start', ls = 0,
    opacity = 1, family = F, italic = false, baseline = 'auto',
  } = o
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${ls}"` : ''}${opacity !== 1 ? ` fill-opacity="${opacity}"` : ''}${italic ? ' font-style="italic"' : ''}${baseline !== 'auto' ? ` dominant-baseline="${baseline}"` : ''}>${esc(str)}</text>`
}
function lines(x, y, arr, o = {}) {
  const { lh = 16, ...rest } = o
  return arr.map((s, i) => text(x, y + i * lh, s, rest)).join('')
}
function rect(x, y, w, h, o = {}) {
  const { rx = 0, fill = 'none', stroke = 'none', sw = 1, opacity = 1, dash, filter } = o
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ''} fill="${fill}"${stroke !== 'none' ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}${dash ? ` stroke-dasharray="${dash}"` : ''}${opacity !== 1 ? ` fill-opacity="${opacity}"` : ''}${filter ? ` filter="url(#${filter})"` : ''}/>`
}
function circle(cx, cy, r, o = {}) {
  const { fill = 'none', stroke = 'none', sw = 1, opacity = 1 } = o
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${stroke !== 'none' ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}${opacity !== 1 ? ` fill-opacity="${opacity}"` : ''}/>`
}
function path(d, o = {}) {
  const { fill = 'none', stroke = C.ink, sw = 1.6, cap = 'round', join = 'round', opacity = 1 } = o
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="${cap}" stroke-linejoin="${join}"${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`
}
function pill(x, y, w, h, label, o = {}) {
  const { fg = C.ink2, bg = C.surface2, border = 'none', size = 10, weight = 600 } = o
  return rect(x, y, w, h, { rx: h / 2, fill: bg, stroke: border, sw: 1 }) +
    text(x + w / 2, y + h / 2 + size * 0.36, label, { size, weight, fill: fg, anchor: 'middle' })
}
function btn(x, y, w, h, label, o = {}) {
  const {
    kind = 'secondary', icon = '', size = 12, weight = 600, rx = 9,
  } = o
  const kinds = {
    primary: { fill: C.brand, stroke: 'none', fg: '#FFFFFF' },
    dark: { fill: C.ink, stroke: 'none', fg: '#FFFFFF' },
    secondary: { fill: C.surface, stroke: C.line2, fg: C.ink2 },
    ghost: { fill: 'none', stroke: 'none', fg: C.ink2 },
    ok: { fill: C.okSoft, stroke: C.okBorder, fg: C.ok },
    danger: { fill: C.surface, stroke: C.errBorder, fg: C.err },
    dangerSolid: { fill: C.err, stroke: 'none', fg: '#FFFFFF' },
    warn: { fill: C.warnSoft, stroke: C.warnBorder, fg: C.warnDeep },
    heroWhite: { fill: '#FFFFFF', stroke: 'none', fg: C.hero1 },
    heroGhost: { fill: 'none', stroke: 'rgba(255,255,255,0.28)', fg: '#FFFFFF' },
  }
  const k = kinds[kind] || kinds.secondary
  const labelW = label.length * (size * 0.98) * (weight >= 600 ? 1 : 0.98)
  const iconW = icon ? 16 : 0
  const totalW = iconW + (label ? labelW + (icon ? 6 : 0) : 0)
  const startX = x + (w - totalW) / 2
  let out = rect(x, y, w, h, { rx, fill: k.fill, stroke: k.stroke, sw: 1 })
  if (icon) out += iconGlyph(icon, startX, y + h / 2 - 8, 16, k.fg)
  const tx = startX + iconW + (icon ? 6 : 0)
  if (label) out += text(tx, y + h / 2 + size * 0.36, label, { size, weight, fill: k.fg })
  return out
}

const ICONS = {
  eye: (s = 1) => `<path d="M2 8c2.2-3.3 5-5 8-5s5.8 1.7 8 5c-2.2 3.3-5 5-8 5S4.2 11.3 2 8Z" transform="scale(${s})" /><circle cx="10" cy="8" r="3" transform="scale(${s})"/>`,
  code: () => '<path d="M6.5 4.5 2.5 8l4 3.5M13.5 4.5 17.5 8l-4 3.5"/>',
  close: () => '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>',
  check: () => '<path d="M3 8.5 6.5 12 13 5"/>',
  play: () => '<path d="M5.5 3.5 13 8l-7.5 4.5V3.5Z" fill="currentColor" stroke="none"/>',
  lock: () => '<rect x="4" y="7" width="8" height="6" rx="1.4"/><path d="M6 7V5.4a2 2 0 0 1 4 0V7"/>',
  warn: () => '<path d="M8 2.4 15 14H1L8 2.4Z"/><path d="M8 6.6v3.2M8 12v.2"/>',
  image: () => '<rect x="2.4" y="3.2" width="11.2" height="9.6" rx="1.4"/><path d="M2.8 10.4 6 7.4l2.4 2.2 2-1.8 3 2.8"/><circle cx="5.6" cy="6" r="1"/>',
  external: () => '<path d="M7.5 3.5h5v5M12.5 3.5 7 9M11 11.5H4.5v-6"/>',
  refresh: () => '<path d="M13.5 4.8A5.6 5.6 0 1 0 14 10M13.7 2.6v2.6h-2.6"/>',
  grid: () => '<rect x="2.5" y="2.5" width="4.6" height="4.6" rx="1"/><rect x="8.9" y="2.5" width="4.6" height="4.6" rx="1"/><rect x="2.5" y="8.9" width="4.6" height="4.6" rx="1"/><rect x="8.9" y="8.9" width="4.6" height="4.6" rx="1"/>',
  more: () => '<circle cx="3.4" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="12.6" cy="8" r=".9" fill="currentColor" stroke="none"/>',
  file: () => '<path d="M4.2 2.5h5.2L12.8 6v7.5H4.2V2.5Z"/><path d="M9.2 2.6V6h3.4"/>',
  search: () => '<circle cx="7.2" cy="7.2" r="3.6"/><path d="M10 10 13.4 13.4"/>',
  flow: () => '<path d="M2.6 5h2.2v6H2.6zM6.9 3h2.2v10H6.9zM11.2 6.4h2.2v3.2h-2.2z"/>',
  inbox: () => '<path d="M2.5 4.5h11v7h-11z"/><path d="M2.7 9h3l1 1.4h2.6l1-1.4h3"/>',
  check2: () => '<rect x="2.6" y="2.6" width="10.8" height="10.8" rx="2.4"/><path d="M5.2 8.2 7.2 10.1l3.6-4"/>',
  task: () => '<rect x="2.8" y="2.8" width="10.4" height="10.4" rx="2.2"/><path d="M5.4 6.2h5.2M5.4 8.4h5.2M5.4 10.6h3"/>',
  git: () => '<circle cx="5" cy="3.6" r="1.5"/><circle cx="11" cy="12.2" r="1.5"/><circle cx="5" cy="12.2" r="1.5"/><path d="M5 5.1v5.6M5 7.6c0 2 2 2.2 3.6 2.6"/>',
  memory: () => '<rect x="2.6" y="3" width="10.8" height="10" rx="1.6"/><path d="M5.2 6h5.6M5.2 8.4h5.6M5.2 10.8h3.4"/>',
  back: () => '<path d="M9.5 3.5 5 8l4.5 4.5"/>',
  arrow: () => '<path d="M3 8h9M8.4 4.4 12 8l-3.6 3.6"/>',
  html: () => '<path d="M5.6 3.2 2.8 8l2.8 4.8M10.4 3.2 13.2 8l-2.8 4.8M9.1 2.8 6.9 13.2"/>',
  monitor: () => '<rect x="1.8" y="2.8" width="12.4" height="8" rx="1.4"/><path d="M6 13.4h4M8 10.9v2.5"/>',
  phone: () => '<rect x="4.4" y="1.8" width="7.2" height="12.4" rx="1.6"/><path d="M7.2 12.2h1.6"/>',
  tablet: () => '<rect x="2.6" y="1.9" width="10.8" height="12.2" rx="1.6"/><path d="M7.2 12.4h1.6"/>',
  close2: () => '<path d="M4 4l8 8M12 4l-8 8"/>',
  dot: () => '<circle cx="8" cy="8" r="3" fill="currentColor" stroke="none"/>',
}
function iconGlyph(name, x, y, size = 16, color = C.ink2) {
  const glyph = ICONS[name] || ICONS.dot
  return `<g transform="translate(${x} ${y}) scale(${size / 16})" stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">${glyph()}</g>`
}

function defs(extra = '') {
  return `<defs>
  <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#1D3E8F"/><stop offset="0.58" stop-color="#0B1220"/><stop offset="1" stop-color="#13265A"/>
  </linearGradient>
  <radialGradient id="heroGlow" cx="0.22" cy="0" r="0.9">
    <stop offset="0" stop-color="#60A5FA" stop-opacity="0.34"/><stop offset="1" stop-color="#60A5FA" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="pageGlow" cx="0.08" cy="0" r="0.7">
    <stop offset="0" stop-color="#2563EB" stop-opacity="0.07"/><stop offset="1" stop-color="#2563EB" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="logo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B82F6"/><stop offset="1" stop-color="#1E40AF"/></linearGradient>
  <filter id="sh1" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0F172A" flood-opacity="0.07"/></filter>
  <filter id="sh2" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#0F172A" flood-opacity="0.16"/></filter>
  <filter id="sh3" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="24" stdDeviation="34" flood-color="#0F172A" flood-opacity="0.30"/></filter>
  ${extra}
</defs>`
}

/* ---------------- shared shell ---------------- */
function topbar(w, rightText) {
  return rect(0, 0, w, 48, { fill: C.surface }) +
    rect(0, 47, w, 1, { fill: C.line }) +
    rect(14, 13, 22, 22, { rx: 7, fill: 'url(#logo)' }) +
    path('M20 21.5v7M25 19.5v7M30 22.5v5', { stroke: '#FFFFFF', sw: 2 }) +
    text(46, 27, 'Dev Workspace', { size: 13, weight: 700, fill: C.ink }) +
    text(154, 27, '工作区 / dsh-web-filebrowser', { size: 11, fill: C.ink3 }) +
    text(w - 58, 26, rightText, { size: 11, fill: C.ink3, anchor: 'end' }) +
    circle(w - 26, 24, 12, { fill: '#DBEAFE' }) +
    text(w - 26, 28, '你', { size: 10.5, weight: 600, fill: C.brand, anchor: 'middle' })
}
function navbar(active) {
  const items = [
    ['工作台', 'grid'], ['文件', 'file'], ['搜索', 'search'], ['更多', 'more'],
  ]
  const project = [['流水线', 'flow'], ['验收', 'check2'], ['待办', 'inbox'], ['任务', 'task'], ['Git', 'git'], ['记忆', 'memory']]
  let out = rect(0, 48, 200, 976, { fill: C.canvas }) + rect(199, 48, 1, 976, { fill: C.line })
  out += text(16, 78, '工作区', { size: 10, weight: 700, fill: C.ink3, ls: 1 })
  let y = 90
  for (const [label, icon] of items) {
    const activeItem = active === label
    if (activeItem) out += rect(8, y, 184, 34, { rx: 8, fill: C.brandSoft })
    out += iconGlyph(icon, 18, y + 9, 16, activeItem ? C.brand : C.ink2)
    out += text(42, y + 22, label, { size: 12.5, weight: activeItem ? 600 : 400, fill: activeItem ? C.brand : C.ink2 })
    y += 34
  }
  y += 14
  out += text(16, y + 4, '项目', { size: 10, weight: 700, fill: C.ink3, ls: 1 })
  y += 16
  for (const [label, icon] of project) {
    const activeItem = active === label
    if (activeItem) {
      out += rect(8, y, 184, 34, { rx: 8, fill: C.brandSoft })
      out += rect(8, y + 9, 3, 16, { rx: 1.5, fill: C.brand })
    }
    out += iconGlyph(icon, 18, y + 9, 16, activeItem ? C.brand : C.ink2)
    out += text(42, y + 22, label, { size: 12.5, weight: activeItem ? 600 : 400, fill: activeItem ? C.brand : C.ink2 })
    y += 34
  }
  // team card
  out += rect(10, 914, 180, 84, { rx: 12, fill: C.surface, stroke: C.line, sw: 1 })
  out += circle(28, 936, 9, { fill: C.brandSoft })
  out += text(28, 940, '队', { size: 10, weight: 700, fill: C.brand, anchor: 'middle' })
  out += text(44, 934, '团队面板入口', { size: 11.5, weight: 700, fill: C.ink })
  out += text(44, 949, '6 个角色 · 2 执行中', { size: 9.5, fill: C.ink3 })
  out += text(28, 976, '打开团队面板 →', { size: 10.5, weight: 600, fill: C.brand })
  return out
}

/* ---------------- pipeline sidebar (D1) ---------------- */
function stageCard(y, h, idx, title, role, status, o = {}) {
  const st = {
    approved: { label: '已通过', fg: C.ok, bg: C.okSoft },
    review: { label: '待评审', fg: C.warn, bg: C.warnFill },
    active: { label: '进行中', fg: C.brand, bg: C.brandSoft },
    pending: { label: '待开始', fg: C.ink2, bg: C.surface2 },
    failed: { label: '已打回', fg: C.err, bg: C.errSoft },
  }[status]
  const isReview = status === 'review'
  let out = rect(208, y, 344, h, {
    rx: 7, fill: isReview ? '#FFFDF7' : C.surface,
    stroke: isReview ? C.warnBorder : C.line, sw: isReview ? 1.5 : 1,
  })
  const idxFill = { approved: C.okSoft, review: C.warnFill, active: C.brandSoft, pending: C.surface2, failed: C.errSoft }[status]
  const idxFg = { approved: C.ok, review: C.warnDeep, active: C.brand, pending: C.ink3, failed: C.err }[status]
  out += circle(224, y + 19, 8, { fill: idxFill })
  out += text(224, y + 22, idx, { size: 9, weight: 700, fill: idxFg, anchor: 'middle' })
  out += text(238, y + 17, title, { size: 11, weight: 700, fill: C.ink })
  out += text(238, y + 30, role, { size: 9, fill: C.ink3 })
  out += pill(490, y + 10, 48, 18, st.label, { fg: st.fg, bg: st.bg, size: 9 })
  return out
}

function miniShot(kind, x, y, w, h) {
  // mini design preview inside a 104x48 thumbnail
  let out = rect(x, y, w, h, { rx: 5, fill: '#F8FAFC' })
  if (kind === 'pipeline') {
    out += rect(x + 4, y + 4, w - 8, 8, { rx: 2, fill: C.ink })
    out += rect(x + 4, y + 4, w - 8, 8, { rx: 2, fill: '#0B1220', opacity: 0.9 })
    out += rect(x + 4, y + 15, 22, 26, { rx: 2, fill: C.surface, stroke: C.line, sw: 0.6 })
    out += rect(x + 29, y + 15, w - 33, 9, { rx: 2, fill: C.surface, stroke: C.line, sw: 0.6 })
    out += rect(x + 29, y + 27, w - 33, 14, { rx: 2, fill: C.warnSoft, stroke: C.warnBorder, sw: 0.6 })
    out += rect(x + 32, y + 30, 16, 2.4, { rx: 1.2, fill: C.warnDot })
    out += rect(x + 4, y + 43, 18, 2, { rx: 1, fill: C.line2 })
  } else if (kind === 'mobile') {
    out += rect(x + 34, y + 3, 36, 42, { rx: 5, fill: C.surface, stroke: C.ink3, sw: 1 })
    out += rect(x + 38, y + 8, 28, 10, { rx: 2, fill: '#0B1220' })
    out += rect(x + 38, y + 21, 28, 6, { rx: 2, fill: C.warnSoft, stroke: C.warnBorder, sw: 0.5 })
    out += rect(x + 38, y + 30, 28, 7, { rx: 2, fill: C.surface2 })
  } else {
    out += rect(x + 4, y + 4, w - 8, h - 8, { rx: 3, fill: '#FFFFFF', stroke: C.line, sw: 0.6 })
    out += rect(x + 8, y + 8, 30, 6, { rx: 2, fill: C.ink })
    out += rect(x + 8, y + 18, w - 16, 3, { rx: 1.5, fill: C.line2 })
    out += rect(x + 8, y + 24, w - 26, 3, { rx: 1.5, fill: C.line2 })
    out += rect(x + 8, y + 32, 26, 9, { rx: 2, fill: C.brand })
  }
  return out
}

function pipelinePane() {
  const X = 200, W = 360
  let out = rect(X, 48, W, 976, { fill: C.surface })
  out += rect(X + W - 1, 48, 1, 976, { fill: C.line })
  // toolbar
  out += text(212, 70, '流水线', { size: 12, weight: 700, fill: C.ink })
  out += pill(262, 56, 50, 18, '第 11 轮', { fg: C.ink2, bg: C.surface2, size: 9 })
  out += rect(398, 60, 13, 13, { rx: 3, fill: C.brand })
  out += path('M401 66.5l2.4 2.4 3.8-4.4', { stroke: '#FFFFFF', sw: 1.6 })
  out += text(416, 70, '快速模式', { size: 10, fill: C.ink2 })
  out += iconGlyph('refresh', 524, 58, 14, C.ink2)
  // review todo banner: text row + 44px approve/reject + note + hint
  out += rect(X, 84, W, 108, { fill: C.warnSoft })
  out += rect(X, 191, W, 1, { fill: C.warnBorder })
  out += circle(221, 104, 9, { fill: C.warnFill })
  out += text(221, 108, '!', { size: 10, weight: 700, fill: C.warnDeep, anchor: 'middle' })
  out += text(236, 102, '设计稿待你确认 · 确认后进入开发', { size: 11, weight: 700, fill: C.warnDeep })
  out += text(236, 119, '第 2 关 · UI 设计 · 3 个产物', { size: 9, fill: C.warn })
  out += btn(432, 90, 54, 44, '通过', { kind: 'primary', size: 10.5, rx: 8 })
  out += btn(492, 90, 54, 44, '打回', { kind: 'danger', size: 10.5, rx: 8 })
  out += rect(212, 142, 336, 32, { rx: 6, fill: C.surface, stroke: C.field, sw: 1 })
  out += text(220, 162, '评审备注（打回时可选）…', { size: 10, fill: C.ink3 })
  out += text(212, 186, '通过后开发才可启动；其余人工闸门不变。', { size: 9.5, fill: C.ink3 })
  // requirement
  out += rect(208, 202, 344, 70, { rx: 7, fill: '#F8FAFC', stroke: C.line, sw: 1 })
  out += text(216, 218, '需求', { size: 9, weight: 700, fill: C.ink3, ls: 1 })
  out += text(216, 235, '设计先确认：设计稿预览后才进开发', { size: 11.5, weight: 700, fill: C.ink })
  out += lines(216, 251, [
    'v1.2.83 · 第 11 轮：design 人工闸门 + 产物预览（图片 / HTML 三档）。',
  ], { size: 9.2, fill: C.ink2, lh: 14 })
  out += text(216, 265, '验收：设计 review、预览入口、.html 默认渲染预览。', { size: 9.2, fill: C.ink2 })
  // stages
  out += stageCard(280, 54, '1', '需求分析', '产品经理 Agent', 'approved')
  out += text(238, 326, '已完成需求与验收化，快速模式自动通过。', { size: 9, fill: C.ink3 })
  // design review card
  const y = 340
  out += stageCard(y, 320, '2', 'UI 设计', 'UI 设计师', 'review')
  out += lines(214, 391, [
    '设计确认闸门 + 设计稿预览：流水线卡 / 工作台卡待确认态、预览弹层、',
    'HTML 默认渲染预览；另含 3 张高保真稿。',
  ], { size: 10, fill: C.ink2, lh: 15 })
  out += rect(214, 418, 332, 46, { rx: 7, fill: C.warnSoft, stroke: C.warnBorder, sw: 1 })
  out += circle(227, 434, 8, { fill: C.warnFill })
  out += text(227, 437.5, '!', { size: 9, weight: 700, fill: C.warnDeep, anchor: 'middle' })
  out += text(242, 432, '设计稿待你确认 · 确认后进入开发', { size: 11, weight: 700, fill: C.warnDeep })
  out += text(242, 448, '通过后开发阶段才能启动；打回后设计变为「已打回」', { size: 9.5, fill: C.warn })
  // thumbnails
  const ty = 474
  out += rect(214, ty, 104, 48, { rx: 6, fill: C.surface, stroke: C.line, sw: 1 })
  out += miniShot('pipeline', 215, ty + 1, 102, 46)
  out += rect(324, ty, 104, 48, { rx: 6, fill: C.surface, stroke: C.line, sw: 1 })
  out += miniShot('mobile', 325, ty + 1, 102, 46)
  out += rect(434, ty, 104, 48, { rx: 6, fill: C.surface, stroke: C.brand, sw: 1.4 })
  out += miniShot('html', 435, ty + 1, 102, 46)
  out += circle(516, ty + 24, 10, { fill: C.brand })
  out += iconGlyph('eye', 508, ty + 16, 16, '#FFFFFF')
  out += text(214, ty + 61, '流水线卡 · 1440', { size: 8.5, fill: C.ink3 })
  out += text(324, ty + 61, '移动端 · 390', { size: 8.5, fill: C.ink3 })
  out += text(434, ty + 61, '高保真稿 · HTML 预览', { size: 8.5, weight: 600, fill: C.brand })
  // actions (44 high)
  out += btn(214, 546, 118, 44, '预览设计稿', { kind: 'primary', icon: 'eye', size: 11 })
  out += btn(340, 546, 56, 44, '通过', { kind: 'ok', icon: 'check', size: 11 })
  out += btn(402, 546, 56, 44, '打回', { kind: 'danger', size: 11 })
  out += text(546, 572, '3 个产物', { size: 9, fill: C.ink3, anchor: 'end' })
  out += rect(214, 598, 332, 32, { rx: 6, fill: C.surface, stroke: C.field, sw: 1 })
  out += text(222, 618, '打回原因（可选）：写清需要修改的地方…', { size: 9.5, fill: C.ink3 })
  out += lines(214, 641, ['点「预览设计稿」看大图 / HTML 渲染；', '宽度切换 360 / 768 / 1280。'], { size: 9, fill: C.ink3, lh: 11 })
  // dev blocked
  out += stageCard(668, 60, '3', '开发实现', '全栈开发', 'pending')
  out += iconGlyph('lock', 236, 699, 12, C.warn)
  out += text(252, 709, '必须等「UI 设计」approved 后才能开始（快速模式同样拦截）', { size: 9, fill: C.warn })
  // remaining
  out += stageCard(734, 44, '4', '测试验收', '测试工程师', 'pending')
  out += stageCard(784, 44, '5', '验收复核', '项目经理 Agent', 'pending')
  out += stageCard(834, 44, '6', '人工确认', '你（Owner）', 'pending')
  out += stageCard(884, 44, '7', '发布上线', '运维', 'pending')
  // fast-mode footer copy (D5)
  out += rect(208, 940, 344, 66, { rx: 7, fill: C.surface2, stroke: C.line, sw: 1 })
  out += iconGlyph('dot', 218, 952, 10, C.brand)
  out += text(232, 959, '快速模式：四个自动 / 三个需你确认', { size: 10, weight: 700, fill: C.ink })
  out += lines(218, 976, [
    'product/development/testing/acceptance 自动通过；',
    'design/approval/release 始终需要 Owner 确认。',
  ], { size: 9.5, fill: C.ink2, lh: 13 })
  return out
}

/* ---------------- workbench main (simplified) ---------------- */
function workbenchMain(x0, w, opts = {}) {
  const X = x0
  let out = rect(X, 48, w, 976, { fill: C.canvas })
  out += rect(X, 48, w, 976, { fill: 'url(#pageGlow)' })
  // page head
  out += text(X + 28, 92, '工作区 · dsh-web-filebrowser · 第 11 轮', { size: 10.5, weight: 600, fill: C.ink3, ls: 0.4 })
  out += text(X + 28, 136, '工作台', { size: 30, weight: 700, fill: C.ink })
  out += pill(X + 150, 104, 54, 22, '第 11 轮', { fg: C.ink2, bg: C.surface2, size: 10 })
  out += pill(X + 210, 104, 64, 22, '快速模式', { fg: C.ok, bg: C.okSoft, size: 10 })
  out += pill(X + 280, 104, 74, 22, '1/7 已通过', { fg: C.brand, bg: C.brandSoft, size: 10 })
  const ax = X + w - 28
  out += btn(ax - 332, 96, 60, 32, '刷新', { kind: 'secondary', size: 11 })
  out += btn(ax - 264, 96, 92, 32, '打开流水线', { kind: 'secondary', size: 11 })
  out += btn(ax - 164, 96, 60, 32, '团队', { kind: 'secondary', size: 11 })
  out += rect(ax - 96, 96, 32, 32, { rx: 8, fill: C.surface, stroke: C.line2, sw: 1 })
  out += circle(ax - 80, 112, 6, { stroke: C.ink2, sw: 1.5 })
  out += rect(ax - 56, 96, 32, 32, { rx: 8, fill: C.surface, stroke: C.line2, sw: 1 })
  out += iconGlyph('close', ax - 48, 104, 16, C.ink2)
  out += rect(X, 152, w, 1, { fill: C.line })
  // hero
  const hx = X + 28, hy = 168, hw = w - 56, hh = 268
  out += rect(hx, hy, hw, hh, { rx: 18, fill: 'url(#hero)' })
  out += rect(hx, hy, hw, hh, { rx: 18, fill: 'url(#heroGlow)' })
  out += text(hx + 28, hy + 34, 'STAGE 02 / 07 · 当前阶段', { size: 10.5, weight: 700, fill: '#FFFFFF', opacity: 0.56, ls: 1.6 })
  out += text(hx + 28, hy + 76, 'UI 设计', { size: 30, weight: 700, fill: '#FFFFFF' })
  out += rect(hx + 138, hy + 54, 62, 22, { rx: 11, fill: 'rgba(245,158,11,0.16)', stroke: 'rgba(252,211,77,0.48)', sw: 1 })
  out += text(hx + 169, hy + 69, '待评审', { size: 10, weight: 600, fill: '#FCD34D', anchor: 'middle' })
  out += text(hx + 28, hy + 110, '设计稿已提交：设计确认闸门 + 设计稿预览。', { size: 12.5, fill: '#FFFFFF', opacity: 0.76 })
  out += text(hx + 28, hy + 132, '等待你确认后进入开发阶段。', { size: 12.5, fill: '#FFFFFF', opacity: 0.76 })
  out += text(hx + 28, hy + 160, '负责：UI 设计师 · 第 11 轮 · 快速模式', { size: 11, fill: '#FFFFFF', opacity: 0.56 })
  // rail
  const railY = hy + 184, railW = hw - 300 - 56, gap = 8, segW = (railW - gap * 6) / 7
  const railColors = [C.okDot, C.warnDot, 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.18)']
  for (let i = 0; i < 7; i++) {
    out += rect(hx + 28 + i * (segW + gap), railY, segW, 6, { rx: 3, fill: railColors[i] })
  }
  const names = ['需求', '设计', '开发', '测试', '验收', '确认', '发布']
  for (let i = 0; i < 7; i++) {
    out += text(hx + 28 + i * (segW + gap), railY + 22, names[i], { size: 10, fill: '#FFFFFF', opacity: i === 1 ? 1 : 0.56, weight: i === 1 ? 600 : 400 })
  }
  out += text(hx + 28, railY + 50, '已通过 1 / 7 关 · 设计确认后进入开发；发布仍保持锁定', { size: 10.5, fill: '#FFFFFF', opacity: 0.56 })
  // hero right
  const rx = hx + hw - 28 - 300
  const ringCx = rx + 34, ringCy = hy + 66
  out += circle(ringCx, ringCy, 30, { stroke: 'rgba(255,255,255,0.16)', sw: 7 })
  out += path(`M ${ringCx} ${ringCy - 30} A 30 30 0 0 1 ${ringCx + 24.9} ${ringCy - 16.7}`, { stroke: C.heroBlue, sw: 7, cap: 'butt' })
  out += text(ringCx, ringCy + 5, '1/7', { size: 15, weight: 700, fill: '#FFFFFF', anchor: 'middle' })
  out += text(rx + 76, hy + 54, '已通过 1 关', { size: 13, weight: 700, fill: '#FFFFFF' })
  out += text(rx + 76, hy + 74, '当前第 2 关 · UI 设计', { size: 10.5, fill: '#FFFFFF', opacity: 0.56 })
  out += text(rx + 76, hy + 92, '门禁：你确认后解锁开发', { size: 10.5, fill: '#FFFFFF', opacity: 0.56 })
  out += btn(rx, hy + 112, 140, 44, '通过', { kind: 'heroWhite', size: 13, rx: 10 })
  out += btn(rx + 150, hy + 112, 150, 44, '打回', { kind: 'heroGhost', size: 13, rx: 10 })
  out += rect(rx, hy + 166, 300, 34, { rx: 10, fill: 'rgba(255,255,255,0.08)', stroke: 'rgba(255,255,255,0.16)', sw: 1 })
  out += text(rx + 12, hy + 188, '评审备注（打回时可选）', { size: 11, fill: '#FFFFFF', opacity: 0.56 })
  out += text(rx, hy + 226, '通过后进入开发；发布仍保持锁定', { size: 10.5, fill: '#FFFFFF', opacity: 0.5 })
  out += text(rx + 300, hy + 226, '预览设计稿 →', { size: 10.5, weight: 600, fill: C.heroLink, anchor: 'end' })
  // Now zone head
  let zy = 470
  out += rect(X + 28, zy, 3, 26, { rx: 1.5, fill: C.warnDot })
  out += text(X + 41, zy + 9, 'NOW', { size: 10, weight: 700, fill: C.ink3, ls: 1.2 })
  out += text(X + 41, zy + 25, '需要你决定的事', { size: 16, weight: 700, fill: C.ink })
  out += text(X + 176, zy + 22, '1 项待确认 · 设计稿需要你确认', { size: 12, fill: C.ink3 })
  out += text(ax, zy + 22, '查看任务 →', { size: 11.5, weight: 600, fill: C.brand, anchor: 'end' })
  // design attention card (workbench, compact)
  const cy = 512, cw = w - 56
  out += rect(X + 28, cy, cw, 152, { rx: 14, fill: C.surface, stroke: C.line, sw: 1, filter: 'sh1' })
  out += text(X + 48, cy + 26, '设计稿', { size: 14, weight: 700, fill: C.ink })
  out += pill(X + 104, cy + 13, 64, 20, '待你确认', { fg: C.warnDeep, bg: C.warnFill, border: C.warnBorder, size: 9.5 })
  out += text(X + 48 + cw - 20, cy + 27, '3 个产物', { size: 10.5, fill: C.ink3, anchor: 'end' })
  out += rect(X + 48, cy + 40, cw - 40, 34, { rx: 8, fill: C.warnSoft, stroke: C.warnBorder, sw: 1 })
  out += circle(X + 62, cy + 57, 8, { fill: C.warnFill })
  out += text(X + 62, cy + 60.5, '!', { size: 9, weight: 700, fill: C.warnDeep, anchor: 'middle' })
  out += text(X + 77, cy + 61, '设计稿待你确认 · 确认后进入开发', { size: 11.5, weight: 700, fill: C.warnDeep })
  out += btn(X + 48, cy + 82, 118, 44, '预览设计稿', { kind: 'primary', icon: 'eye', size: 11 })
  out += btn(X + 174, cy + 82, 62, 44, '通过', { kind: 'ok', icon: 'check', size: 11 })
  out += btn(X + 244, cy + 82, 62, 44, '打回', { kind: 'danger', size: 11 })
  out += rect(X + 320, cy + 82, cw - 340, 44, { rx: 8, fill: C.surface, stroke: C.field, sw: 1 })
  out += text(X + 330, cy + 109, '打回原因（可选）…', { size: 10, fill: C.ink3 })
  out += text(X + 48, cy + 142, 'HTML 高保真稿以 iframe 渲染（sandbox），支持 360 / 768 / 1280 三档。', { size: 9.5, fill: C.ink3 })
  // project zone
  zy = 704
  out += rect(X + 28, zy, 3, 26, { rx: 1.5, fill: C.brand })
  out += text(X + 41, zy + 9, 'PROJECT', { size: 10, weight: 700, fill: C.ink3, ls: 1.2 })
  out += text(X + 41, zy + 25, '项目与团队', { size: 16, weight: 700, fill: C.ink })
  out += text(ax, zy + 22, '查看流水线 →', { size: 11.5, weight: 600, fill: C.brand, anchor: 'end' })
  const py = 746
  out += rect(X + 28, py, 380, 156, { rx: 14, fill: C.surface, stroke: C.line, sw: 1, filter: 'sh1' })
  out += text(X + 46, py + 26, '项目状态', { size: 13, weight: 700, fill: C.ink })
  out += text(X + 46, py + 68, '1/7', { size: 32, weight: 700, fill: C.ink })
  out += text(X + 104, py + 68, '关已完成', { size: 11, fill: C.ink3 })
  out += rect(X + 46, py + 84, 340, 6, { rx: 3, fill: C.surface2 })
  out += rect(X + 46, py + 84, 48.5, 6, { rx: 3, fill: C.brand })
  out += text(X + 46, py + 116, '第 11 轮 · 快速模式 · 设计待确认', { size: 11, fill: C.ink2 })
  out += text(X + 46, py + 140, '打开需求 →', { size: 10.5, weight: 600, fill: C.brand })
  out += text(X + 390, py + 140, '查看流水线 →', { size: 10.5, weight: 600, fill: C.brand, anchor: 'end' })
  out += rect(X + 424, py, cw - 396, 156, { rx: 14, fill: C.surface, stroke: C.line, sw: 1, filter: 'sh1' })
  out += text(X + 442, py + 26, '需求与调整', { size: 13, weight: 700, fill: C.ink })
  out += text(X + 442, py + 50, '设计先确认：设计稿预览后才进开发', { size: 12, weight: 600, fill: C.ink })
  out += lines(X + 442, py + 72, [
    '第 11 轮：design 人工闸门、产物预览、.html 默认渲染；',
    '验收项 10 条由 testing 回填。',
  ], { size: 10.5, fill: C.ink2, lh: 17 })
  out += text(X + 442, py + 132, '查看需求 →', { size: 10.5, weight: 600, fill: C.brand })
  // delivery zone head + cut card
  zy = 932
  out += rect(X + 28, zy, 3, 26, { rx: 1.5, fill: C.okDot })
  out += text(X + 41, zy + 9, 'DELIVERY', { size: 10, weight: 700, fill: C.ink3, ls: 1.2 })
  out += text(X + 41, zy + 25, '交付', { size: 16, weight: 700, fill: C.ink })
  out += rect(X + 28, 970, cw, 150, { rx: 14, fill: C.surface, stroke: C.line, sw: 1, filter: 'sh1' })
  out += text(X + 46, 996, '交付前体检', { size: 13, weight: 700, fill: C.ink })
  out += pill(X + 168, 982, 48, 20, '通过', { fg: C.ok, bg: C.okSoft, size: 9.5 })
  out += circle(X + 56, 1024, 4, { fill: C.okDot })
  out += text(X + 68, 1028, '测试与构建：通过', { size: 11, fill: C.ink2 })
  out += circle(X + 56, 1046, 4, { fill: C.warnDot })
  out += text(X + 68, 1050, '变更审阅：1/3 已审', { size: 11, fill: C.ink2 })
  out += rect(X + 424, 970, cw - 396, 150, { rx: 14, fill: C.surface, stroke: C.line, sw: 1, filter: 'sh1' })
  out += text(X + 442, 996, '本轮变更', { size: 13, weight: 700, fill: C.ink })
  out += text(X + 442, 1024, 'client.js', { size: 11, fill: C.ink2 })
  return out
}



/* ---------------- mockup 1: pipeline review ---------------- */
function m1() {
  const w = 1440, h = 1024
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${defs()}
${rect(0, 0, w, h, { fill: C.canvas })}
${topbar(w, '设计确认闸门 · 第 11 轮')}
${navbar('流水线')}
${pipelinePane()}
${workbenchMain(560, 880)}

</svg>`
}



/* ================================================================== *
 * M2: design preview modal (D2)
 * ================================================================== */
function modalBackdrop(w, h) {
  return '<g filter="url(#bgb)" opacity="0.9">' + topbar(w, '设计确认闸门 · 第 11 轮') + navbar('流水线') + pipelinePane() + workbenchMain(560, 880) + '</g>' +
    rect(0, 0, w, h, { fill: '#0F172A', opacity: 0.52 })
}
function modalHeader() {
  let out = rect(100, 100, 1240, 800, { rx: 16, fill: C.surface, stroke: C.line2, sw: 1, filter: 'sh3' })
  out += text(124, 132, '设计稿预览', { size: 20, weight: 700, fill: C.ink })
  out += pill(248, 114, 62, 22, '待评审', { fg: C.warnDeep, bg: C.warnFill, border: C.warnBorder, size: 10 })
  out += text(124, 156, '第 11 轮 · UI 设计 · 提交于 10:42 · 3 个产物', { size: 12, fill: C.ink3 })
  out += rect(1272, 110, 44, 44, { rx: 10, fill: C.surface2 })
  out += iconGlyph('close', 1286, 124, 16, C.ink2)
  out += rect(124, 172, 1192, 32, { rx: 8, fill: C.warnSoft, stroke: C.warnBorder, sw: 1 })
  out += circle(140, 188, 8, { fill: C.warnFill })
  out += text(140, 191.5, '!', { size: 9, weight: 700, fill: C.warnDeep, anchor: 'middle' })
  out += text(156, 192, '设计稿待你确认 · 确认后进入开发', { size: 12, weight: 700, fill: C.warnDeep })
  out += text(1300, 192, '3 个产物 · 图片 2 / HTML 1 · 通过后解锁开发', { size: 10, fill: C.warn, anchor: 'end' })
  return out
}
function artifactTab(x, w, icon, label, selected) {
  let out = rect(x, 213, w, 36, {
    rx: 8, fill: selected ? C.surface : 'none',
    stroke: selected ? C.brand : C.line, sw: selected ? 1.4 : 1,
    filter: selected ? 'sh1' : undefined,
  })
  out += iconGlyph(icon, x + 12, 223, 16, selected ? C.brand : C.ink2)
  out += text(x + 34, 236, label, { size: 12, weight: selected ? 700 : 400, fill: selected ? C.ink : C.ink2 })
  return out
}
function deviceSwitch() {
  let out = text(938, 235, '预览宽度', { size: 11, fill: C.ink3 })
  out += rect(996, 214, 210, 32, { rx: 8, fill: C.surface3, stroke: C.field, sw: 1 })
  const opts = [['360', 998, 68], ['768', 1068, 68], ['1280', 1138, 66]]
  for (const [label, x, w] of opts) {
    const on = label === '768'
    if (on) out += rect(x, 216, w, 28, { rx: 6, fill: C.surface, stroke: C.line2, sw: 1, filter: 'sh1' })
    out += text(x + w / 2, 235, label, { size: 11, weight: on ? 700 : 400, fill: on ? C.ink : C.ink2, anchor: 'middle' })
  }
  return out
}
function previewMiniPage() {
  let out = ''
  out += rect(356, 346, 728, 118, { rx: 12, fill: 'url(#hero)' })
  out += text(374, 374, 'STAGE 02 / 07 · 当前阶段', { size: 8, weight: 700, fill: '#FFFFFF', opacity: 0.56, ls: 1 })
  out += text(374, 402, '设计确认闸门', { size: 20, weight: 700, fill: '#FFFFFF' })
  out += rect(524, 384, 58, 20, { rx: 10, fill: 'rgba(245,158,11,0.16)', stroke: 'rgba(252,211,77,0.48)', sw: 1 })
  out += text(553, 398, '待评审', { size: 8.5, weight: 600, fill: '#FCD34D', anchor: 'middle' })
  out += text(374, 426, '设计稿待你确认 · 确认后进入开发', { size: 9.5, fill: '#FCD34D' })
  out += text(374, 446, '负责：UI 设计师 · 第 11 轮 · 快速模式', { size: 8.5, fill: '#FFFFFF', opacity: 0.6 })
  out += btn(916, 386, 76, 24, '通过', { kind: 'heroWhite', size: 9.5, rx: 7 })
  out += btn(998, 386, 46, 24, '打回', { kind: 'heroGhost', size: 9.5, rx: 7 })
  out += text(916, 426, '1/7 已通过', { size: 9, fill: '#FFFFFF', opacity: 0.6 })
  // three cards
  const cards = [
    { x: 356, title: '流水线卡 · 待确认', kind: 'pipe' },
    { x: 600, title: '工作台卡 · 待确认', kind: 'wb' },
    { x: 844, title: '预览弹层 · HTML', kind: 'modal' },
  ]
  for (const c of cards) {
    out += rect(c.x, 476, 232, 132, { rx: 10, fill: C.surface, stroke: C.line, sw: 1 })
    out += text(c.x + 12, 496, c.title, { size: 11, weight: 700, fill: C.ink })
    if (c.kind === 'pipe') {
      out += rect(c.x + 12, 506, 208, 26, { rx: 6, fill: C.warnSoft, stroke: C.warnBorder, sw: 1 })
      out += text(c.x + 20, 523, '! 设计稿待你确认 · 确认后进入开发', { size: 8, weight: 700, fill: C.warnDeep })
      out += rect(c.x + 12, 540, 100, 52, { rx: 5, fill: C.surface, stroke: C.line, sw: 1 })
      out += miniShot('pipeline', c.x + 13, 541, 98, 50)
      out += rect(c.x + 120, 540, 100, 52, { rx: 5, fill: C.surface, stroke: C.brand, sw: 1.2 })
      out += miniShot('html', c.x + 121, 541, 98, 50)
      out += circle(c.x + 210, 566, 8, { fill: C.brand })
      out += iconGlyph('eye', c.x + 203, 559, 14, '#FFFFFF')
    } else if (c.kind === 'wb') {
      out += pill(c.x + 148, 484, 52, 18, '待你确认', { fg: C.warnDeep, bg: C.warnFill, border: C.warnBorder, size: 8 })
      out += rect(c.x + 12, 510, 208, 24, { rx: 6, fill: C.warnSoft, stroke: C.warnBorder, sw: 1 })
      out += text(c.x + 20, 526, '设计稿待你确认 · 确认后进入开发', { size: 8, weight: 700, fill: C.warnDeep })
      out += btn(c.x + 12, 542, 78, 22, '预览设计稿', { kind: 'primary', icon: 'eye', size: 8.5, rx: 6 })
      out += btn(c.x + 96, 542, 46, 22, '通过', { kind: 'ok', icon: 'check', size: 8.5, rx: 6 })
      out += btn(c.x + 148, 542, 46, 22, '打回', { kind: 'danger', size: 8.5, rx: 6 })
      out += text(c.x + 12, 586, '空态：设计阶段尚未提交截图', { size: 8, fill: C.ink3 })
    } else {
      out += rect(c.x + 12, 506, 208, 30, { rx: 6, fill: C.surface2, stroke: C.field, sw: 1 })
      out += text(c.x + 20, 525, 'iframe 渲染 · sandbox=""', { size: 8.5, mono: true, fill: C.ink2 })
      out += rect(c.x + 12, 544, 208, 48, { rx: 5, fill: C.surface, stroke: C.line2, sw: 1 })
      out += rect(c.x + 20, 552, 46, 4, { rx: 2, fill: C.line2 })
      out += rect(c.x + 20, 562, 192, 4, { rx: 2, fill: C.line })
      out += rect(c.x + 20, 572, 120, 4, { rx: 2, fill: C.line })
      out += text(c.x + 20, 585, '设备 360 / 768 / 1280 切换', { size: 8, fill: C.ink3 })
    }
  }
  // second row
  out += rect(356, 620, 358, 80, { rx: 10, fill: C.surface, stroke: C.line, sw: 1 })
  out += text(368, 642, '三档宽度 · 显式标注', { size: 10, weight: 700, fill: C.ink })
  out += rect(368, 652, 44, 20, { rx: 10, fill: C.brandSoft, stroke: C.brandLine, sw: 1 })
  out += text(390, 666, '360', { size: 8.5, fill: C.brand, anchor: 'middle' })
  out += rect(418, 652, 44, 20, { rx: 10, fill: C.surface3, stroke: C.field, sw: 1 })
  out += text(440, 666, '768', { size: 8.5, fill: C.ink2, anchor: 'middle' })
  out += rect(468, 652, 44, 20, { rx: 10, fill: C.surface3, stroke: C.field, sw: 1 })
  out += text(490, 666, '1280', { size: 8.5, fill: C.ink2, anchor: 'middle' })
  out += text(368, 692, 'iframe 宽度随档位变化；容器内横向滚动，高度固定 ≥640。', { size: 8, fill: C.ink3 })
  out += rect(726, 620, 358, 80, { rx: 10, fill: C.surface, stroke: C.line, sw: 1 })
  out += text(738, 642, '查看源码（次级入口）', { size: 10, weight: 700, fill: C.ink })
  out += text(738, 660, '图片走应用内大图；HTML 默认渲染，不默认打开源码。', { size: 8, fill: C.ink3 })
  out += btn(738, 668, 78, 22, '查看源码', { kind: 'ghost', icon: 'code', size: 8.5, rx: 6 })
  out += text(368, 758, '确认复用现有 approve 通道；sandbox=""、title 必填、loading=lazy；不向主文档注入设计稿 CSS / JS。', { size: 8.5, fill: C.ink3 })
  return out
}
function modalBottom() {
  let out = rect(100, 816, 1240, 84, { rx: 0, fill: C.surface })
  out += rect(100, 816, 1240, 1, { fill: C.line })
  out += rect(124, 826, 360, 44, { rx: 8, fill: C.surface, stroke: C.field, sw: 1 })
  out += text(136, 853, '打回原因（可选）：写清需要修改的地方…', { size: 12, fill: C.ink3 })
  out += text(500, 847, '通过后进入开发；发布仍保持锁定。', { size: 11, weight: 600, fill: C.warnDeep })
  out += text(500, 864, '待确认提示与按钮同屏，不增加点击层级。', { size: 9.5, fill: C.ink3 })
  out += btn(956, 826, 88, 44, '查看源码', { kind: 'secondary', icon: 'code', size: 12 })
  out += btn(1052, 826, 64, 44, '打回', { kind: 'danger', size: 11.5 })
  out += btn(1124, 826, 192, 44, '确认设计，进入开发', { kind: 'primary', size: 13 })
  out += text(124, 888, 'Esc 关闭 · 关闭后焦点回到触发按钮 · 通过 / 打回复用 reviewPipelineStage 通道', { size: 9.5, fill: C.ink3 })
  return out
}
function m2() {
  const w = 1440, h = 1024
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${defs('<filter id="bgb" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2.5"/></filter>')}
${modalBackdrop(w, h)}
${modalHeader()}
${rect(100, 204, 1240, 56, { fill: C.canvas })}
${rect(100, 204, 1240, 1, { fill: C.line })}
${rect(100, 259, 1240, 1, { fill: C.line })}
${artifactTab(124, 150, 'image', '流水线卡 · 1440', false)}
${artifactTab(280, 132, 'phone', '移动端 · 390', false)}
${artifactTab(418, 158, 'html', '高保真稿 · HTML', true)}
${deviceSwitch()}
${btn(1216, 214, 100, 32, '查看源码', { kind: 'secondary', icon: 'code', size: 12 })}
${rect(124, 260, 1192, 556, { fill: C.surface2 })}
${rect(336, 300, 768, 486, { rx: 12, fill: C.surface, stroke: C.line2, sw: 1, filter: 'sh2' })}
${rect(337, 301, 766, 30, { rx: 11, fill: C.canvas })}
${rect(337, 315, 766, 15, { fill: C.canvas })}
${rect(337, 330, 766, 1, { fill: C.line })}
${circle(352, 316, 3.2, { fill: '#FCA5A5' })}${circle(363, 316, 3.2, { fill: '#FCD34D' })}${circle(374, 316, 3.2, { fill: '#86EFAC' })}
${text(396, 320, 'design-gate-preview.html', { size: 9.5, fill: C.ink2, family: MONO })}
${rect(1064, 307, 34, 16, { rx: 8, fill: C.brandSoft })}
${text(1081, 318, 'HTML', { size: 8.5, weight: 700, fill: C.brand, anchor: 'middle' })}
${rect(337, 331, 766, 454, { fill: C.canvas })}
${previewMiniPage()}
${text(140, 284, 'design-gate-preview.html', { size: 12, weight: 700, fill: C.ink2 })}
${rect(302, 272, 132, 20, { rx: 10, fill: C.surface, stroke: C.line, sw: 1 })}
${text(368, 286, 'iframe · sandbox=""', { size: 9.5, fill: C.ink3, anchor: 'middle', family: MONO })}
${text(1300, 284, '768 宽 · 画布内 0.76× 缩放 · 默认 1280', { size: 11, fill: C.ink3, anchor: 'end' })}
${text(140, 806, 'iframe 渲染（sandbox）· 不默认打开源码', { size: 9.5, fill: C.ink3 })}
${text(1300, 806, '演示 768（0.76×）· 默认 1280 · 高度 ≥640 · 容器内横向滚动', { size: 9.5, fill: C.ink3, anchor: 'end' })}
${modalBottom()}
</svg>`
}

/* ================================================================== *
 * M3: workbench design card (D3)
 * ================================================================== */
function designCardBig() {
  const X = 228, Y = 512, W = 1184, IN = X + 20
  let out = rect(X, Y, W, 330, { rx: 14, fill: C.surface, stroke: C.line, sw: 1, filter: 'sh1' })
  out += text(IN, Y + 33, '设计稿', { size: 14, weight: 700, fill: C.ink })
  out += pill(IN + 58, Y + 18, 68, 22, '待你确认', { fg: C.warnDeep, bg: C.warnFill, border: C.warnBorder, size: 10 })
  out += text(IN + 138, Y + 33, '设计阶段产出的界面截图 / 高保真稿，点击预览', { size: 12, fill: C.ink3 })
  out += text(X + W - 20, Y + 33, '4 个产物 · 3 张截图 + 1 个 HTML', { size: 10.5, fill: C.ink3, anchor: 'end' })
  // warn strip
  out += rect(IN, Y + 48, W - 40, 46, { rx: 8, fill: C.warnSoft, stroke: C.warnBorder, sw: 1 })
  out += circle(IN + 16, Y + 71, 9, { fill: C.warnFill })
  out += text(IN + 16, Y + 74.5, '!', { size: 9.5, weight: 700, fill: C.warnDeep, anchor: 'middle' })
  out += text(IN + 34, Y + 66, '设计稿待你确认 · 确认后进入开发', { size: 12, weight: 700, fill: C.warnDeep })
  out += text(IN + 34, Y + 84, '通过后解锁开发阶段；打回后设计变为「已打回」，修复重提后再次进入待确认。', { size: 10.5, fill: C.warn })
  out += text(X + W - 36, Y + 74, '通过 / 打回后提示消失', { size: 10, fill: C.warn, anchor: 'end' })
  // thumbnails
  const ty = Y + 110, tw = 268, th = 124
  const xs = [IN, IN + tw + 12, IN + (tw + 12) * 2, IN + (tw + 12) * 3]
  const tiles = ['pipeline', 'modal', 'mobile', 'html']
  const labels = ['流水线卡 · 1440 · 待确认', '设计稿预览弹层 · 1440', '移动端预览 · 390', '高保真稿 · HTML · 点击预览']
  for (let i = 0; i < 4; i++) {
    const selected = tiles[i] === 'html'
    out += rect(xs[i], ty, tw, th, { rx: 10, fill: selected ? '#F8FBFF' : C.surface, stroke: selected ? C.brand : C.line, sw: selected ? 1.5 : 1 })
    // mini preview
    if (tiles[i] === 'pipeline') {
      out += rect(xs[i] + 10, ty + 10, tw - 20, 86, { rx: 6, fill: C.canvas })
      out += rect(xs[i] + 18, ty + 18, 66, 70, { rx: 5, fill: C.surface, stroke: C.line, sw: 1 })
      out += rect(xs[i] + 22, ty + 24, 12, 12, { rx: 3, fill: C.warnFill })
      out += rect(xs[i] + 38, ty + 24, 38, 4, { rx: 2, fill: C.ink })
      out += rect(xs[i] + 22, ty + 40, 54, 16, { rx: 3, fill: C.warnSoft, stroke: C.warnBorder, sw: 1 })
      out += rect(xs[i] + 22, ty + 60, 54, 20, { rx: 3, fill: C.surface2 })
      out += rect(xs[i] + 92, ty + 18, tw - 112, 70, { rx: 5, fill: C.surface, stroke: C.line, sw: 1 })
      out += rect(xs[i] + 100, ty + 26, 40, 52, { rx: 4, fill: C.warnSoft, stroke: C.warnBorder, sw: 1 })
      out += rect(xs[i] + 148, ty + 26, 90, 24, { rx: 4, fill: C.surface2 })
      out += rect(xs[i] + 148, ty + 56, 90, 22, { rx: 4, fill: C.surface2 })
    } else if (tiles[i] === 'modal') {
      out += rect(xs[i] + 10, ty + 10, tw - 20, 86, { rx: 6, fill: C.surface2 })
      out += rect(xs[i] + 28, ty + 18, tw - 56, 70, { rx: 6, fill: C.surface, stroke: C.line2, sw: 1, filter: 'sh1' })
      out += rect(xs[i] + 36, ty + 26, 44, 4, { rx: 2, fill: C.ink })
      out += rect(xs[i] + 36, ty + 36, tw - 72, 30, { rx: 4, fill: C.canvas })
      out += rect(xs[i] + 48, ty + 44, 120, 2.5, { rx: 1.2, fill: C.line2 })
      out += rect(xs[i] + 36, ty + 72, 52, 10, { rx: 5, fill: C.brand })
    } else if (tiles[i] === 'mobile') {
      out += rect(xs[i] + 96, ty + 8, 76, 90, { rx: 9, fill: C.surface, stroke: C.ink3, sw: 1 })
      out += rect(xs[i] + 102, ty + 14, 64, 26, { rx: 4, fill: '#0B1220' })
      out += rect(xs[i] + 102, ty + 46, 64, 8, { rx: 3, fill: C.warnSoft, stroke: C.warnBorder, sw: 0.8 })
      out += rect(xs[i] + 102, ty + 60, 64, 14, { rx: 3, fill: C.surface2 })
      out += rect(xs[i] + 102, ty + 80, 64, 10, { rx: 4, fill: C.brand })
    } else {
      out += rect(xs[i] + 10, ty + 10, tw - 20, 86, { rx: 6, fill: '#FFFFFF', stroke: C.line, sw: 1 })
      out += rect(xs[i] + 20, ty + 20, 60, 6, { rx: 3, fill: C.ink })
      out += rect(xs[i] + 20, ty + 34, tw - 40, 3, { rx: 1.5, fill: C.line2 })
      out += rect(xs[i] + 20, ty + 43, tw - 62, 3, { rx: 1.5, fill: C.line2 })
      out += rect(xs[i] + 20, ty + 56, 70, 26, { rx: 5, fill: C.warnSoft, stroke: C.warnBorder, sw: 1 })
      out += circle(xs[i] + tw / 2, ty + 60, 15, { fill: C.brand })
      out += iconGlyph('eye', xs[i] + tw / 2 - 9, ty + 51, 18, '#FFFFFF')
    }
    out += text(xs[i] + 10, ty + th - 4, labels[i], { size: 9, weight: selected ? 700 : 400, fill: selected ? C.brand : C.ink3 })
  }
  // actions
  const ay = Y + 260
  out += btn(IN, ay, 132, 44, '预览设计稿', { kind: 'primary', icon: 'eye', size: 11.5 })
  out += btn(IN + 140, ay, 76, 44, '通过', { kind: 'ok', icon: 'check', size: 11.5 })
  out += btn(IN + 224, ay, 76, 44, '打回', { kind: 'danger', size: 11.5 })
  out += rect(IN + 320, ay, 340, 44, { rx: 8, fill: C.surface, stroke: C.field, sw: 1 })
  out += text(IN + 332, ay + 27, '打回原因（可选）…', { size: 11, fill: C.ink3 })
  out += text(X + W - 20, ay + 27, '设计说明 design.md ↗', { size: 11, weight: 600, fill: C.brand, anchor: 'end' })
  out += text(IN, Y + 318, 'HTML 产物以 iframe 渲染（sandbox、title 必填），可切换 360 / 768 / 1280；「查看源码」为次级入口。', { size: 11, fill: C.ink3 })
  return out
}
function m3() {
  const w = 1440, h = 1024
  let page = rect(200, 48, 1240, 976, { fill: C.canvas }) + rect(200, 48, 1240, 976, { fill: 'url(#pageGlow)' })
  const X = 200, W = 1240, ax = X + W - 28
  page += text(X + 28, 92, '工作区 · dsh-web-filebrowser · 第 11 轮', { size: 10.5, weight: 600, fill: C.ink3, ls: 0.4 })
  page += text(X + 28, 136, '工作台', { size: 30, weight: 700, fill: C.ink })
  page += pill(X + 150, 104, 54, 22, '第 11 轮', { fg: C.ink2, bg: C.surface2, size: 10 })
  page += pill(X + 210, 104, 64, 22, '快速模式', { fg: C.ok, bg: C.okSoft, size: 10 })
  page += pill(X + 280, 104, 74, 22, '1/7 已通过', { fg: C.brand, bg: C.brandSoft, size: 10 })
  page += btn(ax - 332, 96, 60, 32, '刷新', { kind: 'secondary', size: 11 })
  page += btn(ax - 264, 96, 92, 32, '打开流水线', { kind: 'secondary', size: 11 })
  page += btn(ax - 164, 96, 60, 32, '团队', { kind: 'secondary', size: 11 })
  page += rect(ax - 96, 96, 32, 32, { rx: 8, fill: C.surface, stroke: C.line2, sw: 1 })
  page += circle(ax - 80, 112, 6, { stroke: C.ink2, sw: 1.5 })
  page += rect(ax - 56, 96, 32, 32, { rx: 8, fill: C.surface, stroke: C.line2, sw: 1 })
  page += iconGlyph('close', ax - 48, 104, 16, C.ink2)
  page += rect(X, 152, W, 1, { fill: C.line })
  // hero (same language, design review)
  const hx = X + 28, hy = 168, hw = W - 56, hh = 268
  page += rect(hx, hy, hw, hh, { rx: 18, fill: 'url(#hero)' })
  page += rect(hx, hy, hw, hh, { rx: 18, fill: 'url(#heroGlow)' })
  page += text(hx + 28, hy + 34, 'STAGE 02 / 07 · 当前阶段', { size: 10.5, weight: 700, fill: '#FFFFFF', opacity: 0.56, ls: 1.6 })
  page += text(hx + 28, hy + 76, 'UI 设计', { size: 30, weight: 700, fill: '#FFFFFF' })
  page += rect(hx + 138, hy + 54, 62, 22, { rx: 11, fill: 'rgba(245,158,11,0.16)', stroke: 'rgba(252,211,77,0.48)', sw: 1 })
  page += text(hx + 169, hy + 69, '待评审', { size: 10, weight: 600, fill: '#FCD34D', anchor: 'middle' })
  page += text(hx + 28, hy + 110, '设计稿已提交：设计确认闸门 + 设计稿预览。', { size: 12.5, fill: '#FFFFFF', opacity: 0.76 })
  page += text(hx + 28, hy + 132, '等待你确认后进入开发阶段。', { size: 12.5, fill: '#FFFFFF', opacity: 0.76 })
  page += text(hx + 28, hy + 160, '负责：UI 设计师 · 第 11 轮 · 快速模式', { size: 11, fill: '#FFFFFF', opacity: 0.56 })
  const railY = hy + 184, rx = hx + hw - 28 - 300, railW = rx - 24 - (hx + 28), gap = 8, segW = (railW - gap * 6) / 7
  const railColors = [C.okDot, C.warnDot, 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.18)']
  for (let i = 0; i < 7; i++) page += rect(hx + 28 + i * (segW + gap), railY, segW, 6, { rx: 3, fill: railColors[i] })
  const names = ['需求', '设计', '开发', '测试', '验收', '确认', '发布']
  for (let i = 0; i < 7; i++) page += text(hx + 28 + i * (segW + gap), railY + 22, names[i], { size: 10, fill: '#FFFFFF', opacity: i === 1 ? 1 : 0.56, weight: i === 1 ? 600 : 400 })
  page += text(hx + 28, railY + 50, '已通过 1 / 7 关 · 设计确认后进入开发；发布仍保持锁定', { size: 10.5, fill: '#FFFFFF', opacity: 0.56 })
  const ringCx = rx + 34, ringCy = hy + 66
  page += circle(ringCx, ringCy, 30, { stroke: 'rgba(255,255,255,0.16)', sw: 7 })
  page += path(`M ${ringCx} ${ringCy - 30} A 30 30 0 0 1 ${ringCx + 24.9} ${ringCy - 16.7}`, { stroke: C.heroBlue, sw: 7, cap: 'butt' })
  page += text(ringCx, ringCy + 5, '1/7', { size: 15, weight: 700, fill: '#FFFFFF', anchor: 'middle' })
  page += text(rx + 76, hy + 54, '已通过 1 关', { size: 13, weight: 700, fill: '#FFFFFF' })
  page += text(rx + 76, hy + 74, '当前第 2 关 · UI 设计', { size: 10.5, fill: '#FFFFFF', opacity: 0.56 })
  page += text(rx + 76, hy + 92, '门禁：你确认后解锁开发', { size: 10.5, fill: '#FFFFFF', opacity: 0.56 })
  page += btn(rx, hy + 112, 140, 44, '通过', { kind: 'heroWhite', size: 13, rx: 10 })
  page += btn(rx + 150, hy + 112, 150, 44, '打回', { kind: 'heroGhost', size: 13, rx: 10 })
  page += rect(rx, hy + 166, 300, 34, { rx: 10, fill: 'rgba(255,255,255,0.08)', stroke: 'rgba(255,255,255,0.16)', sw: 1 })
  page += text(rx + 12, hy + 188, '评审备注（打回时可选）', { size: 11, fill: '#FFFFFF', opacity: 0.56 })
  page += text(rx, hy + 226, '通过后进入开发；发布仍保持锁定', { size: 10.5, fill: '#FFFFFF', opacity: 0.5 })
  page += text(rx + 300, hy + 226, '预览设计稿 →', { size: 10.5, weight: 600, fill: C.heroLink, anchor: 'end' })
  // now head
  let zy = 470
  page += rect(X + 28, zy, 3, 26, { rx: 1.5, fill: C.warnDot })
  page += text(X + 41, zy + 9, 'NOW', { size: 10, weight: 700, fill: C.ink3, ls: 1.2 })
  page += text(X + 41, zy + 25, '需要你决定的事', { size: 16, weight: 700, fill: C.ink })
  page += text(X + 176, zy + 22, '1 项待确认 · 设计稿需要你确认', { size: 12, fill: C.ink3 })
  page += text(ax, zy + 22, '查看任务 →', { size: 11.5, weight: 600, fill: C.brand, anchor: 'end' })
  page += designCardBig()
  // project zone partial
  zy = 872
  page += rect(X + 28, zy, 3, 26, { rx: 1.5, fill: C.brand })
  page += text(X + 41, zy + 9, 'PROJECT', { size: 10, weight: 700, fill: C.ink3, ls: 1.2 })
  page += text(X + 41, zy + 25, '项目与团队', { size: 16, weight: 700, fill: C.ink })
  page += text(ax, zy + 22, '查看流水线 →', { size: 11.5, weight: 600, fill: C.brand, anchor: 'end' })
  page += rect(X + 28, 914, 700, 130, { rx: 14, fill: C.surface, stroke: C.line, sw: 1, filter: 'sh1' })
  page += text(X + 46, 942, '项目状态', { size: 13, weight: 700, fill: C.ink })
  page += text(X + 46, 986, '1/7', { size: 32, weight: 700, fill: C.ink })
  page += text(X + 104, 986, '关已完成', { size: 11, fill: C.ink3 })
  page += rect(X + 46, 1002, 660, 6, { rx: 3, fill: C.surface2 })
  page += rect(X + 46, 1002, 94, 6, { rx: 3, fill: C.brand })
  page += rect(X + 744, 914, W - 56 - 716, 130, { rx: 14, fill: C.surface, stroke: C.line, sw: 1, filter: 'sh1' })
  page += text(X + 762, 942, '团队与指派', { size: 13, weight: 700, fill: C.ink })
  page += text(X + 762, 972, '6 个角色 · 2 执行中', { size: 11, fill: C.ink2 })
  page += text(X + 762, 998, 'UI 设计师 · 全栈开发 · 测试工程师', { size: 11, fill: C.ink2 })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${defs()}
${rect(0, 0, w, h, { fill: C.canvas })}
${topbar(w, '设计确认闸门 · 第 11 轮')}
${navbar('工作台')}
${page}
</svg>`
}

/* ================================================================== *
 * M4: mobile fullscreen preview (390 x 844)
 * ================================================================== */
function mobilePreviewPage() {
  let out = rect(15, 236, 360, 396, { rx: 14, fill: C.surface, stroke: C.line2, sw: 1, filter: 'sh2' })
  out += rect(16, 237, 358, 28, { rx: 13, fill: C.canvas })
  out += rect(16, 251, 358, 14, { fill: C.canvas })
  out += rect(16, 264, 358, 1, { fill: C.line })
  out += circle(30, 251, 3, { fill: '#FCA5A5' })
  out += circle(40, 251, 3, { fill: '#FCD34D' })
  out += circle(50, 251, 3, { fill: '#86EFAC' })
  out += text(62, 255, 'design-gate-preview.html', { size: 8, fill: C.ink3, family: MONO })
  // mobile design page
  out += rect(27, 272, 336, 88, { rx: 10, fill: 'url(#hero)' })
  out += text(41, 292, 'STAGE 02 / 07 · 当前阶段', { size: 7, weight: 700, fill: '#FFFFFF', opacity: 0.56, ls: 0.8 })
  out += text(41, 314, '设计确认闸门', { size: 15, weight: 700, fill: '#FFFFFF' })
  out += rect(178, 300, 48, 18, { rx: 9, fill: 'rgba(245,158,11,0.16)', stroke: 'rgba(252,211,77,0.48)', sw: 1 })
  out += text(202, 312, '待评审', { size: 7.5, weight: 600, fill: '#FCD34D', anchor: 'middle' })
  out += text(41, 332, '设计稿待你确认 · 确认后进入开发', { size: 8.5, fill: '#FCD34D' })
  out += text(41, 346, '负责：UI 设计师 · 第 11 轮', { size: 7.5, fill: '#FFFFFF', opacity: 0.6 })
  out += rect(41, 352, 308, 4, { rx: 2, fill: 'rgba(255,255,255,0.18)' })
  out += rect(41, 352, 44, 4, { rx: 2, fill: C.okDot })
  out += rect(93, 352, 44, 4, { rx: 2, fill: C.warnDot })
  // warn strip
  out += rect(27, 368, 336, 34, { rx: 8, fill: C.warnSoft, stroke: C.warnBorder, sw: 1 })
  out += circle(43, 385, 8, { fill: C.warnFill })
  out += text(43, 388.5, '!', { size: 8.5, weight: 700, fill: C.warnDeep, anchor: 'middle' })
  out += text(57, 383, '设计稿待你确认 · 确认后进入开发', { size: 9.5, weight: 700, fill: C.warnDeep })
  out += text(57, 396, '通过后开发阶段才能启动', { size: 8, fill: C.warn })
  // thumbnails row
  out += rect(27, 410, 100, 60, { rx: 7, fill: C.surface, stroke: C.line, sw: 1 })
  out += miniShot('pipeline', 28, 411, 98, 58)
  out += rect(137, 410, 100, 60, { rx: 7, fill: C.surface, stroke: C.line, sw: 1 })
  out += miniShot('mobile', 138, 411, 98, 58)
  out += rect(247, 410, 100, 60, { rx: 7, fill: C.surface, stroke: C.brand, sw: 1.4 })
  out += miniShot('html', 248, 411, 98, 58)
  out += circle(331, 440, 11, { fill: C.brand })
  out += iconGlyph('eye', 322, 431, 18, '#FFFFFF')
  out += text(27, 482, '流水线卡 · 1440', { size: 7.5, fill: C.ink3 })
  out += text(137, 482, '移动端 · 390', { size: 7.5, fill: C.ink3 })
  out += text(247, 482, '高保真稿 · HTML', { size: 7.5, weight: 700, fill: C.brand })
  // actions
  out += btn(27, 492, 140, 34, '预览设计稿', { kind: 'primary', icon: 'eye', size: 9.5 })
  out += btn(175, 492, 56, 34, '通过', { kind: 'ok', icon: 'check', size: 9.5 })
  out += btn(239, 492, 56, 34, '打回', { kind: 'danger', size: 9.5 })
  out += text(27, 548, 'HTML 以 iframe 渲染（sandbox）；可切 360 / 768 / 1280 三档宽度。', { size: 8, fill: C.ink3 })
  out += text(27, 566, '通过后进入开发；发布仍保持锁定。打回后设计变为「已打回」。', { size: 8, fill: C.ink3 })
  out += text(27, 604, '设计说明 design.md ↗', { size: 8.5, weight: 600, fill: C.brand })
  return out
}
function m4() {
  const w = 390, h = 844
  let out = rect(0, 0, w, h, { fill: C.surface })
  // top bar
  out += text(16, 33, '9:41', { size: 10.5, weight: 700, fill: C.ink })
  out += rect(322, 26, 18, 9, { rx: 2.5, fill: 'none', stroke: C.ink, sw: 1.2 })
  out += rect(325, 28.5, 10, 4, { rx: 1.5, fill: C.ink })
  out += rect(343, 28, 2, 5, { rx: 1, fill: C.ink })
  out += rect(0, 44, w, 1, { fill: C.line })
  out += rect(0, 45, w, 52, { fill: C.surface })
  out += rect(8, 49, 44, 44, { rx: 10, fill: C.surface2 })
  out += iconGlyph('back', 20, 63, 18, C.ink)
  out += text(64, 76, '设计稿预览', { size: 16, weight: 700, fill: C.ink })
  out += text(64, 90, '第 11 轮 · UI 设计 · 待评审', { size: 10, fill: C.ink3 })
  out += rect(338, 49, 44, 44, { rx: 10, fill: C.surface2 })
  out += iconGlyph('close', 351, 62, 18, C.ink)
  out += rect(0, 97, w, 1, { fill: C.line })
  // status strip
  out += rect(0, 98, w, 36, { fill: C.warnSoft })
  out += rect(0, 133, w, 1, { fill: C.warnBorder })
  out += circle(18, 116, 7, { fill: C.warnFill })
  out += text(18, 119, '!', { size: 8, weight: 700, fill: C.warnDeep, anchor: 'middle' })
  out += text(32, 120, '设计稿待你确认 · 确认后进入开发', { size: 11, weight: 700, fill: C.warnDeep })
  // artifact tabs
  out += rect(0, 134, w, 46, { fill: C.canvas })
  out += rect(12, 136, 104, 44, { rx: 8, fill: C.surface, stroke: C.line, sw: 1 })
  out += iconGlyph('image', 22, 151, 14, C.ink2)
  out += text(42, 164, '流水线 1440', { size: 10, fill: C.ink2 })
  out += rect(122, 136, 96, 44, { rx: 8, fill: C.surface, stroke: C.line, sw: 1 })
  out += iconGlyph('phone', 132, 151, 14, C.ink2)
  out += text(152, 164, '移动端 390', { size: 10, fill: C.ink2 })
  out += rect(224, 136, 124, 44, { rx: 8, fill: C.surface, stroke: C.brand, sw: 1.4 })
  out += iconGlyph('html', 234, 151, 14, C.brand)
  out += text(254, 164, '高保真稿 HTML', { size: 10, weight: 700, fill: C.ink })
  // device row (visual 32 + 44px hit row)
  out += text(12, 208, '宽度', { size: 10, fill: C.ink3 })
  out += rect(44, 184, 168, 44, { rx: 8, fill: C.surface3, stroke: C.field, sw: 1 })
  const opts = [['360', 46, 56], ['768', 104, 54], ['1280', 158, 52]]
  for (const [label, x, ww] of opts) {
    const on = label === '360'
    if (on) out += rect(x, 190, ww, 32, { rx: 6, fill: C.surface, stroke: C.line2, sw: 1, filter: 'sh1' })
    out += text(x + ww / 2, 211, label, { size: 10, weight: on ? 700 : 400, fill: on ? C.ink : C.ink2, anchor: 'middle' })
  }
  out += btn(302, 184, 76, 44, '查看源码', { kind: 'secondary', icon: 'code', size: 10 })
  // preview canvas
  out += rect(0, 228, w, 420, { fill: C.surface2 })
  out += mobilePreviewPage()
  out += text(27, 644, 'iframe 渲染 · 设备框居中 · 窄屏占满宽度', { size: 8.5, fill: C.ink2 })
  // bottom action panel
  out += rect(0, 648, w, 196, { rx: 0, fill: C.surface })
  out += rect(0, 648, w, 1, { fill: C.line })
  out += rect(0, 648, w, 16, { rx: 16, fill: C.surface })
  out += text(16, 674, '确认设计后进入开发 · 发布仍保持锁定', { size: 11, weight: 700, fill: C.warnDeep })
  out += text(374, 674, '3 个产物', { size: 9, fill: C.ink3, anchor: 'end' })
  out += rect(16, 684, 358, 40, { rx: 8, fill: C.surface, stroke: C.field, sw: 1 })
  out += text(28, 709, '打回原因（可选）…', { size: 11, fill: C.ink3 })
  out += btn(16, 732, 358, 48, '确认设计，进入开发', { kind: 'primary', size: 14 })
  out += btn(16, 790, 175, 48, '打回', { kind: 'danger', size: 13 })
  out += btn(199, 790, 175, 48, '查看源码', { kind: 'secondary', icon: 'code', size: 13 })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${defs()}
${out}
</svg>`
}

/* ================================================================== *
 * R1: earlier modal iteration (kept as evidence, not final)
 * ================================================================== */
function m2r1() {
  const w = 1440, h = 1024
  const mx = 220, my = 162, mw = 1000, mh = 700
  let modal = rect(mx, my, mw, mh, { rx: 16, fill: C.surface, stroke: C.line2, sw: 1, filter: 'sh3' })
  modal += text(mx + 24, my + 40, '设计稿预览', { size: 16, weight: 600, fill: C.ink })
  modal += text(mx + 24, my + 60, '第 11 轮 · UI 设计', { size: 10, fill: C.ink3 })
  modal += rect(mx + mw - 56, my + 18, 36, 36, { rx: 8, fill: C.surface2 })
  modal += iconGlyph('close', mx + mw - 46, my + 28, 16, C.ink2)
  // preview image only
  modal += rect(mx + 24, my + 76, mw - 48, 472, { rx: 10, fill: C.surface2 })
  modal += rect(mx + 64, my + 100, mw - 128, 424, { rx: 8, fill: C.surface, stroke: C.line2, sw: 1, filter: 'sh1' })
  modal += rect(mx + 64, my + 100, mw - 128, 96, { rx: 8, fill: 'url(#hero)' })
  modal += text(mx + 88, my + 132, 'STAGE 02 / 07 · 当前阶段', { size: 8, weight: 700, fill: '#FFFFFF', opacity: 0.56, ls: 1 })
  modal += text(mx + 88, my + 162, '设计确认闸门', { size: 18, weight: 700, fill: '#FFFFFF' })
  modal += text(mx + 88, my + 182, '设计稿待你确认 · 确认后进入开发', { size: 9, fill: '#FCD34D' })
  modal += rect(mx + 64, my + 210, (mw - 128) / 2 - 8, 140, { rx: 8, fill: C.surface2, stroke: C.line, sw: 1 })
  modal += rect(mx + 64 + (mw - 128) / 2 + 8, my + 210, (mw - 128) / 2 - 8, 140, { rx: 8, fill: C.surface2, stroke: C.line, sw: 1 })
  modal += rect(mx + 88, my + 240, 120, 8, { rx: 4, fill: C.ink })
  modal += rect(mx + 88, my + 264, 180, 6, { rx: 3, fill: C.line2 })
  modal += rect(mx + 88, my + 286, 140, 6, { rx: 3, fill: C.line2 })
  modal += rect(mx + 64 + (mw - 128) / 2 + 8 + 24, my + 240, 120, 8, { rx: 4, fill: C.ink })
  modal += rect(mx + 64 + (mw - 128) / 2 + 8 + 24, my + 264, 180, 6, { rx: 3, fill: C.line2 })
  modal += text(mx + 88, my + 380, '图片预览（HTML 产物暂未渲染）', { size: 9, fill: C.ink4 })
  // device buttons (too small), note, confirm (too small), no status strip, no source
  modal += text(mx + 24, my + 584, '预览宽度', { size: 10, fill: C.ink3 })
  modal += rect(mx + 88, my + 572, 150, 24, { rx: 6, fill: C.surface3 })
  const opts = [['360', mx + 90, 46], ['768', mx + 138, 44], ['1280', mx + 184, 50]]
  for (const [label, x, ww] of opts) {
    modal += text(x + ww / 2, my + 588, label, { size: 9, fill: C.ink3, anchor: 'middle' })
  }
  modal += text(mx + 262, my + 592, '切换宽度查看不同断点（示意）', { size: 9, fill: C.ink4 })
  modal += rect(mx + 24, my + 620, 560, 32, { rx: 6, fill: C.surface, stroke: C.line, sw: 1 })
  modal += text(mx + 34, my + 640, '评审备注', { size: 9, fill: C.ink4 })
  modal += btn(mx + mw - 260, my + 620, 80, 32, '取消', { kind: 'secondary', size: 10 })
  modal += btn(mx + mw - 172, my + 620, 148, 32, '确认设计', { kind: 'primary', size: 10 })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${defs('<filter id="bgb" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2.5"/></filter>')}
${modalBackdrop(w, h)}
${modal}
</svg>`
}

writeFileSync(join(OUT, 'design-gate-pipeline-review-1440.svg'), m1())
writeFileSync(join(OUT, 'design-gate-preview-modal-1440.svg'), m2())
writeFileSync(join(OUT, 'design-gate-workbench-card-1440.svg'), m3())
writeFileSync(join(OUT, 'design-gate-mobile-390.svg'), m4())
writeFileSync(join(OUT, 'design-gate-preview-modal-r1-1440.svg'), m2r1())
console.log('wrote all mockups')


/* ================================================================== *
 * State board: D2 loading / D2 error / D3 empty / D2 reject
 * ================================================================== */
function boardPanel(x, y, tag, title, sub) {
  let out = rect(x, y, 664, 400, { rx: 14, fill: C.surface, stroke: C.line, sw: 1, filter: 'sh1' })
  out += rect(x + 20, y + 18, 76, 20, { rx: 10, fill: C.brandSoft })
  out += text(x + 58, y + 32, tag, { size: 9, weight: 700, fill: C.brand, anchor: 'middle' })
  out += text(x + 20, y + 62, title, { size: 14, weight: 700, fill: C.ink })
  out += text(x + 20, y + 82, sub, { size: 10.5, fill: C.ink3 })
  return out
}
function boardHint(x, y, str) {
  return rect(x + 20, y + 356, 624, 1, { fill: C.line }) + text(x + 20, y + 384, str, { size: 9.5, fill: C.ink3 })
}
function stateBoard() {
  const w = 1440, h = 960
  let out = rect(0, 0, w, h, { fill: C.canvas })
  out += rect(0, 0, w, 88, { fill: C.surface })
  out += rect(0, 87, w, 1, { fill: C.line })
  out += text(40, 46, '设计稿预览与设计卡 · 关键状态', { size: 20, weight: 700, fill: C.ink })
  out += text(40, 70, 'v1.2.83 设计确认闸门 · D2 预览弹层 / D3 工作台设计卡 · 加载 / 失败 / 空 / 打回', { size: 11, fill: C.ink3 })
  out += text(1400, 56, '1440 × 960 · 浅色', { size: 10, fill: C.ink3, anchor: 'end' })
  const pos = [[40, 110], [736, 110], [40, 530], [736, 530]]
  out += boardPanel(...pos[0], 'D2 加载中', '预览 iframe 加载中', '骨架占位 + 文字反馈，确认按钮禁用')
  out += '<g transform="translate(40 110)">'
  out += rect(20, 104, 624, 120, { rx: 10, fill: C.surface2, stroke: C.line, sw: 1 })
  out += rect(32, 116, 600, 34, { rx: 7, fill: C.surface, stroke: C.line, sw: 1 })
  out += circle(50, 133, 6, { stroke: C.brand, sw: 2, dash: '3 3' })
  out += text(64, 137, '正在加载设计稿…', { size: 10.5, fill: C.ink2 })
  out += rect(532, 126, 88, 14, { rx: 7, fill: C.surface2 })
  out += text(576, 137, 'density 2×', { size: 8.5, fill: C.ink3, anchor: 'middle' })
  out += rect(192, 158, 280, 52, { rx: 6, fill: C.surface, stroke: C.line, sw: 1 })
  out += rect(204, 168, 256, 14, { rx: 4, fill: C.surface3 })
  out += rect(204, 188, 160, 8, { rx: 4, fill: C.surface3 })
  out += rect(192, 158, 280, 52, { rx: 6, fill: '#FFFFFF', opacity: 0.4 })
  out += text(20, 246, '骨架 3 行 + 加载文案；prefers-reduced-motion 下静态不闪。', { size: 9.5, fill: C.ink3 })
  out += '<g opacity="0.45">' + btn(20, 262, 168, 44, '确认设计，进入开发', { kind: 'secondary', size: 11 }) + '</g>'
  out += btn(198, 262, 96, 44, '查看源码', { kind: 'secondary', icon: 'code', size: 11 })
  out += text(306, 287, 'loading 时禁点通过，避免空批准', { size: 9, fill: C.ink3 })
  out += boardHint(0, 0, '加载态不可批准；100ms 内出现反馈；加载完成不改变布局高度。')
  out += '</g>'

  out += boardPanel(...pos[1], 'D2 加载失败', '预览失败 · 给源码退路', '文件不存在 / 不可读 / SSH 根不支持 raw 预览')
  out += '<g transform="translate(736 110)">'
  out += rect(20, 104, 624, 196, { rx: 10, fill: '#FFF9F9', stroke: C.errBorder, sw: 1 })
  out += circle(332, 146, 20, { fill: C.errSoft })
  out += text(332, 152, '!', { size: 18, weight: 700, fill: C.err, anchor: 'middle' })
  out += text(332, 188, '无法加载该设计稿', { size: 13, weight: 700, fill: C.ink, anchor: 'middle' })
  out += text(332, 210, 'design-gate-preview.html 不存在或不可读。', { size: 10.5, fill: C.ink2, anchor: 'middle' })
  out += text(332, 230, 'raw-404', { size: 9, fill: C.ink3, anchor: 'middle', family: MONO })
  out += btn(160, 248, 96, 44, '重试', { kind: 'secondary', icon: 'refresh', size: 11 })
  out += btn(266, 248, 120, 44, '查看源码', { kind: 'primary', icon: 'code', size: 11 })
  out += text(332, 316, '错误可读；源码作为退路；不出现白屏。', { size: 9.5, fill: C.ink3, anchor: 'middle' })
  out += boardHint(0, 0, '错误态给出「什么错 / 为什么 / 怎么修」；确认按钮禁用且有 title 说明。')
  out += '</g>'

  out += boardPanel(...pos[2], 'D3 空态', '工作台设计卡 · 无截图', '设计 review 但产物只有 HTML 或没有图片')
  out += '<g transform="translate(40 530)">'
  out += rect(20, 104, 624, 250, { rx: 12, fill: C.surface, stroke: C.line, sw: 1 })
  out += text(38, 136, '设计稿', { size: 14, weight: 700, fill: C.ink })
  out += pill(96, 121, 64, 20, '待你确认', { fg: C.warnDeep, bg: C.warnFill, border: C.warnBorder, size: 9.5 })
  out += text(626, 136, '0 个图片产物 · 1 个 HTML', { size: 9.5, fill: C.ink3, anchor: 'end' })
  out += rect(38, 150, 588, 34, { rx: 7, fill: C.warnSoft, stroke: C.warnBorder, sw: 1 })
  out += circle(52, 167, 8, { fill: C.warnFill })
  out += text(52, 170.5, '!', { size: 9, weight: 700, fill: C.warnDeep, anchor: 'middle' })
  out += text(66, 172, '设计稿待你确认 · 确认后进入开发', { size: 11, weight: 700, fill: C.warnDeep })
  out += rect(38, 196, 588, 94, { rx: 9, fill: '#FCFCFD', stroke: C.line2, sw: 1.2, dash: '6 6' })
  out += circle(332, 228, 17, { fill: C.surface2 })
  out += iconGlyph('image', 322, 219, 20, C.ink3)
  out += text(332, 262, '设计阶段尚未提交截图', { size: 12, weight: 700, fill: C.ink, anchor: 'middle' })
  out += text(332, 280, '请 UI 设计师提交至少一张 PNG / JPG / SVG；HTML 仅作补充且必须可预览。', { size: 9.5, fill: C.ink3, anchor: 'middle' })
  out += btn(38, 302, 128, 44, '预览设计稿', { kind: 'secondary', icon: 'eye', size: 10.5 })
  out += '<g opacity="0.45">' + btn(174, 302, 64, 44, '通过', { kind: 'secondary', size: 10.5 }) + '</g>'
  out += text(246, 330, '通过禁用：无截图不可确认', { size: 9, fill: C.err })
  out += text(626, 325, '设计说明 design.md ↗', { size: 10, weight: 600, fill: C.brand, anchor: 'end' })
  out += boardHint(0, 0, '空态不显示假数据；说明缺什么、谁来补、HTML 不能替代截图。')
  out += '</g>'

  out += boardPanel(...pos[3], 'D2 打回', '打回并说明', 'review note 随阶段记录；复用 reviewPipelineStage(reject)')
  out += '<g transform="translate(736 530)">'
  out += rect(20, 104, 624, 250, { rx: 12, fill: C.surface, stroke: C.errBorder, sw: 1 })
  out += text(38, 136, '打回设计稿', { size: 13, weight: 700, fill: C.ink })
  out += text(38, 154, '请说明需要修改的地方；设计阶段将变为「已打回」。', { size: 9.5, fill: C.ink3 })
  out += rect(38, 166, 588, 104, { rx: 8, fill: C.surface, stroke: C.field, sw: 1 })
  out += lines(50, 188, [
    '流水线卡状态条与按钮间距偏紧，请按 8px 栅格调整；',
    'HTML 产物要能看到 360 / 768 / 1280 三档切换。',
  ], { size: 10.5, fill: C.ink, lh: 18 })
  out += text(626, 260, '42 / 200', { size: 8.5, fill: C.ink3, anchor: 'end' })
  out += text(38, 290, '打回后：design = failed · 可修复后重新开始 · 再次提交重新进入 review', { size: 9, fill: C.warnDeep })
  out += btn(406, 308, 84, 44, '取消', { kind: 'secondary', size: 11 })
  out += btn(498, 308, 128, 44, '确认打回', { kind: 'dangerSolid', size: 11.5 })
  out += text(38, 332, '危险操作与主操作分离；note 可选但建议填写。', { size: 9, fill: C.ink3 })
  out += boardHint(0, 0, '打回不二次弹窗；note 保留在阶段记录；失败后可重新开始 design。')
  out += '</g>'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${defs()}
${out}
</svg>`
}
writeFileSync(join(OUT, 'design-gate-preview-states-1440.svg'), stateBoard())
console.log('wrote state board v2')

/* ---------- optional dark-theme fragment ---------- */
function mDark() {
  const w = 900, h = 500
  const D = {
    bg: '#0B0F15', surface: '#151B24', surface2: '#1B2430', line: '#2A3441', line2: '#3A4657',
    ink: '#E8EDF5', ink2: '#B7C0CC', ink3: '#8B97A8', brand: '#60A5FA', brandFill: '#2563EB',
    ok: '#34D399', warn: '#FBBF24', warnFill: 'rgba(245,158,11,0.16)', warnSoft: 'rgba(245,158,11,0.10)',
    warnLine: 'rgba(251,191,36,0.42)', err: '#F87171', field: '#6B7789',
  }
  let out = rect(0, 0, w, h, { fill: D.bg })
  out += text(28, 38, '深色主题片段 · D1 设计卡 / D2 预览弹层', { size: 16, weight: 700, fill: D.ink })
  out += text(28, 60, '同一套 alias token；warn=待评审、success=已通过、focus 环不重定义。', { size: 11, fill: D.ink3 })
  // D1 card
  out += rect(28, 86, 520, 300, { rx: 12, fill: D.surface, stroke: D.warnLine, sw: 1.4 })
  out += circle(56, 114, 9, { fill: D.warnFill })
  out += text(56, 118, '2', { size: 9.5, weight: 700, fill: D.warn, anchor: 'middle' })
  out += text(76, 112, 'UI 设计', { size: 13, weight: 700, fill: D.ink })
  out += text(76, 130, 'UI 设计师', { size: 10.5, fill: D.ink3 })
  out += rect(468, 100, 58, 22, { rx: 11, fill: D.warnFill, stroke: D.warnLine, sw: 1 })
  out += text(497, 115, '待评审', { size: 10, weight: 600, fill: D.warn, anchor: 'middle' })
  out += rect(48, 146, 480, 44, { rx: 8, fill: D.warnSoft, stroke: D.warnLine, sw: 1 })
  out += circle(64, 168, 8, { fill: D.warnFill })
  out += text(64, 171.5, '!', { size: 9, weight: 700, fill: D.warn, anchor: 'middle' })
  out += text(80, 165, '设计稿待你确认 · 确认后进入开发', { size: 12, weight: 700, fill: D.warn })
  out += text(80, 182, '通过后开发阶段才能启动；打回后设计变为「已打回」', { size: 10, fill: D.ink2 })
  // thumbs
  for (let i = 0; i < 3; i++) {
    out += rect(48 + i * 116, 204, 104, 64, { rx: 7, fill: D.surface2, stroke: i === 2 ? D.brand : D.line, sw: i === 2 ? 1.4 : 1 })
    out += rect(56 + i * 116, 212, 88, 48, { rx: 4, fill: '#0E141C' })
    if (i === 0) {
      out += rect(64, 222, 28, 30, { rx: 3, fill: D.surface })
      out += rect(98, 222, 38, 8, { rx: 3, fill: D.warnSoft })
      out += rect(98, 236, 38, 18, { rx: 3, fill: D.surface2 })
    } else if (i === 1) {
      out += rect(84, 216, 32, 40, { rx: 5, fill: D.surface, stroke: D.ink3, sw: 1 })
      out += rect(89, 221, 22, 12, { rx: 2, fill: '#0B1220' })
      out += rect(89, 237, 22, 10, { rx: 2, fill: D.warnSoft })
    } else {
      out += rect(64 + 224, 220, 44, 6, { rx: 3, fill: D.ink2 })
      out += rect(64 + 224, 232, 66, 4, { rx: 2, fill: D.line2 })
      out += circle(48 + 2 * 116 + 52, 236, 12, { fill: D.brandFill })
      out += iconGlyph('eye', 48 + 2 * 116 + 43, 227, 18, '#FFFFFF')
    }
  }
  out += text(48, 288, '流水线卡 · 1440', { size: 9.5, fill: D.ink3 })
  out += text(164, 288, '移动端 · 390', { size: 9.5, fill: D.ink3 })
  out += text(280, 288, '高保真稿 · HTML', { size: 9.5, weight: 600, fill: D.brand })
  out += btn(48, 308, 118, 44, '预览设计稿', { kind: 'dark', size: 11 })
  out += rect(48, 308, 118, 44, { rx: 9, fill: D.brandFill })
  out += text(107, 335, '预览设计稿', { size: 11, weight: 600, fill: '#FFFFFF', anchor: 'middle' })
  out += rect(174, 308, 64, 44, { rx: 9, fill: 'none', stroke: D.ok, sw: 1 })
  out += text(206, 335, '通过', { size: 11, weight: 600, fill: D.ok, anchor: 'middle' })
  out += rect(246, 308, 64, 44, { rx: 9, fill: 'none', stroke: D.err, sw: 1 })
  out += text(278, 335, '打回', { size: 11, weight: 600, fill: D.err, anchor: 'middle' })
  out += rect(48, 362, 480, 0, { fill: 'none' })
  // D2 fragment
  out += rect(568, 86, 304, 300, { rx: 12, fill: D.surface, stroke: D.line2, sw: 1 })
  out += text(586, 114, '设计稿预览', { size: 16, weight: 700, fill: D.ink })
  out += rect(586, 126, 58, 20, { rx: 10, fill: D.warnFill, stroke: D.warnLine, sw: 1 })
  out += text(615, 140, '待评审', { size: 9, weight: 600, fill: D.warn, anchor: 'middle' })
  out += rect(586, 158, 268, 30, { rx: 8, fill: D.warnSoft, stroke: D.warnLine, sw: 1 })
  out += text(598, 178, '设计稿待你确认 · 确认后进入开发', { size: 9.5, weight: 700, fill: D.warn })
  out += rect(586, 198, 268, 54, { rx: 8, fill: '#0E141C', stroke: D.line, sw: 1 })
  out += rect(598, 208, 120, 6, { rx: 3, fill: D.line2 })
  out += rect(598, 220, 200, 4, { rx: 2, fill: D.line })
  out += rect(598, 230, 160, 4, { rx: 2, fill: D.line })
  out += text(598, 248, 'iframe 渲染 · sandbox', { size: 8.5, fill: D.ink3 })
  out += text(586, 276, '预览宽度', { size: 10, fill: D.ink3 })
  out += rect(650, 262, 150, 24, { rx: 6, fill: D.surface2, stroke: D.field, sw: 1 })
  for (const [label, x] of [['360', 654], ['768', 702], ['1280', 748]]) {
    const on = label === '768'
    if (on) out += rect(x, 264, 46, 20, { rx: 5, fill: D.surface, stroke: D.brand, sw: 1 })
    out += text(x + 23, 278, label, { size: 9, weight: on ? 700 : 400, fill: on ? D.ink : D.ink3, anchor: 'middle' })
  }
  out += rect(586, 296, 96, 44, { rx: 9, fill: 'none', stroke: D.line2, sw: 1 })
  out += text(634, 323, '查看源码', { size: 10.5, weight: 600, fill: D.ink2, anchor: 'middle' })
  out += rect(690, 296, 164, 44, { rx: 9, fill: D.brandFill })
  out += text(772, 323, '确认设计，进入开发', { size: 10.5, weight: 600, fill: '#FFFFFF', anchor: 'middle' })
  out += text(586, 366, '通过后进入开发；发布仍保持锁定。', { size: 9.5, fill: D.ink3 })
  // contrast notes
  out += text(28, 424, '深色主题对比度实测', { size: 11, weight: 700, fill: D.ink })
  out += lines(28, 444, [
    '正文 #E8EDF5 / #0B0F15 = 16.34；caption #8B97A8 / #151B24 = 5.84；warn #FBBF24 / #151B24 = 10.36；',
    'focus 环 #60A5FA / #10151D = 7.20；主按钮 #FFFFFF / #2563EB = 5.17；danger #F87171 / #151B24 = 6.25。',
  ], { size: 9.5, fill: D.ink2, lh: 16 })
  out += text(28, 486, '动效与 reduced-motion 与浅色一致：160ms；状态色不新增 token。', { size: 9.5, fill: D.ink3 })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${defs()}
${out}
</svg>`
}
writeFileSync(join(OUT, 'design-gate-dark-fragment-900.svg'), mDark())
console.log('wrote dark fragment')

/* ================================================================== *
 * D4: workspace .html file preview (1440 x 1024)
 * ================================================================== */
function m4html() {
  const w = 1440, h = 1024
  let out = rect(0, 0, w, h, { fill: C.canvas })
  out += topbar(w, '设计确认闸门 · 第 11 轮')
  out += navbar('文件')
  const X = 200, W = 1240
  out += rect(X, 48, W, 976, { fill: C.surface })
  out += rect(X, 47, W, 1, { fill: C.line })
  // file tabs
  out += rect(X, 48, W, 36, { fill: C.canvas })
  out += rect(X, 48, 236, 36, { fill: C.surface })
  out += rect(X, 48, 236, 2, { fill: C.brand })
  out += rect(X + 236, 48, 1, 36, { fill: C.line })
  out += iconGlyph('html', X + 12, 57, 16, C.brand)
  out += text(X + 36, 70, 'design-gate-preview.html', { size: 12, weight: 600, fill: C.ink })
  out += rect(X + 200, 60, 18, 18, { rx: 4, fill: 'none' })
  out += iconGlyph('close', X + 202, 62, 14, C.ink3)
  out += iconGlyph('file', X + 252, 57, 16, C.ink3)
  out += text(X + 276, 70, 'design.md', { size: 12, fill: C.ink3 })
  out += iconGlyph('file', X + 366, 57, 16, C.ink3)
  out += text(X + 390, 70, 'requirements.md', { size: 12, fill: C.ink3 })
  out += rect(X, 83, W, 1, { fill: C.line })
  // editor toolbar
  out += rect(X, 84, W, 44, { fill: C.surface })
  out += rect(X, 127, W, 1, { fill: C.line })
  out += rect(X + 12, 90, 150, 32, { rx: 8, fill: C.surface2 })
  out += rect(X + 14, 92, 72, 28, { rx: 6, fill: C.surface, stroke: C.line2, sw: 1, filter: 'sh1' })
  out += iconGlyph('eye', X + 22, 98, 16, C.brand)
  out += text(X + 44, 112, '预览', { size: 12, weight: 700, fill: C.ink })
  out += iconGlyph('code', X + 94, 98, 16, C.ink2)
  out += text(X + 116, 112, '源码', { size: 12, fill: C.ink2 })
  out += pill(X + 172, 96, 44, 20, 'HTML', { fg: C.ink2, bg: C.surface2, size: 9.5 })
  out += text(X + 232, 111, 'design-gate-preview.html · 只读预览', { size: 11, fill: C.ink3 })
  out += text(X + W - 24, 111, '预览由 iframe 渲染（sandbox）· 点「源码」可编辑', { size: 10.5, fill: C.ink3, anchor: 'end' })
  // iframe frame
  out += rect(X, 128, W, 896, { fill: C.surface2 })
  out += rect(X + 28, 148, W - 56, 824, { rx: 12, fill: C.surface, stroke: C.line2, sw: 1, filter: 'sh2' })
  out += rect(X + 29, 149, W - 58, 34, { rx: 11, fill: C.canvas })
  out += rect(X + 29, 166, W - 58, 17, { fill: C.canvas })
  out += rect(X + 29, 182, W - 58, 1, { fill: C.line })
  out += circle(X + 46, 166, 3.5, { fill: '#FCA5A5' })
  out += circle(X + 58, 166, 3.5, { fill: '#FCD34D' })
  out += circle(X + 70, 166, 3.5, { fill: '#86EFAC' })
  out += rect(X + 92, 156, 520, 20, { rx: 10, fill: C.surface2 })
  out += text(X + 104, 171, 'raw://dsh-web-filebrowser/docs/pipeline/design/design-gate-preview.html', { size: 9, fill: C.ink3, family: MONO })
  out += rect(X + W - 92, 157, 46, 18, { rx: 9, fill: C.brandSoft })
  out += text(X + W - 69, 170, '预览', { size: 9, weight: 700, fill: C.brand, anchor: 'middle' })
  // rendered design doc inside iframe
  const cx = X + 48, cy = 200, cw = W - 96
  out += rect(cx, cy, cw, 748, { fill: C.canvas })
  out += rect(cx + 24, cy + 24, cw - 48, 196, { rx: 14, fill: 'url(#hero)' })
  out += rect(cx + 24, cy + 24, cw - 48, 196, { rx: 14, fill: 'url(#heroGlow)' })
  out += text(cx + 52, cy + 62, 'STAGE 02 / 07 · 当前阶段', { size: 11, weight: 700, fill: '#FFFFFF', opacity: 0.56, ls: 1.4 })
  out += text(cx + 52, cy + 112, '设计确认闸门', { size: 34, weight: 700, fill: '#FFFFFF' })
  out += rect(cx + 268, cy + 86, 74, 26, { rx: 13, fill: 'rgba(245,158,11,0.16)', stroke: 'rgba(252,211,77,0.48)', sw: 1 })
  out += text(cx + 305, cy + 104, '待评审', { size: 11, weight: 600, fill: '#FCD34D', anchor: 'middle' })
  out += text(cx + 52, cy + 146, '设计稿待你确认 · 确认后进入开发；HTML 以 iframe 渲染，可切 360 / 768 / 1280。', { size: 14, fill: '#FFFFFF', opacity: 0.8 })
  out += text(cx + 52, cy + 176, '本页是真实可预览的 HTML 高保真稿示例（无外部依赖）。', { size: 11, fill: '#FFFFFF', opacity: 0.6 })
  // section
  out += text(cx + 52, cy + 258, '设计稿预览 · 关键界面', { size: 20, weight: 700, fill: C.ink })
  out += text(cx + 52, cy + 282, '同一套 alias token；浅色 / 深色主题都可读。', { size: 12, fill: C.ink3 })
  // three cards
  const cards = [
    ['流水线设计卡', '待你确认提示条 + 缩略图 + 通过 / 打回', 'pipeline'],
    ['预览弹层', 'HTML iframe + 三档宽度 + 查看源码', 'modal'],
    ['工作台设计卡', '待你确认徽标 + 空态 + 预览入口', 'wb'],
  ]
  for (let i = 0; i < 3; i++) {
    const x = cx + 52 + i * 352
    out += rect(x, cy + 304, 328, 178, { rx: 12, fill: C.surface, stroke: C.line, sw: 1, filter: 'sh1' })
    out += text(x + 20, cy + 334, cards[i][0], { size: 15, weight: 700, fill: C.ink })
    out += lines(x + 20, cy + 358, [cards[i][1]], { size: 11, fill: C.ink3 })
    if (cards[i][2] === 'pipeline') {
      out += rect(x + 20, cy + 376, 288, 54, { rx: 7, fill: C.warnSoft, stroke: C.warnBorder, sw: 1 })
      out += text(x + 34, cy + 396, '! 设计稿待你确认 · 确认后进入开发', { size: 10.5, weight: 700, fill: C.warnDeep })
      out += text(x + 34, cy + 414, '第 2 关 · 3 个产物', { size: 9.5, fill: C.warn })
      out += rect(x + 20, cy + 440, 88, 30, { rx: 6, fill: C.surface2 })
      out += text(x + 64, cy + 459, '缩略图', { size: 9.5, fill: C.ink3, anchor: 'middle' })
    } else if (cards[i][2] === 'modal') {
      out += rect(x + 20, cy + 376, 288, 54, { rx: 7, fill: C.surface2, stroke: C.field, sw: 1 })
      out += text(x + 32, cy + 396, 'iframe · sandbox=""', { size: 10, fill: C.ink2, family: MONO })
      out += rect(x + 32, cy + 406, 40, 18, { rx: 9, fill: C.surface, stroke: C.line2, sw: 1 })
      out += text(x + 52, cy + 419, '768', { size: 8.5, fill: C.ink, anchor: 'middle' })
      out += text(x + 80, cy + 419, '360 / 768 / 1280', { size: 9, fill: C.ink3 })
      out += btn(x + 20, cy + 440, 96, 30, '确认设计', { kind: 'primary', size: 10 })
    } else {
      out += rect(x + 20, cy + 376, 288, 54, { rx: 7, fill: C.surface2, stroke: C.line2, sw: 1, dash: '5 5' })
      out += text(x + 164, cy + 400, '设计阶段尚未提交截图', { size: 10.5, weight: 700, fill: C.ink, anchor: 'middle' })
      out += text(x + 164, cy + 418, 'HTML 不能替代截图', { size: 9, fill: C.ink3, anchor: 'middle' })
      out += btn(x + 20, cy + 440, 96, 30, '预览设计稿', { kind: 'secondary', icon: 'eye', size: 9.5 })
    }
  }
  // second row: note
  out += rect(cx + 52, cy + 502, cw - 104, 66, { rx: 10, fill: C.surface, stroke: C.line, sw: 1 })
  out += text(cx + 72, cy + 528, '说明', { size: 12, weight: 700, fill: C.ink })
  out += text(cx + 72, cy + 548, '本 HTML 稿是「可预览设计稿」示例：不加载外部字体/脚本，打开即渲染；产品内预览默认 sandbox="" 禁脚本。', { size: 10.5, fill: C.ink2 })
  // bottom warn strip
  out += rect(cx + 52, cy + 590, cw - 104, 48, { rx: 8, fill: C.warnSoft, stroke: C.warnBorder, sw: 1 })
  out += circle(cx + 70, cy + 614, 9, { fill: C.warnFill })
  out += text(cx + 70, cy + 617.5, '!', { size: 9.5, weight: 700, fill: C.warnDeep, anchor: 'middle' })
  out += text(cx + 88, cy + 608, '设计稿待你确认 · 确认后进入开发', { size: 12, weight: 700, fill: C.warnDeep })
  out += text(cx + 88, cy + 626, '点「源码」切到编辑视图可保存；预览失败时保留「查看源码」退路。', { size: 10, fill: C.warn })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${defs()}
${out}
</svg>`
}
writeFileSync(join(OUT, 'design-gate-html-file-preview-1440.svg'), m4html())
console.log('wrote d4 html preview')
