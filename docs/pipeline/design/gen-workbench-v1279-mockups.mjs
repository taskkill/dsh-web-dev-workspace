#!/usr/bin/env node
/**
 * v1.2.79 工作台 UI 全面重构 · 高保真效果图生成器
 *
 * 输出（docs/pipeline/design/）：
 *   workbench-v1279-overview-light-1440.svg   1440×1024 首屏（浅色）
 *   workbench-v1279-overview-dark-1440.svg    1440×1024 首屏（深色）
 *   workbench-v1279-full-light-1440.svg       1440×1580 全页（浅色）
 *   workbench-v1279-mobile-light-390.svg      390×844 移动端（浅色）
 *   workbench-v1279-overview-light-r1-1440.svg 迭代第 1 版（浅色，含已知问题）
 *
 * 字体：Noto Sans SC 子集（脚本 write() 后由渲染流程按 SVG 文本取字集下载）。
 * 本脚本只写 SVG；PNG 由 scripts/render-workbench-v1279.mjs 渲染。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import nodePath from 'node:path'

const OUT = nodePath.resolve('docs/pipeline/design')

const THEMES = {
  light: {
    page: '#EEF2F7', pageTop: '#E4ECF7', shell: '#FFFFFF', side: '#F7F9FC',
    surface: '#FFFFFF', surface2: '#F5F8FC', border: '#E2E8F1', borderStrong: '#CBD5E1',
    text: '#0F172A', text2: '#475569', caption: '#64748B', faint: '#94A3B8',
    brand: '#2563EB', brandSoft: '#EAF1FF', brandText: '#1D4ED8', brandLine: '#BFD3F8',
    warn: '#B45309', warnSoft: '#FEF3C7', success: '#15803D', successSoft: '#DCFCE7',
    error: '#B91C1C', errorSoft: '#FEE2E2', business: '#1D4ED8', businessSoft: '#DBEAFE',
    idle: '#94A3B8', idleSoft: '#F1F5F9',
    hero1: '#1D3E8F', hero2: '#0B1220', heroGlow: '#3B82F6', heroFg: '#FFFFFF',
    heroFg2: 'rgba(255,255,255,0.76)', heroFg3: 'rgba(255,255,255,0.56)',
    shadow: 'rgba(15,23,42,0.08)', shadowStrong: 'rgba(15,23,42,0.16)',
    nav: '#CBD5E1', scroll: '#CBD5E1',
  },
  dark: {
    page: '#0B0F15', pageTop: '#0E1522', shell: '#10151D', side: '#0D1219',
    surface: '#151B24', surface2: '#121821', border: '#26303D', borderStrong: '#334155',
    text: '#E8EDF5', text2: '#B3BDCB', caption: '#8B97A8', faint: '#64748B',
    brand: '#60A5FA', brandSoft: '#16263F', brandText: '#93C5FD', brandLine: '#1E3A5F',
    warn: '#FBBF24', warnSoft: '#2C2410', success: '#34D399', successSoft: '#0F2A22',
    error: '#F87171', errorSoft: '#2C1516', business: '#60A5FA', businessSoft: '#12233C',
    idle: '#64748B', idleSoft: '#1A212C',
    hero1: '#17306E', hero2: '#060A11', heroGlow: '#2563EB', heroFg: '#FFFFFF',
    heroFg2: 'rgba(255,255,255,0.74)', heroFg3: 'rgba(255,255,255,0.52)',
    shadow: 'rgba(0,0,0,0.45)', shadowStrong: 'rgba(0,0,0,0.6)',
    nav: '#334155', scroll: '#334155',
  },
}

const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const r = (n) => Math.round(n * 100) / 100

function text(x, y, value, opts = {}) {
  const { size = 13, weight = 400, fill = '#0F172A', anchor = 'start', spacing = 0, opacity = 1 } = opts
  const ls = spacing === 0 ? '' : ` letter-spacing="${spacing}"`
  return `<text x="${r(x)}" y="${r(y)}" font-size="${size}" font-weight="${weight}" fill="${fill}"${ls} text-anchor="${anchor}"${opacity === 1 ? '' : ` opacity="${opacity}"`}>${esc(value)}</text>`
}

function rect(x, y, w, h, opts = {}) {
  const { fill = 'none', stroke = 'none', sw = 1, rx = 0, opacity = 1, filter = '' } = opts
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${rx}" fill="${fill}"${stroke === 'none' ? '' : ` stroke="${stroke}" stroke-width="${sw}"`}${opacity === 1 ? '' : ` opacity="${opacity}"`}${filter === '' ? '' : ` filter="url(#${filter})"`}/>`
}

function line(x1, y1, x2, y2, stroke, sw = 1, dash = '') {
  return `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${stroke}" stroke-width="${sw}"${dash === '' ? '' : ` stroke-dasharray="${dash}"`}/>`
}

function circle(cx, cy, rr, fill, opts = {}) {
  const { stroke = 'none', sw = 1, opacity = 1 } = opts
  return `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rr)}" fill="${fill}"${stroke === 'none' ? '' : ` stroke="${stroke}" stroke-width="${sw}"`}${opacity === 1 ? '' : ` opacity="${opacity}"`}/>`
}

function path(d, opts = {}) {
  const { fill = 'none', stroke = 'none', sw = 1.6, opacity = 1, cap = 'round' } = opts
  return `<path d="${d}" fill="${fill}"${stroke === 'none' ? '' : ` stroke="${stroke}" stroke-width="${sw}" stroke-linecap="${cap}" stroke-linejoin="round"`}${opacity === 1 ? '' : ` opacity="${opacity}"`}/>`
}

function pill(x, y, w, h, label, opts = {}) {
  const { fill = '#F1F5F9', stroke = 'none', color = '#334155', size = 11, weight = 600 } = opts
  return `${rect(x, y, w, h, { fill, stroke, rx: h / 2 })}${text(x + w / 2, y + h / 2 + size * 0.36, label, { size, weight, fill: color, anchor: 'middle' })}`
}

function button(x, y, w, h, label, opts = {}) {
  const {
    fill = '#FFFFFF', stroke = '#E2E8F1', color = '#0F172A', size = 12, weight = 600, rx = 10, dot = false, dotColor = '#2563EB',
  } = opts
  const dotSvg = dot ? circle(x + 16, y + h / 2, 3.5, dotColor) : ''
  const tx = dot ? x + 26 : x + w / 2
  return `${rect(x, y, w, h, { fill, stroke, rx })}${text(dot ? tx : x + w / 2, y + h / 2 + size * 0.36, label, { size, weight, fill: color, anchor: dot ? 'start' : 'middle' })}`
}

function iconBox(cx, cy, size, bg) {
  return rect(cx - size / 2, cy - size / 2, size, size, { fill: bg, rx: size * 0.3 })
}

function navIcon(kind, x, y, color) {
  const s = 16
  const c = x + s / 2
  const m = y + s / 2
  switch (kind) {
    case 'workbench':
      return `${path(`M${x + 2} ${y + 5.5} L${x + 8} ${y + 2} L${x + 14} ${y + 5.5} L${x + 14} ${y + 13.5} L${x + 2} ${y + 13.5} Z`, { stroke: color, sw: 1.5 })}${path(`M${x + 6} ${y + 13.5} L${x + 6} ${y + 9} L${x + 10} ${y + 9} L${x + 10} ${y + 13.5}`, { stroke: color, sw: 1.3 })}`
    case 'file':
      return path(`M${x + 3.5} ${y + 1.8} L${x + 9.8} ${y + 1.8} L${x + 12.8} ${y + 4.8} L${x + 12.8} ${y + 14.2} L${x + 3.5} ${y + 14.2} Z`, { stroke: color, sw: 1.5 })
    case 'search':
      return `${circle(x + 7, y + 7, 4.3, 'none', { stroke: color, sw: 1.6 })}${line(x + 10.2, y + 10.2, x + 14, y + 14, color, 1.6)}`
    case 'more':
      return [3.2, 8, 12.8].map((dx) => circle(x + dx, m, 1.1, color)).join('')
    case 'pipeline':
      return [4, 8, 12].map((dy) => `${rect(x + 2.5, y + dy - 1.5, 11, 3, { fill: color, rx: 1.5 })}${circle(x + 12, y + dy, 1.4, '#FFFFFF')}`).join('')
    case 'acceptance':
      return `${rect(x + 2.2, y + 2.2, 11.6, 11.6, { stroke: color, sw: 1.5, rx: 2.4 })}${path(`M${x + 5} ${y + 8.4} L${x + 7.4} ${y + 10.8} L${x + 11.4} ${y + 5.6}`, { stroke: color, sw: 1.6 })}`
    case 'todo':
      return `${[4.2, 8, 11.8].map((dy) => circle(x + 3, y + dy, 1.2, color)).join('')}${[4.2, 8, 11.8].map((dy) => line(x + 6, y + dy, x + 14, y + dy, color, 1.4)).join('')}`
    case 'task':
      return `${circle(x + 8, y + 8, 6.2, 'none', { stroke: color, sw: 1.5 })}${path(`M${x + 6.6} ${y + 5.4} L${x + 11} ${y + 8} L${x + 6.6} ${y + 10.6} Z`, { fill: color })}`
    case 'git':
      return `${circle(x + 5, y + 4, 1.8, 'none', { stroke: color, sw: 1.4 })}${circle(x + 5, y + 12, 1.8, 'none', { stroke: color, sw: 1.4 })}${circle(x + 11.5, y + 4, 1.8, 'none', { stroke: color, sw: 1.4 })}${line(x + 5, y + 5.8, x + 5, y + 10.2, color, 1.4)}${path(`M${x + 11.5} ${y + 5.8} L${x + 11.5} ${y + 7.6} Q${x + 11.5} ${y + 9.4} ${x + 9.4} ${y + 9.4} L${x + 5} ${y + 9.4}`, { stroke: color, sw: 1.4 })}`
    case 'memory':
      return `${path(`M${x + 3} ${y + 2.5} L${x + 12.5} ${y + 2.5} L${x + 12.5} ${y + 13.5} L${x + 3} ${y + 13.5} Z`, { stroke: color, sw: 1.4 })}${line(x + 6, y + 2.5, x + 6, y + 13.5, color, 1.4)}${line(x + 8, y + 6, x + 11, y + 6, color, 1.1)}${line(x + 8, y + 9, x + 11, y + 9, color, 1.1)}`
    default:
      return ''
  }
}

function scrollbar(theme, x, y, h) {
  return `${rect(x, y, 5, h, { fill: theme.nav, rx: 2.5, opacity: 0.55 })}`
}

function shell(theme, H, opts = {}) {
  const { compact = false, title = 'Dev Workspace', workspace = '工作区 / dsh-web-filebrowser', project = '工作台 UI 全面重构 · 第 7 轮', nav = true } = opts
  const out = []
  out.push(rect(0, 0, 1440, H, { fill: theme.page }))
  out.push(rect(0, 0, 1440, 340, { fill: 'url(#pageGrad)' }))
  // 顶栏
  out.push(rect(0, 0, 1440, 52, { fill: theme.shell }))
  out.push(line(0, 52, 1440, 52, theme.border))
  out.push(rect(16, 12, 28, 28, { fill: 'url(#brandGrad)', rx: 8 }))
  out.push(path('M24 21 L32 26 L32 32 L24 32 Z', { fill: 'rgba(255,255,255,0.9)' }))
  out.push(path('M33 32 L33 25.6 L40 21 L40 32 Z', { fill: 'rgba(255,255,255,0.55)' }))
  out.push(text(54, 31, title, { size: 13, weight: 700, fill: theme.text }))
  out.push(text(154, 31, workspace, { size: 11, fill: theme.caption }))
  out.push(text(1128, 31, project, { size: 11.5, fill: theme.caption, anchor: 'end' }))
  out.push(circle(1396, 26, 13, theme.brandSoft, { stroke: theme.brandLine }))
  out.push(text(1396, 30.5, '你', { size: 10, weight: 600, fill: theme.brandText, anchor: 'middle' }))
  // 侧栏
  if (nav) {
    out.push(rect(0, 52, 248, H - 52, { fill: theme.side }))
    out.push(line(248, 52, 248, H, theme.border))
    let y = 78
    const groups = [
      { label: '工作区', items: [['workbench', '工作台', true], ['file', '文件'], ['search', '搜索'], ['more', '更多']] },
      { label: '项目', items: [['pipeline', '流水线'], ['acceptance', '验收'], ['todo', '待办']] },
      { label: '开发', items: [['task', '任务'], ['git', 'Git'], ['memory', '记忆']] },
    ]
    for (const group of groups) {
      out.push(text(20, y, group.label, { size: 10, weight: 600, fill: theme.caption, spacing: 1.2 }))
      y += 14
      for (const [kind, label, active] of group.items) {
        if (active) {
          out.push(rect(8, y, 232, 32, { fill: theme.brandSoft, rx: 8 }))
          out.push(rect(8, y + 8, 2, 16, { fill: theme.brand, rx: 1 }))
        }
        out.push(navIcon(kind, 22, y + 8, active ? theme.brandText : theme.text2))
        out.push(text(46, y + 21, label, { size: 12.5, weight: active ? 600 : 400, fill: active ? theme.brandText : theme.text2 }))
        y += 34
      }
      y += 16
    }
    // 底部团队入口
    const cardY = H - 92
    out.push(rect(12, cardY, 224, 64, { fill: theme.surface, stroke: theme.border, rx: 12 }))
    out.push(iconBox(36, cardY + 24, 22, theme.brandSoft))
    out.push(navIcon('task', 28, cardY + 16, theme.brandText))
    out.push(text(56, cardY + 22, '团队面板入口', { size: 12, weight: 600, fill: theme.text }))
    out.push(text(56, cardY + 38, '6 个角色 · 2 执行中', { size: 10.5, fill: theme.caption }))
    out.push(text(56, cardY + 53, '打开团队面板 →', { size: 10.5, weight: 600, fill: theme.brand }))
    if (compact) {
      out.push(rect(8, 64, 232, 26, { fill: theme.brandSoft, rx: 8 }))
    }
  }
  return out
}

function pageHead(theme, opts = {}) {
  const { full = true, variant = 'final' } = opts
  const out = []
  out.push(rect(248, 52, 1192, 108, { fill: theme.shell }))
  out.push(line(248, 160, 1440, 160, theme.border))
  out.push(text(280, 80, '工作区 · dsh-web-filebrowser · 第 7 轮', { size: 10.5, weight: 600, fill: theme.caption, spacing: 1.1 }))
  const titleSize = variant === 'r1' ? 26 : 30
  out.push(text(280, 118, '工作台', { size: titleSize, weight: 700, fill: theme.text, spacing: -0.6 }))
  out.push(pill(408, 95, 62, 22, '第 7 轮', { fill: theme.surface2, stroke: theme.border, color: theme.text2 }))
  out.push(pill(478, 95, 76, 22, '快速模式', { fill: theme.successSoft, stroke: 'none', color: theme.success }))
  out.push(pill(562, 95, 76, 22, '4/7 已通过', { fill: theme.brandSoft, stroke: 'none', color: theme.brandText }))
  out.push(text(280, 144, '当前：验收复核 · 待评审 · 需要你确认后进入人工确认', { size: 11.5, fill: theme.caption }))
  // 右侧动作组
  out.push(button(1052, 74, 74, 32, '刷新', { fill: theme.surface2, stroke: theme.border, color: theme.text2 }))
  out.push(button(1134, 74, 96, 32, '打开流水线', { fill: theme.surface2, stroke: theme.border, color: theme.text2 }))
  out.push(button(1238, 74, 64, 32, '团队', { fill: theme.surface2, stroke: theme.border, color: theme.text2 }))
  out.push(rect(1314, 74, 32, 32, { fill: theme.surface2, stroke: theme.border, rx: 8 }))
  out.push(circle(1330, 90, 5, 'none', { stroke: theme.text2, sw: 1.4 }))
  out.push(path('M1326 95 Q1330 100 1334 95', { stroke: theme.text2, sw: 1.3 }))
  out.push(rect(1358, 74, 32, 32, { fill: theme.surface2, stroke: theme.border, rx: 8 }))
  out.push(path('M1368 83 L1378 93 M1378 83 L1368 93', { stroke: theme.text2, sw: 1.4 }))
  return out
}

function statusPill(theme, x, y, status) {
  const map = {
    approved: ['已通过', theme.success, theme.successSoft],
    active: ['进行中', theme.business, theme.businessSoft],
    review: ['待评审', theme.warn, theme.warnSoft],
    pending: ['待开始', theme.caption, theme.idleSoft],
    failed: ['已打回', theme.error, theme.errorSoft],
  }
  const [label, color, bg] = map[status] ?? map.pending
  return pill(x, y, 58, 20, label, { fill: bg, color, size: 10.5 })
}

function hero(theme, opts = {}) {
  const { variant = 'final' } = opts
  const x = 280
  const y = 216
  const w = 1128
  const h = 270
  const out = []
  out.push(`<g filter="url(#heroShadow)">${rect(x, y, w, h, { fill: 'url(#heroGrad)', rx: 18 })}</g>`)
  out.push(rect(x, y, w, h, { fill: 'url(#heroGlow)', rx: 18 }))
  out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="none" stroke="rgba(255,255,255,0.08)"/>`)
  // 左列
  out.push(text(x + 28, y + 34, 'STAGE 05 / 07 · 当前阶段', { size: 10.5, weight: 600, fill: theme.heroFg3, spacing: 1.4 }))
  const titleSize = variant === 'r1' ? 26 : 30
  out.push(text(x + 28, y + 76, '验收复核', { size: titleSize, weight: 700, fill: theme.heroFg, spacing: -0.4 }))
  out.push(pill(x + (variant === 'r1' ? 140 : 160), y + 54, 60, 22, '待评审', { fill: 'rgba(245,158,11,0.16)', stroke: 'rgba(252,211,77,0.45)', color: '#FCD34D' }))
  out.push(text(x + 28, y + 104, '建议放行 · 阻断项 0 · 复测 3/3 通过', { size: 13, fill: theme.heroFg2 }))
  out.push(text(x + 28, y + 128, '负责：项目经理 Agent · 第 7 轮 · 快速模式', { size: 11.5, fill: theme.heroFg3 }))
  // 7 段时间轴
  const railX = x + 28
  const railY = y + 152
  const segW = (748 - 6 * 8) / 7
  const segGap = 8
  const stageLabels = ['需求', '设计', '开发', '测试', '验收', '确认', '发布']
  const states = ['approved', 'approved', 'approved', 'approved', 'review', 'pending', 'pending']
  states.forEach((state, i) => {
    const sx = railX + i * (segW + segGap)
    const fill = state === 'approved' ? '#34D399' : state === 'review' ? '#FBBF24' : 'rgba(255,255,255,0.18)'
    out.push(rect(sx, railY, segW, 6, { fill, rx: 3 }))
    out.push(text(sx, railY + 22, stageLabels[i], { size: 10, weight: 600, fill: state === 'pending' ? theme.heroFg3 : theme.heroFg2 }))
  })
  out.push(text(railX + 28 + 7 * (segW + segGap), railY + 6, '', { size: 10 }))
  out.push(text(x + 28, y + 208, '已通过 4 / 7 关 · 本轮预计还需 3 个阶段', { size: 11, fill: theme.heroFg3 }))
  // 右栏
  const rx = x + w - 28 - 300
  out.push(rect(rx - 22, y + 24, 1, h - 48, { fill: 'rgba(255,255,255,0.12)' }))
  const ringCx = rx + 46
  const ringCy = y + 72
  const ringR = 34
  const circumference = 2 * Math.PI * ringR
  const progress = 4 / 7
  out.push(circle(ringCx, ringCy, ringR, 'none', { stroke: 'rgba(255,255,255,0.16)', sw: 7 }))
  out.push(
    `<circle cx="${ringCx}" cy="${ringCy}" r="${ringR}" fill="none" stroke="#60A5FA" stroke-width="7" stroke-linecap="round" stroke-dasharray="${circumference} ${circumference}" stroke-dashoffset="${circumference * (1 - progress)}" transform="rotate(-90 ${ringCx} ${ringCy})"/>`,
  )
  out.push(text(ringCx, ringCy + 4, '4/7', { size: 19, weight: 700, fill: theme.heroFg, anchor: 'middle' }))
  out.push(text(rx + 100, y + 52, '已通过 4 关', { size: 12, weight: 600, fill: theme.heroFg }))
  out.push(text(rx + 100, y + 70, '当前第 5 关 · 验收复核', { size: 11, fill: theme.heroFg2 }))
  out.push(text(rx + 100, y + 88, '门禁：你确认后解锁人工确认', { size: 10.5, fill: theme.heroFg3 }))
  // 主操作（final: 主/次并排两行；r1: 三按钮一行，显示拥挤问题）
  if (variant === 'r1') {
    out.push(button(rx, y + 128, 92, 30, '通过', { fill: '#FFFFFF', stroke: 'none', color: '#0B1220', size: 11 }))
    out.push(button(rx + 100, y + 128, 92, 30, '打回', { fill: 'transparent', stroke: 'rgba(255,255,255,0.3)', color: '#FFFFFF', size: 11 }))
    out.push(button(rx + 200, y + 128, 92, 30, '查看', { fill: 'transparent', stroke: 'rgba(255,255,255,0.3)', color: '#FFFFFF', size: 11 }))
    out.push(rect(rx, y + 168, 292, 32, { fill: 'rgba(255,255,255,0.08)', stroke: 'rgba(255,255,255,0.18)', rx: 8 }))
    out.push(text(rx + 10, y + 188, '评审备注（可选）', { size: 10.5, fill: theme.heroFg3 }))
    out.push(text(rx, y + 222, '通过后进入人工确认；发布仍锁定', { size: 10, fill: theme.heroFg3 }))
  } else {
    out.push(button(rx, y + 112, 140, 44, '通过', { fill: '#FFFFFF', stroke: 'none', color: '#0B1220', size: 13, rx: 10 }))
    out.push(button(rx + 152, y + 112, 140, 44, '打回', { fill: 'rgba(255,255,255,0.06)', stroke: 'rgba(255,255,255,0.28)', color: '#FFFFFF', size: 13, rx: 10 }))
    out.push(rect(rx, y + 168, 292, 34, { fill: 'rgba(255,255,255,0.08)', stroke: 'rgba(255,255,255,0.16)', rx: 8 }))
    out.push(text(rx + 12, y + 189, '评审备注（可选）', { size: 10.5, fill: theme.heroFg3 }))
    out.push(text(rx, y + 222, '通过后进入人工确认；发布仍保持锁定', { size: 10, fill: theme.heroFg3 }))
    out.push(text(rx, y + 240, '查看复核报告 →', { size: 10.5, weight: 600, fill: '#93C5FD' }))
  }
  return out
}

function alertCard(theme) {
  const x = 280
  const y = 502
  const w = 1128
  const h = 56
  const out = []
  out.push(rect(x, y, w, h, { fill: theme.surface, stroke: theme.border, rx: 14, filter: 'cardShadow' }))
  out.push(rect(x, y + 10, 3, h - 20, { fill: theme.warn, rx: 1.5 }))
  out.push(circle(x + 32, y + 28, 15, theme.warnSoft))
  out.push(text(x + 32, y + 33, '!', { size: 15, weight: 700, fill: theme.warn, anchor: 'middle' }))
  out.push(text(x + 58, y + 24, '验收失败 2 项 · 需要你处理', { size: 13, weight: 600, fill: theme.text }))
  out.push(text(x + 58, y + 41, '失败项已同步到待办；可发给团队修复，或直接查看验收清单。', { size: 11, fill: theme.caption }))
  out.push(pill(x + 902, y + 18, 56, 20, '2 项', { fill: theme.warnSoft, color: theme.warn }))
  out.push(button(x + 972, y + 14, 72, 28, '发给团队', { fill: theme.surface2, stroke: theme.border, color: theme.text2, size: 11 }))
  out.push(text(x + w - 20, y + 34, '查看验收 →', { size: 11, weight: 600, fill: theme.brand, anchor: 'end' }))
  return out
}

function projectCards(theme, opts = {}) {
  const { variant = 'final' } = opts
  const out = []
  const cols = variant === 'r1' ? 2 : 3
  const gap = 14
  const totalW = 1128
  const w = cols === 3 ? (totalW - gap * 2) / 3 : (totalW - gap) / 2
  const y = 606
  const h = 170
  const xs = cols === 3 ? [280, 280 + w + gap, 280 + (w + gap) * 2] : [280, 280 + w + gap]
  // 项目状态
  {
    const x = xs[0]
    out.push(rect(x, y, w, h, { fill: theme.surface, stroke: theme.border, rx: 14, filter: 'cardShadow' }))
    out.push(iconBox(x + 26, y + 24, 20, theme.brandSoft))
    out.push(navIcon('pipeline', x + 18, y + 16, theme.brandText))
    out.push(text(x + 42, y + 28, '项目状态', { size: 13.5, weight: 600, fill: theme.text }))
    out.push(text(x + 18, y + 68, '4/7', { size: 28, weight: 700, fill: theme.text, spacing: -0.8 }))
    out.push(text(x + 78, y + 62, '关已完成', { size: 10.5, fill: theme.caption }))
    out.push(text(x + 78, y + 76, '当前：验收复核', { size: 10.5, fill: theme.faint }))
    out.push(rect(x + 18, y + 88, w - 36, 6, { fill: theme.surface2, rx: 3 }))
    out.push(rect(x + 18, y + 88, (w - 36) * (4 / 7), 6, { fill: theme.brand, rx: 3 }))
    out.push(pill(x + 18, y + 104, 58, 20, '第 7 轮', { fill: theme.surface2, stroke: theme.border, color: theme.text2, size: 10 }))
    out.push(pill(x + 82, y + 104, 72, 20, '快速模式', { fill: theme.successSoft, color: theme.success, size: 10 }))
    out.push(text(x + 18, y + 148, '查看流水线 →', { size: 11, weight: 600, fill: theme.brand }))
    out.push(text(x + w - 18, y + 148, '打开需求', { size: 11, weight: 600, fill: theme.brand, anchor: 'end' }))
  }
  // 团队与指派
  {
    const x = xs[1]
    out.push(rect(x, y, w, h, { fill: theme.surface, stroke: theme.border, rx: 14, filter: 'cardShadow' }))
    out.push(iconBox(x + 26, y + 24, 20, theme.businessSoft))
    out.push(navIcon('task', x + 18, y + 16, theme.business))
    out.push(text(x + 42, y + 28, '团队与指派', { size: 13.5, weight: 600, fill: theme.text }))
    out.push(text(x + 42, y + 43, '2 执行中 · 1 待确认', { size: 10, fill: theme.caption }))
    const roles = [
      ['产品经理', 'idle'], ['UI 设计师', 'running'], ['全栈开发', 'running'],
      ['测试工程师', 'review'], ['项目经理 Agent', 'idle'], ['运维', 'idle'],
    ]
    const chipW = (w - 36 - 8) / 2
    roles.forEach(([label, state], i) => {
      const cx = x + 18 + (i % 2) * (chipW + 8)
      const cy = y + 54 + Math.floor(i / 2) * 26
      out.push(rect(cx, cy, chipW, 22, { fill: theme.surface2, stroke: theme.border, rx: 6 }))
      const dotColor = state === 'running' ? theme.business : state === 'review' ? theme.warn : theme.faint
      out.push(circle(cx + 10, cy + 11, 3, dotColor))
      out.push(text(cx + 18, cy + 15, label, { size: 9.8, fill: theme.text2 }))
    })
    out.push(button(x + 18, y + 134, 78, 26, '指派任务', { fill: theme.text, stroke: 'none', color: theme.shell, size: 10.5 }))
    out.push(text(x + w - 18, y + 150, '团队面板入口 →', { size: 10.5, weight: 600, fill: theme.brand, anchor: 'end' }))
  }
  // 需求与调整（final 第三列；r1 时全宽第二行）
  {
    const x = cols === 3 ? xs[2] : 280
    const y2 = cols === 3 ? y : y + h + 14
    const w2 = cols === 3 ? w : totalW
    const h2 = cols === 3 ? h : 128
    out.push(rect(x, y2, w2, h2, { fill: theme.surface, stroke: theme.border, rx: 14, filter: 'cardShadow' }))
    out.push(iconBox(x + 26, y2 + 24, 20, theme.successSoft))
    out.push(navIcon('acceptance', x + 18, y2 + 16, theme.success))
    out.push(text(x + 42, y2 + 28, '需求与调整', { size: 13.5, weight: 600, fill: theme.text }))
    out.push(text(x + 18, y2 + 52, '工作台 UI 全面重构：现代 · 大气 · 简洁干练', { size: 12.5, weight: 600, fill: theme.text }))
    out.push(pill(x + 18, y2 + 62, 54, 19, '第 7 轮', { fill: theme.surface2, color: theme.text2, size: 9.5 }))
    out.push(pill(x + 78, y2 + 62, 62, 19, '范围 full', { fill: theme.surface2, color: theme.text2, size: 9.5 }))
    out.push(text(x + 18, y2 + 98, '从「卡片堆叠」升级为指挥舱：深色 hero、7 段时间轴、', { size: 10.5, fill: theme.text2 }))
    out.push(text(x + 18, y2 + 112, 'bento 交付卡与统一 token；保留全部现有功能。', { size: 10.5, fill: theme.text2 }))
    const by = y2 + (cols === 3 ? 128 : 96)
    out.push(button(x + 18, by, 70, 26, '查看需求', { fill: theme.surface2, stroke: theme.border, color: theme.text2, size: 10 }))
    out.push(button(x + 96, by, 60, 26, '追加', { fill: theme.surface2, stroke: theme.border, color: theme.text2, size: 10 }))
    out.push(button(x + 164, by, 60, 26, '修改', { fill: theme.surface2, stroke: theme.border, color: theme.text2, size: 10 }))
    out.push(button(x + 232, by, 70, 26, '新轮变更', { fill: theme.text, stroke: 'none', color: theme.shell, size: 10 }))
  }
  return out
}

function flowCard(theme) {
  const x = 280
  const y = 824
  const w = 1128
  const h = 154
  const out = []
  out.push(rect(x, y, w, h, { fill: theme.surface, stroke: theme.border, rx: 14, filter: 'cardShadow' }))
  out.push(iconBox(x + 26, y + 24, 20, theme.brandSoft))
  out.push(navIcon('pipeline', x + 18, y + 16, theme.brandText))
  out.push(text(x + 42, y + 28, '项目流程', { size: 13.5, weight: 600, fill: theme.text }))
  out.push(pill(x + 110, y + 14, 56, 19, '第 7 轮', { fill: theme.surface2, color: theme.text2, size: 9.5 }))
  out.push(text(x + w - 18, y + 28, '打开流水线 →', { size: 11, weight: 600, fill: theme.brand, anchor: 'end' }))
  const stages = [
    ['需求分析', '产品经理', 'approved'], ['UI 设计', 'UI 设计师', 'approved'], ['开发实现', '全栈开发', 'approved'],
    ['测试验收', '测试工程师', 'approved'], ['验收复核', '项目经理 Agent', 'review'], ['人工确认', '你（Owner）', 'pending'], ['发布上线', '运维', 'pending'],
  ]
  const stepW = (w - 36) / 7
  const baseY = y + 60
  stages.forEach(([name, role, state], i) => {
    const sx = x + 18 + i * stepW
    if (state === 'review') {
      out.push(rect(sx + 2, y + 44, stepW - 4, 60, { fill: theme.warnSoft, stroke: '#F2D38B', rx: 10 }))
    }
    const dotFill = state === 'approved' ? theme.success : state === 'review' ? theme.warn : theme.surface2
    out.push(circle(sx + 14, baseY, 7, dotFill, { stroke: state === 'pending' ? theme.borderStrong : 'none', sw: 1.5 }))
    if (state === 'approved') out.push(path(`M${sx + 11} ${baseY} L${sx + 13.4} ${baseY + 2.4} L${sx + 17.4} ${baseY - 2.4}`, { stroke: '#FFFFFF', sw: 1.5 }))
    if (i < stages.length - 1) out.push(line(sx + 21, baseY, sx + stepW - 4, baseY, theme.border, 2))
    out.push(text(sx + 4, y + 82, name, { size: 11.5, weight: 600, fill: theme.text }))
    out.push(text(sx + 4, y + 96, role, { size: 9.5, fill: theme.caption }))
    const stateLabel = state === 'approved' ? '已通过' : state === 'review' ? '待评审' : '待开始'
    const stateColor = state === 'approved' ? theme.success : state === 'review' ? theme.warn : theme.faint
    out.push(text(sx + 4, y + 111, stateLabel, { size: 10, weight: state === 'review' ? 600 : 400, fill: stateColor }))
  })
  out.push(line(x + 18, y + 124, x + w - 18, y + 124, theme.border))
  out.push(text(x + 18, y + 142, '流程记录', { size: 9.5, weight: 600, fill: theme.caption }))
  out.push(text(x + 76, y + 142, '11:20 验收复核提交 · 10:58 测试通过 · 10:42 开发完成', { size: 9.5, fill: theme.faint }))
  return out
}

function deliveryCards(theme, opts = {}) {
  const { variant = 'final', y0 = 996 } = opts
  const out = []
  const cols = variant === 'r1' ? 3 : 2
  const gap = 14
  const totalW = 1128
  const w = (totalW - gap * (cols - 1)) / cols
  const h = 184
  const defs = ['设计稿', '验收', '交付前体检', '本轮变更', '运行中']
  const icons = ['workbench', 'acceptance', 'task', 'git', 'task']
  defs.forEach((title, i) => {
    const wide = variant === 'final' && i === 4
    const x = wide ? 280 : 280 + (i % cols) * (w + gap)
    const y = wide ? y0 + 2 * (h + 14) : y0 + Math.floor(i / cols) * (h + 14)
    const cw = wide ? totalW : w
    const ch = wide ? 120 : h
    out.push(rect(x, y, cw, ch, { fill: theme.surface, stroke: theme.border, rx: 14, filter: 'cardShadow' }))
    out.push(iconBox(x + 26, y + 24, 20, theme.surface2))
    out.push(navIcon(icons[i], x + 18, y + 16, theme.text2))
    out.push(text(x + 42, y + 28, title, { size: 13.5, weight: 600, fill: theme.text }))
    if (i === 0) {
      out.push(pill(x + cw - 66, y + 14, 48, 20, '4 张', { fill: theme.brandSoft, color: theme.brandText, size: 10 }))
      ;[0, 1, 2].forEach((k) => {
        out.push(rect(x + 18 + k * 92, y + 46, 84, 52, { fill: theme.surface2, stroke: theme.border, rx: 8 }))
        out.push(circle(x + 44 + k * 92, y + 66, 8, theme.borderStrong))
        out.push(rect(x + 32 + k * 92, y + 82, 56, 3, { fill: theme.border }))
        out.push(rect(x + 32 + k * 92, y + 88, 36, 3, { fill: theme.border }))
      })
      out.push(text(x + 18, y + 124, 'v1.2.79 效果图 · 浅色/深色 · 移动端', { size: 10.5, fill: theme.caption }))
      out.push(text(x + 18, y + 160, '查看设计文档 →', { size: 11, weight: 600, fill: theme.brand }))
    } else if (i === 1) {
      out.push(pill(x + cw - 78, y + 14, 60, 20, '42/42', { fill: theme.successSoft, color: theme.success, size: 10 }))
      out.push(text(x + 18, y + 66, '42', { size: 26, weight: 700, fill: theme.text }))
      out.push(text(x + 58, y + 66, '项通过', { size: 10.5, fill: theme.caption }))
      out.push(pill(x + 18, y + 78, 64, 22, '失败 0', { fill: theme.successSoft, color: theme.success, size: 10 }))
      out.push(pill(x + 88, y + 78, 72, 22, '待验收 2', { fill: theme.surface2, color: theme.text2, size: 10 }))
      out.push(text(x + 18, y + 124, '交付包 · 最新一次 11:12', { size: 10.5, fill: theme.caption }))
      out.push(text(x + 18, y + 160, '打开验收清单 →', { size: 11, weight: 600, fill: theme.brand }))
      out.push(text(x + cw - 18, y + 160, '导出报告', { size: 11, weight: 600, fill: theme.brand, anchor: 'end' }))
    } else if (i === 2) {
      out.push(pill(x + cw - 84, y + 14, 66, 20, '通过', { fill: theme.successSoft, color: theme.success, size: 10 }))
      const rows = ['测试与构建：通过', '变更审阅：1/3 已审', '交付包与证据：就绪']
      rows.forEach((label, k) => {
        out.push(circle(x + 24, y + 62 + k * 24, 4, k === 1 ? theme.warn : theme.success))
        out.push(text(x + 36, y + 66 + k * 24, label, { size: 10.5, fill: theme.text2 }))
      })
      out.push(text(x + 18, y + 160, '写入评审备注 →', { size: 11, weight: 600, fill: theme.brand }))
    } else if (i === 3) {
      out.push(pill(x + cw - 96, y + 14, 78, 20, '已审 1/3', { fill: theme.warnSoft, color: theme.warn, size: 10 }))
      ;['client.js', 'package.json', 'docs/ACCEPTANCE.md'].forEach((name, k) => {
        out.push(text(x + 18, y + 62 + k * 22, name, { size: 10.5, fill: theme.text2 }))
        out.push(text(x + cw - 18, y + 62 + k * 22, k === 0 ? '已审' : '未审', { size: 10, fill: k === 0 ? theme.success : theme.warn, anchor: 'end' }))
      })
      out.push(text(x + 18, y + 160, '打开 Git →', { size: 11, weight: 600, fill: theme.brand }))
    } else {
      out.push(pill(x + cw - 66, y + 14, 48, 20, '1 个', { fill: theme.brandSoft, color: theme.brandText, size: 10 }))
      const stats = [['运行中', '0'], ['最近一次', '11:12'], ['最近结果', '通过'], ['今日失败', '0']]
      stats.forEach(([label, value], k) => {
        const sx = x + 18 + k * 168
        out.push(text(sx, y + 60, label, { size: 10, fill: theme.caption }))
        out.push(text(sx, y + 84, value, { size: 18, weight: 700, fill: k === 2 ? theme.success : theme.text }))
      })
      out.push(line(x + 18, y + 98, x + cw - 18, y + 98, theme.border))
      out.push(circle(x + 24, y + 108, 3, theme.success))
      out.push(text(x + 34, y + 112, '上次运行：npm run test · exit 0 · 47s', { size: 10, fill: theme.faint }))
      out.push(text(x + cw - 18, y + 62, '重跑最近一次', { size: 11, weight: 600, fill: theme.brand, anchor: 'end' }))
      out.push(text(x + cw - 18, y + 84, '打开任务 →', { size: 11, weight: 600, fill: theme.brand, anchor: 'end' }))
    }
  })
  return out
}

function footer(theme, H, full, themeName) {
  return [
    text(280, H - 24, full ? `v1.2.79 · 工作台 UI 全面重构 · 设计稿（1440×1580，${themeName === 'dark' ? '深色' : '浅色'}）` : `v1.2.79 · 工作台首屏（1440×1024，${themeName === 'dark' ? '深色' : '浅色'}）· 交付区在滚动区域继续`, { size: 10, fill: theme.faint }),
    text(1408, H - 24, '设计：指挥舱（Command Deck）· 2026-10-27', { size: 10, fill: theme.faint, anchor: 'end' }),
  ]
}

function defs(theme) {
  return `<defs>
  <linearGradient id="pageGrad" x1="0" y1="0" x2="0.4" y2="1">
    <stop offset="0" stop-color="${theme.brand}" stop-opacity="0.10"/>
    <stop offset="0.55" stop-color="${theme.brand}" stop-opacity="0.02"/>
    <stop offset="1" stop-color="${theme.brand}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${theme.brand}"/>
    <stop offset="1" stop-color="#0B1220"/>
  </linearGradient>
  <linearGradient id="heroGrad" x1="0" y1="0" x2="0.85" y2="1">
    <stop offset="0" stop-color="${theme.hero1}"/>
    <stop offset="0.6" stop-color="${theme.hero2}"/>
    <stop offset="1" stop-color="${theme.hero2}"/>
  </linearGradient>
  <radialGradient id="heroGlow" cx="0.12" cy="0" r="0.9">
    <stop offset="0" stop-color="${theme.heroGlow}" stop-opacity="0.42"/>
    <stop offset="0.55" stop-color="${theme.heroGlow}" stop-opacity="0.06"/>
    <stop offset="1" stop-color="${theme.heroGlow}" stop-opacity="0"/>
  </radialGradient>
  <filter id="cardShadow" x="-8%" y="-12%" width="116%" height="132%">
    <feDropShadow dx="0" dy="1" stdDeviation="1.1" flood-color="${theme.shadow}"/>
  </filter>
  <filter id="heroShadow" x="-6%" y="-10%" width="112%" height="130%">
    <feDropShadow dx="0" dy="18" stdDeviation="26" flood-color="${theme.shadowStrong}"/>
  </filter>
</defs>`
}

function svg({ themeName, H, full, variant, mobile = false }) {
  const theme = THEMES[themeName]
  const body = []
  if (mobile) return mobileSvg(themeName)
  body.push(...shell(theme, H, { compact: full === false }))
  body.push(...pageHead(theme, { variant }))
  body.push(...hero(theme, { variant }))
  body.push(...alertCard(theme))
  body.push(...projectCards(theme, { variant }))
  body.push(...flowCard(theme))
  body.push(...deliveryCards(theme, { variant, y0: 996 }))
  body.push(...footer(theme, H, full, themeName))
  const title = `工作台 UI 全面重构（v1.2.79）· ${themeName === 'dark' ? '深色' : '浅色'}${full ? '全页' : '首屏'}${variant === 'r1' ? ' · 迭代第 1 版' : ''}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="${H}" viewBox="0 0 1440 ${H}" role="img" aria-labelledby="title desc">
<title id="title">${esc(title)}</title>
<desc id="desc">工作台 UI 全面重构：页面头、深色指挥舱 hero、Now 告警卡、三列项目区、七步时间轴与五张 bento 交付卡。</desc>
${defs(theme)}
<style>text{font-family:'Noto Sans SC','Helvetica Neue',Arial,sans-serif;}</style>
${body.join('\n')}
</svg>`
}

function mobileSvg(themeName) {
  const theme = THEMES[themeName]
  const W = 390
  const H = 844
  const out = []
  out.push(rect(0, 0, W, H, { fill: theme.page }))
  out.push(rect(0, 0, W, 340, { fill: 'url(#pageGrad)' }))
  out.push(rect(0, 0, W, 48, { fill: theme.shell }))
  out.push(line(0, 48, W, 48, theme.border))
  out.push(rect(12, 10, 28, 28, { fill: 'url(#brandGrad)', rx: 8 }))
  out.push(path('M20 19 L28 24 L28 30 L20 30 Z', { fill: 'rgba(255,255,255,0.9)' }))
  out.push(text(50, 30, 'Dev Workspace', { size: 12.5, weight: 700, fill: theme.text }))
  out.push(line(358, 22, 372, 22, theme.text2, 1.6))
  out.push(line(358, 27, 372, 27, theme.text2, 1.6))
  out.push(line(358, 32, 372, 32, theme.text2, 1.6))
  out.push(text(16, 78, '工作区 · 第 7 轮', { size: 9.5, weight: 600, fill: theme.caption, spacing: 1 }))
  out.push(text(16, 106, '工作台', { size: 24, weight: 700, fill: theme.text }))
  out.push(pill(102, 88, 56, 20, '第 7 轮', { fill: theme.surface2, stroke: theme.border, color: theme.text2, size: 9.5 }))
  out.push(pill(164, 88, 68, 20, '快速模式', { fill: theme.successSoft, color: theme.success, size: 9.5 }))
  out.push(text(16, 128, '验收复核 · 待评审', { size: 11, fill: theme.caption }))
  // hero
  out.push(`<g filter="url(#heroShadow)">${rect(16, 148, 358, 300, { fill: 'url(#heroGrad)', rx: 16 })}</g>`)
  out.push(rect(16, 148, 358, 300, { fill: 'url(#heroGlow)', rx: 16 }))
  out.push(text(36, 180, 'STAGE 05 / 07 · 当前阶段', { size: 9.5, weight: 600, fill: theme.heroFg3, spacing: 1.1 }))
  out.push(text(36, 214, '验收复核', { size: 24, weight: 700, fill: theme.heroFg }))
  out.push(pill(146, 195, 56, 20, '待评审', { fill: 'rgba(245,158,11,0.16)', stroke: 'rgba(252,211,77,0.45)', color: '#FCD34D', size: 9.5 }))
  out.push(text(36, 238, '建议放行 · 阻断项 0', { size: 11.5, fill: theme.heroFg2 }))
  out.push(text(36, 258, '负责：项目经理 Agent', { size: 10.5, fill: theme.heroFg3 }))
  const states = ['approved', 'approved', 'approved', 'approved', 'review', 'pending', 'pending']
  states.forEach((state, i) => {
    const sx = 36 + i * 43
    const fill = state === 'approved' ? '#34D399' : state === 'review' ? '#FBBF24' : 'rgba(255,255,255,0.18)'
    out.push(rect(sx, 278, 36, 5, { fill, rx: 2.5 }))
  })
  out.push(text(36, 302, '已通过 4/7 · 当前第 5 关', { size: 10, fill: theme.heroFg3 }))
  out.push(button(36, 318, 166, 44, '通过', { fill: '#FFFFFF', stroke: 'none', color: '#0B1220', size: 13 }))
  out.push(button(210, 318, 166, 44, '打回', { fill: 'rgba(255,255,255,0.06)', stroke: 'rgba(255,255,255,0.28)', color: '#FFFFFF', size: 13 }))
  out.push(rect(36, 374, 340, 32, { fill: 'rgba(255,255,255,0.08)', stroke: 'rgba(255,255,255,0.16)', rx: 8 }))
  out.push(text(48, 394, '评审备注（可选）', { size: 10, fill: theme.heroFg3 }))
  out.push(text(36, 428, '通过后进入人工确认；发布仍锁定', { size: 9.5, fill: theme.heroFg3 }))
  // now alert
  out.push(rect(16, 466, 358, 58, { fill: theme.surface, stroke: theme.border, rx: 12 }))
  out.push(rect(16, 476, 3, 38, { fill: theme.warn, rx: 1.5 }))
  out.push(circle(44, 495, 13, theme.warnSoft))
  out.push(text(44, 500, '!', { size: 13, weight: 700, fill: theme.warn, anchor: 'middle' }))
  out.push(text(66, 490, '验收失败 2 项 · 需要你处理', { size: 11.5, weight: 600, fill: theme.text }))
  out.push(text(66, 506, '可发给团队修复，或查看验收清单', { size: 9.5, fill: theme.caption }))
  // project status card
  out.push(text(16, 556, '项目', { size: 9.5, weight: 600, fill: theme.caption, spacing: 1 }))
  out.push(text(16, 574, '项目状态 · 团队 · 需求', { size: 13.5, weight: 600, fill: theme.text }))
  out.push(rect(16, 586, 358, 116, { fill: theme.surface, stroke: theme.border, rx: 12 }))
  out.push(text(32, 632, '4/7', { size: 24, weight: 700, fill: theme.text }))
  out.push(text(84, 626, '关已完成', { size: 10, fill: theme.caption }))
  out.push(text(84, 640, '第 7 轮 · 快速模式', { size: 10, fill: theme.faint }))
  out.push(rect(32, 650, 326, 6, { fill: theme.surface2, rx: 3 }))
  out.push(rect(32, 650, 186, 6, { fill: theme.brand, rx: 3 }))
  out.push(text(32, 686, '查看流水线 →', { size: 10.5, weight: 600, fill: theme.brand }))
  out.push(text(358, 686, '打开需求', { size: 10.5, weight: 600, fill: theme.brand, anchor: 'end' }))
  // delivery section
  out.push(text(16, 734, '交付', { size: 9.5, weight: 600, fill: theme.caption, spacing: 1 }))
  out.push(text(16, 752, '项目流程', { size: 13.5, weight: 600, fill: theme.text }))
  out.push(rect(16, 764, 358, 64, { fill: theme.surface, stroke: theme.border, rx: 12 }))
  states.forEach((state, i) => {
    const sx = 32 + i * 48
    const fill = state === 'approved' ? theme.success : state === 'review' ? theme.warn : theme.surface2
    out.push(circle(sx, 786, 5.5, fill, { stroke: state === 'pending' ? theme.borderStrong : 'none', sw: 1.2 }))
    if (i < 6) out.push(line(sx + 6, 786, sx + 42, 786, theme.border, 1.5))
    out.push(text(sx, 806, ['需求', '设计', '开发', '测试', '验收', '确认', '发布'][i], { size: 8.5, fill: state === 'pending' ? theme.faint : theme.caption, anchor: 'middle' }))
  })
  out.push(text(16, 842, '滚动查看 5 张交付卡 · 360–430 单列', { size: 9, fill: theme.faint }))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
<title id="title">工作台 UI 全面重构（v1.2.79）· 移动端 390 宽</title>
<desc id="desc">移动端单列布局：深色 hero、告警卡、项目状态卡与流程时间轴，主操作 44px。</desc>
${defs(theme)}
<style>text{font-family:'Noto Sans SC','Helvetica Neue',Arial,sans-serif;}</style>
${out.join('\n')}
</svg>`
}

const files = [
  ['workbench-v1279-overview-light-1440.svg', { themeName: 'light', H: 1024, full: false, variant: 'final' }],
  ['workbench-v1279-overview-dark-1440.svg', { themeName: 'dark', H: 1024, full: false, variant: 'final' }],
  ['workbench-v1279-full-light-1440.svg', { themeName: 'light', H: 1580, full: true, variant: 'final' }],
  ['workbench-v1279-overview-light-r1-1440.svg', { themeName: 'light', H: 1024, full: false, variant: 'r1' }],
  ['workbench-v1279-mobile-light-390.svg', { themeName: 'light', H: 844, full: false, variant: 'final', mobile: true }],
]

await mkdir(OUT, { recursive: true })
const texts = []
for (const [name, cfg] of files) {
  const content = svg(cfg)
  await writeFile(nodePath.join(OUT, name), content)
  texts.push(content)
  console.log('wrote', name)
}
// 字体子集字符：从所有 SVG 文本中提取
const chars = new Set()
for (const content of texts) {
  for (const match of content.matchAll(/<text[^>]*>([^<]*)<\/text>/g)) {
    for (const ch of match[1]) chars.add(ch)
  }
}
const list = [...chars].filter((ch) => ch.trim().length > 0).join('')
await writeFile('/tmp/wb-v1279-chars.txt', list)
console.log('unique chars', [...chars].length)
