// Acceptance panel collapse / disclosure mockup generator (v1.2.84, round 12)
// Pure string templates -> SVG. No external deps.
//
//   node gen-acceptance-collapse-mockups.mjs                 # final R2 set
//   R1=1 node gen-acceptance-collapse-mockups.mjs            # R1 (first draft) evidence only
//   OUT=/tmp/mock node gen-acceptance-collapse-mockups.mjs   # alternate output dir
//
// Render PNG (2x): FONTCONFIG_FILE=/tmp/fonts/fonts.conf \
//   NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules \
//   node -e "const s=require('sharp');s('x.svg',{density:144}).png().toFile('x.png').then(i=>console.log(i.width,i.height))"
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const OUT = process.env.OUT || fileURLToPath(new URL('.', import.meta.url))
const R1 = process.env.R1 === '1'
mkdirSync(OUT, { recursive: true })
const FAM = 'Noto Sans SC, PingFang SC, sans-serif'

/* ------------------------------------------------------------------ *
 * palette: real --dsw-alias-* token values (dsh-client-ui-theme)
 * light: body / dark: body[data-ds-dark-theme]
 * ------------------------------------------------------------------ */
const LIGHT = {
  name: 'light',
  canvas: '#F5F6F7', panel: '#FFFFFF', inset: '#FAFAFB', hover: '#F1F1F2', pressed: '#EAEAEC',
  line: '#EDEDEE', line2: '#E2E5E9', field: '#7F8287',
  ink: '#0F1115', ink2: '#61666B', ink3: '#81858C', ink4: '#ADB2B8',
  brand: '#0F1115', brandSoft: '#ECECEC', brandSoft2: '#E3E3E4',
  badgeBg: '#F1F1F1', badgeInk: '#61666B',
  okInk: '#19743D', okBg: '#E4F8EC', okDot: '#22C55E',
  errInk: '#891214', errBg: '#FDE3E3', errDot: '#EC1313',
  warnInk: '#8E5F10', warnBg: '#FEF3E2', warnDot: '#F59E0B',
  primaryFill: '#0F1115', primaryInk: '#FFFFFF',
  inputBg: '#F7F7F8', strip: '#F1F3F5', noteBg: '#FAFAFB', mono: '#61666B',
}
const DARK = {
  name: 'dark',
  canvas: '#151517', panel: '#272729', inset: '#232324', hover: '#343436', pressed: '#3A3A3C',
  line: '#3A3A3C', line2: '#46474A', field: '#8A8D92',
  ink: '#F9FAFB', ink2: '#CFD3D6', ink3: '#ADB2B8', ink4: '#81858C',
  brand: '#F9FAFB', brandSoft: '#38383A', brandSoft2: '#454548',
  badgeBg: '#343436', badgeInk: '#CFD3D6',
  okInk: '#4ED17E', okBg: '#233C2C', okDot: '#22C55E',
  errInk: '#F25A5A', errBg: '#3C1F1B', errDot: '#F25A5A',
  warnInk: '#F7AD31', warnBg: '#2A261D', warnDot: '#F59E0B',
  primaryFill: '#F9FAFB', primaryInk: '#0F1115',
  inputBg: '#232324', strip: '#1B1B1C', noteBg: '#1B1B1C', mono: '#ADB2B8',
}

/* ------------------------------------------------------------------ *
 * primitives
 * ------------------------------------------------------------------ */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// width estimate: CJK ≈ 1em, latin ≈ .55em (Noto Sans SC metrics)
function cw(ch, size) {
  const c = ch.codePointAt(0)
  if (c >= 0x2e80) return size
  if (ch === ' ') return size * 0.28
  if (ch === '·') return size * 0.4
  if (/[.,:;|'!]/.test(ch)) return size * 0.32
  if (/[A-Z]/.test(ch)) return size * 0.62
  if (/[0-9]/.test(ch)) return size * 0.56
  return size * 0.54
}
function tw(s, size, ls = 0) {
  let w = 0
  for (const ch of String(s)) w += cw(ch, size) + ls
  return w
}

function text(x, y, str, o = {}) {
  const { size = 11, weight = 400, fill = '#000', anchor = 'start', ls = 0, opacity = 1, family = FAM } = o
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${ls}"` : ''}${opacity !== 1 ? ` fill-opacity="${opacity}"` : ''}>${esc(str)}</text>`
}
function rect(x, y, w, h, o = {}) {
  const { rx = 0, fill = 'none', stroke = 'none', sw = 1, opacity = 1, dash } = o
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ''} fill="${fill}"${stroke !== 'none' ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}${dash ? ` stroke-dasharray="${dash}"` : ''}${opacity !== 1 ? ` fill-opacity="${opacity}"` : ''}/>`
}
function circle(cx, cy, r, o = {}) {
  const { fill = 'none', stroke = 'none', sw = 1, opacity = 1 } = o
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${stroke !== 'none' ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}${opacity !== 1 ? ` fill-opacity="${opacity}"` : ''}/>`
}
function path(d, o = {}) {
  const { fill = 'none', stroke = '#000', sw = 1.5, cap = 'round', join = 'round', opacity = 1 } = o
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="${cap}" stroke-linejoin="${join}"${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`
}
const hline = (x, y, w, fill, th = 1) => rect(x, y, w, th, { fill })
const vline = (x, y, h, fill, tw_ = 1) => rect(x, y, tw_, h, { fill })

/* truncate to width, with ellipsis (models CSS text-overflow: ellipsis) */
function ellipsize(str, size, maxW) {
  const s = String(str)
  if (tw(s, size) <= maxW) return s
  const dots = '…'
  let out = ''
  let w = 0
  for (const ch of s) {
    const c = cw(ch, size)
    if (w + c + tw(dots, size) > maxW) break
    out += ch
    w += c
  }
  return out + dots
}
/* wrap like CSS: break at spaces / CJK boundaries first, hard-break as fallback */
function wrapLines(str, size, maxW, maxLines = 99) {
  const s = String(str)
  const lines = []
  let cur = ''
  let lastBreak = -1 // index in cur right after a break opportunity
  const isCjk = (ch) => ch.codePointAt(0) >= 0x2e80
  for (const ch of s) {
    if (ch === '\n') { lines.push(cur); cur = ''; lastBreak = -1; if (lines.length >= maxLines) break; continue }
    if (tw(cur + ch, size) > maxW && cur.length > 0) {
      if ('，。、；：！？）」』】…·%'.includes(ch) && cur.length > 0) {
        // CJK line-break rule: no line may start with closing punctuation
        lines.push(cur + ch)
        cur = ''
        lastBreak = -1
        if (lines.length >= maxLines) break
        continue
      } else if (lastBreak > 0 && lastBreak < cur.length) {
        lines.push(cur.slice(0, lastBreak).replace(/\s+$/, ''))
        cur = cur.slice(lastBreak).replace(/^\s+/, '')
      } else {
        lines.push(cur)
        cur = ''
      }
      lastBreak = -1
      if (lines.length >= maxLines) break
    }
    cur += ch
    if (ch === ' ' || isCjk(ch)) lastBreak = cur.length
  }
  if (lines.length < maxLines && cur.length > 0) lines.push(cur)
  if (lines.length >= maxLines) lines[maxLines - 1] = ellipsize(lines[maxLines - 1], size, maxW)
  return lines
}

/* icons (16x16 box, stroke based) */
const ICON = {
  down: (c) => path('M4 6.5 8 10.5 12 6.5', { stroke: c, sw: 1.7 }),
  up: (c) => path('M4 9.5 8 5.5 12 9.5', { stroke: c, sw: 1.7 }),
  downDouble: (c) => path('M4 5.5 8 9.5 12 5.5', { stroke: c, sw: 1.6 }) + path('M4 9.5 8 13.5 12 9.5', { stroke: c, sw: 1.6 }),
  upDouble: (c) => path('M4 10.5 8 6.5 12 10.5', { stroke: c, sw: 1.6 }) + path('M4 6.5 8 2.5 12 6.5', { stroke: c, sw: 1.6 }),
  refresh: (c) => path('M13 5.2A5.5 5.5 0 1 0 13.5 9.6M13.2 3v2.6h-2.6', { stroke: c, sw: 1.6 }),
  plus: (c) => path('M8 3.4v9.2M3.4 8h9.2', { stroke: c, sw: 1.6 }),
  download: (c) => path('M8 3v7M5 7l3 3 3-3M3.4 13h9.2', { stroke: c, sw: 1.5 }),
  external: (c) => path('M7 3.4h5.6V9M12.4 3.6 6.6 9.4M10.6 12.6H3.4V5.4', { stroke: c, sw: 1.5 }),
  copy: (c) => rect(5.6, 5.6, 7, 7, { rx: 1.4, stroke: c, sw: 1.4 }) + path('M10.4 5.4V3.9c0-.8-.6-1.4-1.4-1.4H3.9c-.8 0-1.4.6-1.4 1.4v5.1c0 .8.6 1.4 1.4 1.4h1.5', { stroke: c, sw: 1.4 }),
  x: (c) => path('M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8', { stroke: c, sw: 1.6 }),
  check: (c) => path('M3.4 8.4 6.4 11.4 12.6 4.8', { stroke: c, sw: 1.7 }),
  alert: (c) => path('M8 2.6 14.2 13.4H1.8L8 2.6Z', { stroke: c, sw: 1.4 }) + path('M8 6.4v3.2M8 11.4v.2', { stroke: c, sw: 1.5 }),
  time: (c) => circle(8, 8, 5.4, { stroke: c, sw: 1.4 }) + path('M8 5v3.2l2.2 1.4', { stroke: c, sw: 1.4 }),
  image: (c) => rect(2.4, 3.2, 11.2, 9.6, { rx: 1.4, stroke: c, sw: 1.3 }) + path('M2.8 10.6 6 7.6l2.4 2.2 2-1.8 3 2.8', { stroke: c, sw: 1.3 }) + circle(5.6, 6, 1, { fill: c }),
  file: (c) => path('M4.4 2.6h4.8L12.6 6v7.4H4.4V2.6Z', { stroke: c, sw: 1.3 }) + path('M9 2.7V6h3.4', { stroke: c, sw: 1.3 }),
  play: (c) => path('M6 3.6 12 8l-6 4.4V3.6Z', { fill: c, stroke: 'none' }),
  group: (c) => path('M2.6 4.6h4.2l1.2 1.6h5.4v6H2.6z', { stroke: c, sw: 1.3 }),
}
function icon(name, x, y, size, color) {
  return `<g transform="translate(${x} ${y}) scale(${size / 16})">${(ICON[name] || ICON.down)(color)}</g>`
}

/* badge: 16 high, rx 8, text 9.5/600 */
const badgeW = (label, size = 9.5) => tw(label, size) + 10
function badge(x, y, label, th, kind = 'neutral', o = {}) {
  const size = o.size || 9.5
  const w = o.w || badgeW(label, size)
  const map = {
    neutral: { bg: th.badgeBg, fg: th.badgeInk },
    ok: { bg: th.okBg, fg: th.okInk },
    err: { bg: th.errBg, fg: th.errInk },
    warn: { bg: th.warnBg, fg: th.warnInk },
    brand: { bg: th.brandSoft, fg: th.ink },
    more: { bg: th.badgeBg, fg: th.ink2 },
  }
  const k = map[kind] || map.neutral
  return { svg: rect(x, y, w, 16, { rx: 8, fill: k.bg }) + text(x + w / 2, y + 11.5, label, { size, weight: 600, fill: k.fg, anchor: 'middle' }), w }
}

/* stack parts vertically, each part {svg,h}; returns svg + end y */
function stack(parts, startY) {
  let svg = ''
  let y = startY
  for (const part of parts) {
    svg += `<g transform="translate(0 ${y})">${part.svg}</g>`
    y += part.h
  }
  return { svg, y }
}

/* small button */
function button(x, y, w, h, label, th, o = {}) {
  const { kind = 'secondary', size = 10.5, iconName, iconOnly = false } = o
  const styles = {
    secondary: { fill: th.panel, stroke: th.line2, fg: th.ink2 },
    primary: { fill: th.primaryFill, stroke: 'none', fg: th.primaryInk },
    danger: { fill: th.panel, stroke: th.line2, fg: th.errInk },
    ghost: { fill: 'none', stroke: 'none', fg: th.ink2 },
  }
  const s = styles[kind] || styles.secondary
  let out = rect(x, y, w, h, { rx: 6, fill: s.fill, stroke: s.stroke, sw: 1 })
  if (iconOnly && iconName) {
    out += icon(iconName, x + w / 2 - 7, y + h / 2 - 7, 14, s.fg)
    return { svg: out, w }
  }
  const iw = iconName ? 14 : 0
  const total = iw + (iconName ? 4 : 0) + tw(label, size)
  let tx = x + (w - total) / 2
  if (iconName) { out += icon(iconName, tx, y + h / 2 - 7, 12, s.fg); tx += iw + 4 }
  out += text(tx, y + h / 2 + size * 0.35, label, { size, weight: 600, fill: s.fg })
  return { svg: out, w }
}
const btnW = (label, size = 10.5, iconName) => tw(label, size) + (iconName ? 18 : 0) + 16

/* ------------------------------------------------------------------ *
 * panel chrome
 * ------------------------------------------------------------------ */
function doc(w, h, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
${body}
</svg>
`
}
function labelStrip(w, th, left, right) {
  return rect(0, 0, w, 26, { fill: th.strip }) +
    hline(0, 26, w, th.line) +
    text(10, 17, left, { size: 9.5, weight: 600, fill: th.ink2 }) +
    text(w - 10, 17, right, { size: 9, fill: th.ink3, anchor: 'end' })
}
function noteStrip(w, th, lines) {
  const h = 8 + lines.length * 13 + 6
  return { h, svg: rect(0, 0, w, h, { fill: th.noteBg }) + hline(0, 0, w, th.line) + lines.map((l, i) => text(10, 18 + i * 13, l, { size: 9, fill: th.ink2 })).join('') }
}

/* acceptance toolbar: [刷新] [全部收起/全部展开] ......... */
function accToolbar(w, th, o = {}) {
  const h = 36
  let out = rect(0, 0, w, h, { fill: th.panel })
  out += hline(0, h - 1, w, th.line)
  const r = button(8, 5, 44, 26, T.refresh, th)
  out += r.svg
  if (o.twoButtons) {
    // R1 first draft: two buttons side by side
    const b1 = button(56, 5, btnW(T.collapseAll), 26, T.collapseAll, th)
    const b2 = button(56 + b1.w + 6, 5, btnW(T.expandAll), 26, T.expandAll, th)
    out += b1.svg + b2.svg
    void b2
  } else {
    // R2: one dynamic label button (link style, right of refresh)
    const label = o.toggleLabel
    const labelW = tw(label, 10.5) + 18
    out += rect(54, 5, labelW, 26, { rx: 6, fill: 'none' })
    out += icon(o.toggleOpen ? 'upDouble' : 'downDouble', 58, 11, 13, th.ink2)
    out += text(74, 22, label, { size: 10.5, weight: 600, fill: th.ink2 })
    if (o.toggleFocus) out += rect(52, 3, labelW + 4, 30, { rx: 6, stroke: th.brand, sw: 2 })
  }
  if (o.saving) out += text(w - 10, 22, T.saving, { size: 9.5, fill: th.ink3, anchor: 'end' })
  return { h, svg: out }
}

function accHint(w, th, textStr) {
  const lines = wrapLines(textStr, 10, w - 20)
  const h = 8 + lines.length * 14 + 2
  let out = rect(0, 0, w, h, { fill: th.panel })
  lines.forEach((l, i) => { out += text(10, 14 + i * 14, l, { size: 10, fill: th.ink2 }) })
  return { h, svg: out }
}

function accCounts(w, th, counts, h = 28) {
  let out = rect(0, 0, w, h, { fill: th.panel })
  let x = 8
  for (const c of counts) {
    const label = c.label
    const bw = tw(label, 9.5) + 12
    out += rect(x, 6, bw, 16, { rx: 8, fill: c.kind === 'neutral' ? th.badgeBg : c.kind === 'pass' ? th.okBg : c.kind === 'fail' ? th.errBg : th.warnBg })
    const fg = c.kind === 'neutral' ? th.ink2 : c.kind === 'pass' ? th.okInk : c.kind === 'fail' ? th.errInk : th.warnInk
    out += text(x + bw / 2, 17.5, label, { size: 9.5, weight: 600, fill: fg, anchor: 'middle' })
    x += bw + 5
  }
  return { h, svg: out }
}

function accAdd(w, th, h = 36) {
  let out = rect(0, 0, w, h, { fill: th.panel })
  const bw = btnW('添加', 10.5)
  out += rect(8, 5, w - 16 - bw - 6, 26, { rx: 6, fill: th.inputBg, stroke: th.line2, sw: 1 })
  out += text(16, 22, '添加一条验收项，按回车创建…', { size: 10, fill: th.ink2 })
  out += button(8 + w - 16 - bw, 5, bw, 26, '添加', th).svg
  return { h, svg: out }
}

function accFilters(w, th, h = 30) {
  let out = rect(0, 0, w, h, { fill: th.panel })
  let x = 8
  out += rect(x, 10, 12, 12, { rx: 3, fill: th.panel, stroke: th.field, sw: 1.2 })
  out += text(x + 17, 20, '全选', { size: 9.5, fill: th.ink2 })
  x += 17 + tw('全选', 9.5) + 8
  const chips = [['全部', true], ['未完成', false], ['不通过', false], ['缺证据', false]]
  for (const [label, on] of chips) {
    const cw_ = tw(label, 9.5) + 14
    out += rect(x, 7, cw_, 18, { rx: 9, fill: on ? th.brandSoft : 'none', stroke: on ? th.brand : th.line2, sw: 1 })
    out += text(x + cw_ / 2, 19.5, label, { size: 9.5, weight: on ? 600 : 400, fill: on ? th.ink : th.ink2, anchor: 'middle' })
    x += cw_ + 4
  }
  return { h, svg: out }
}

function accTemplateToggle(w, th, h = 24) {
  let out = rect(0, 0, w, h, { fill: th.panel })
  out += text(8, 16, '验收模板', { size: 9.5, weight: 600, fill: th.ink2 })
  out += icon('down', 8 + tw('验收模板', 9.5) + 4, 6, 12, th.ink2)
  return { h, svg: out }
}

/* group header: button, category + count badge + chevron */
function groupHead(w, th, o) {
  const h = 28
  let out = rect(0, 0, w, h, { fill: o.hover ? th.hover : th.panel })
  const chevX = w - 8 - 12
  const label = o.label
  const labelW = tw(label, 9.5) + 2
  out += text(8, 18, label, { size: 9.5, weight: 600, fill: th.ink2 })
  const cw_ = tw(String(o.count), 9) + 10
  out += rect(8 + labelW + 5, 8, cw_, 14, { rx: 7, fill: th.badgeBg })
  out += text(8 + labelW + 5 + cw_ / 2, 18, String(o.count), { size: 9, weight: 600, fill: th.ink2, anchor: 'middle' })
  if (o.interactive !== false) out += icon(o.open ? 'up' : 'down', chevX, 8, 12, th.ink2)
  if (o.focus) out += rect(1, 1, w - 2, h - 2, { rx: 5, stroke: th.brand, sw: 2 })
  return { h, svg: out }
}

/* one acceptance row */
const ROW_STATUS = [['pending', '待验收'], ['pass', '通过'], ['fail', '不通过'], ['blocked', '阻塞']]
function itemRow(w, th, o) {
  const padX = 8
  const checkW = 13
  const statusW = ROW_STATUS.reduce((a, [k]) => a + tw(k === 'pending' ? '待验收' : k === 'pass' ? '通过' : k === 'fail' ? '不通过' : '阻塞', 9) + 10 + 2, 0)
  const delW = 20
  const sx0 = w - padX - delW - 4 - statusW
  const tx = padX + checkW + 5
  const mainW = Math.max(60, sx0 - tx - 6)
  const titleLines = wrapLines(o.title, 11, mainW, 3)
  const h = Math.max(30, 8 + titleLines.length * 14.5 + (o.note ? 11 : 0) + 6)
  let out = rect(0, 0, w, h, { fill: o.selected ? th.brandSoft : th.panel })
  if (o.selected) out += vline(0, 0, h, th.brand, 2)
  // checkbox
  out += rect(padX, 10, checkW, checkW, { rx: 3, fill: o.checked ? th.brand : th.panel, stroke: o.checked ? 'none' : th.field, sw: 1.2 })
  if (o.checked) out += icon('check', padX + 1, 10, 11, th.panel)
  // status buttons
  let sx = w - padX - delW - 4 - statusW
  const sX0 = sx
  for (const [st, lab] of ROW_STATUS) {
    const bw = tw(lab, 9) + 10
    const on = o.status === st
    const fg = on ? (st === 'pass' ? th.okInk : st === 'fail' ? th.errInk : st === 'blocked' ? th.warnInk : th.brand) : th.ink2
    out += rect(sx, 11, bw, 18, { rx: 4, fill: 'none', stroke: on ? fg : th.line2, sw: 1 })
    out += text(sx + bw / 2, 23, lab, { size: 9, weight: on ? 600 : 400, fill: fg, anchor: 'middle' })
    sx += bw + 2
  }
  void sX0
  // title
  const titleFill = o.status === 'pass' ? th.okInk : o.status === 'fail' ? th.errInk : th.ink
  titleLines.forEach((l, i) => { out += text(tx, 21 + i * 14.5, l, { size: 11, weight: 400, fill: titleFill }) })
  if (o.note) out += text(tx, 21 + titleLines.length * 14.5, o.note, { size: 9.5, fill: th.ink2 })
  // delete
  out += icon('x', w - padX - 14, 13, 12, th.ink3)
  return { h, svg: out }
}

/* fill a list viewport: groups (label, items) until the bottom, then a cut hint */
let clipSeq = 0
function renderList(W, th, o) {
  const listH = o.listH
  const top = o.y
  const bottom = top + listH
  const clipH = listH - 26
  const clipId = 'acclip' + (++clipSeq)
  let y = top
  let out = rect(0, top, W, listH, { fill: th.panel })
  let shown = 0
  const total = o.groups.reduce((a, g) => a + (g.count ?? g.items.length), 0)
  const draw = (part, h) => {
    if (y + h <= top + clipH) {
      out += `<g transform="translate(0 ${y})">${part}</g>`
      y += h
      return true
    }
    // partial row at the scroll edge -> clipped like a real scroll container
    out += `<g clip-path="url(#${clipId})"><g transform="translate(0 ${y})">${part}</g></g>`
    y += h
    return false
  }
  outer:
  for (const g of o.groups) {
    if (y >= top + clipH) break
    const gh = groupHead(W, th, { label: g.label, count: g.count ?? g.items.length, open: g.open })
    if (!draw(gh.svg, gh.h)) break
    if (g.open) {
      for (const item of g.items) {
        if (y >= top + clipH) break outer
        const r = itemRow(W, th, item)
        const full = draw(r.svg, r.h)
        shown += 1
        if (!full) break outer
      }
    }
  }
  const rest = total - shown
  out += hline(0, bottom - 26, W, th.line)
  out += text(W / 2, bottom - 9, o.hint || (rest > 0 ? '↓ 清单独立滚动 · 其余 ' + rest + ' 项' : '已到清单末尾'), { size: 9, fill: th.ink2, anchor: 'middle' })
  return {
    h: listH,
    svg: `<defs><clipPath id="${clipId}"><rect x="0" y="${top}" width="${W}" height="${clipH}"/></clipPath></defs>` + out,
  }
}

/* detail block */
function detailHead(w, th, o) {
  const padX = 8
  const pillW = tw(o.statusLabel, 9) + 12
  const chevX = w - padX - 12
  const titleX = padX + pillW + 6
  const titleMax = chevX - 6 - titleX
  const lines = wrapLines(o.title, 12, titleMax, o.open ? 2 : 1)
  const h = 48
  let out = rect(0, 0, w, h, { fill: th.inset })
  out += hline(0, 0, w, th.line)
  const kind = o.status === 'pass' ? 'ok' : o.status === 'fail' ? 'err' : o.status === 'blocked' ? 'warn' : 'neutral'
  const pillY = o.open ? 9 : 12
  out += rect(padX, pillY, pillW, 16, { rx: 8, fill: kind === 'ok' ? th.okBg : kind === 'err' ? th.errBg : kind === 'warn' ? th.warnBg : th.badgeBg })
  out += text(padX + pillW / 2, pillY + 11.5, o.statusLabel, { size: 9, weight: 600, fill: kind === 'ok' ? th.okInk : kind === 'err' ? th.errInk : kind === 'warn' ? th.warnInk : th.ink2, anchor: 'middle' })
  const firstBase = o.open ? 22 : 23
  lines.forEach((l, i) => { out += text(titleX, firstBase + i * 15, l, { size: 12, weight: 600, fill: th.ink }) })
  if (!o.open) out += text(titleX, 39, '详情已收起 · 选中保留，点此展开', { size: 9, fill: th.ink2 })
  out += icon(o.open ? 'up' : 'down', chevX, h / 2 - 6, 13, th.ink2)
  if (o.focus) out += rect(1, 1, w - 2, h - 2, { rx: 5, stroke: th.brand, sw: 2 })
  return { h, svg: out }
}

function detailBody(w, th, o) {
  let y = 0
  let out = ''
  const padX = 8
  const inner = w - padX * 2
  out += rect(0, 0, w, 1, { fill: th.line })
  y = 8
  // meta
  out += text(padX, y + 10, '分类', { size: 9.5, fill: th.ink3 })
  out += text(padX + tw('分类', 9.5) + 4, y + 10, o.category, { size: 9.5, fill: th.ink })
  let mx = padX + tw('分类', 9.5) + 4 + tw(o.category, 9.5) + 10
  out += text(mx, y + 10, o.retest, { size: 9.5, fill: th.ink2 })
  y += 18
  // requirement
  out += text(padX, y + 9, '验收条件', { size: 9.5, fill: th.ink3 })
  y += 14
  const reqLines = wrapLines(o.requirement, 10, inner, 3)
  reqLines.forEach((l, i) => { out += text(padX, y + 9 + i * 15, l, { size: 10, fill: th.ink2 }) })
  y += reqLines.length * 15 + 8
  // note
  out += text(padX, y + 9, '备注', { size: 9.5, fill: th.ink3 })
  y += 14
  out += rect(padX, y, inner, 56, { rx: 6, fill: th.inputBg, stroke: th.line2, sw: 1 })
  wrapLines(o.note, 10, inner - 14, 3).forEach((l, i) => { out += text(padX + 7, y + 16 + i * 14, l, { size: 10, fill: th.ink }) })
  y += 62
  // actions
  out += button(padX, y, btnW('保存备注', 10), 26, '保存备注', th).svg
  out += text(w - padX - tw('取消', 10), y + 17, '取消', { size: 10, weight: 600, fill: th.ink2, anchor: 'end' })
  y += 34
  // evidence
  out += text(padX, y + 9, '证据', { size: 9.5, fill: th.ink3 })
  const addLabel = '添加截图 / 证据'
  out += text(w - padX, y + 9, addLabel, { size: 9.5, weight: 600, fill: th.ink2, anchor: 'end' })
  y += 14
  const n = o.evidence || 3
  for (let i = 0; i < n; i++) {
    const ex = padX + i * 74
    out += rect(ex, y, 68, 58, { rx: 6, fill: th.panel, stroke: th.line2, sw: 1 })
    out += rect(ex + 4, y + 4, 60, 42, { rx: 4, fill: th.badgeBg })
    if (i === 0) {
      // fake screenshot thumb
      out += rect(ex + 7, y + 7, 54, 8, { rx: 2, fill: th.ink, opacity: 0.75 })
      out += rect(ex + 7, y + 18, 38, 3, { rx: 1.5, fill: th.ink2, opacity: 0.55 })
      out += rect(ex + 7, y + 24, 46, 3, { rx: 1.5, fill: th.ink2, opacity: 0.4 })
      out += rect(ex + 7, y + 30, 30, 12, { rx: 2, fill: th.brand, opacity: 0.8 })
    } else {
      out += icon(i === 1 ? 'file' : 'image', ex + 24, y + 15, 18, th.ink3)
    }
    out += text(ex + 34, y + 53, i === 0 ? '360.png' : i === 1 ? 'a11y.log' : '691.png', { size: 8.5, fill: th.ink2, anchor: 'middle' })
    out += text(ex + 62, y + 8, '×', { size: 10, fill: th.ink3, anchor: 'end' })
  }
  y += 64
  // history
  out += text(padX, y + 9, '状态历史', { size: 9.5, fill: th.ink3 })
  y += 14
  const hist = [
    ['pass', '通过', '折叠区块默认收起与合计徽标已复测', '10-27 12:41'],
    ['pending', '待验收', '初版：清单仍被三块挤压', '10-27 10:12'],
    ['blocked', '阻塞', '等待 Host 重启后复测 aria-expanded', '10-26 18:03'],
  ]
  for (const [st, lab, note, at] of hist) {
    const kind2 = st === 'pass' ? 'ok' : st === 'fail' ? 'err' : st === 'blocked' ? 'warn' : 'neutral'
    out += rect(padX, y + 1, tw(lab, 8.5) + 10, 14, { rx: 7, fill: kind2 === 'ok' ? th.okBg : kind2 === 'warn' ? th.warnBg : kind2 === 'err' ? th.errBg : th.badgeBg })
    out += text(padX + (tw(lab, 8.5) + 10) / 2, y + 11, lab, { size: 8.5, weight: 600, fill: kind2 === 'ok' ? th.okInk : kind2 === 'warn' ? th.warnInk : kind2 === 'err' ? th.errInk : th.ink2, anchor: 'middle' })
    const noteX = padX + tw(lab, 8.5) + 10 + 6
    out += text(noteX, y + 11, ellipsize(note, 9, inner - (noteX - padX) - 62), { size: 9, fill: th.ink2 })
    out += text(w - padX, y + 11, at, { size: 9, fill: th.ink3, anchor: 'end' })
    y += 20
  }
  y += 8
  return { h: y, svg: rect(0, 0, w, y, { fill: th.inset }) + out }
}

/* block header (disclosure) */
function blockHead(w, th, o) {
  const h = R1 ? 32 : 44
  let out = rect(0, 0, w, h, { fill: o.hover ? th.hover : th.panel })
  out += hline(0, 0, w, th.line)
  const padX = 8
  const chevX = w - padX - 12
  const titleSize = R1 ? 11 : 12
  let right = chevX - 6
  let badgesSvg = ''
  let x = right
  const badges = o.badges || []
  let dropped = 0
  for (let i = badges.length - 1; i >= 0; i--) {
    const b = badges[i]
    const maxW = R1 ? 999 : 96
    const label = R1 ? b.label : ellipsize(b.label, 9.5, maxW - 10)
    const bw = badgeW(label)
    if (!R1 && x - bw < padX + 64 + 8) { dropped = i + 1; break }
    out += badge(x - bw, (h - 16) / 2, label, th, b.kind).svg
    x -= bw + 5
  }
  if (dropped > 0) {
    const bw = badgeW('+' + String(dropped))
    if (x - bw >= padX + 64 + 8) { out += badge(x - bw, (h - 16) / 2, '+' + String(dropped), th, 'more').svg; x -= bw + 5 }
  }
  // R1 first draft: action buttons live inside the header (nested buttons)
  if (R1 && o.actions) {
    let ax = padX
    for (const a of o.actions) {
      const bw = btnW(a, 9.5)
      out += rect(ax, (h - 20) / 2, bw, 20, { rx: 5, fill: 'none', stroke: th.line2, sw: 1 })
      out += text(ax + bw / 2, (h - 20) / 2 + 13.5, a, { size: 9.5, weight: 600, fill: th.ink2, anchor: 'middle' })
      ax += bw + 4
    }
    x = Math.min(x, ax)
  }
  const titleMax = Math.max(40, x - padX - 8)
  out += text(padX, h / 2 + titleSize * 0.36, ellipsize(o.title, titleSize, titleMax), { size: titleSize, weight: 600, fill: th.ink })
  out += icon(o.open ? 'up' : 'down', chevX, h / 2 - 6, 12, th.ink2)
  if (o.focus) out += rect(1, 1, w - 2, h - 2, { rx: 6, stroke: th.brand, sw: 2 })
  return { h, svg: out }
}

/* expanded block bodies */
function evidenceBody(w, th, o = {}) {
  const padX = 8
  const inner = w - padX * 2
  let y = 8
  let out = ''
  out += text(padX, y + 9, '上传后会绑定到当前选中的验收项，并进入报告与交付包。', { size: 9.5, fill: th.ink2 })
  const addLabel = '添加截图 / 证据'
  out += text(w - padX, y + 9, addLabel, { size: 9.5, weight: 600, fill: th.ink2, anchor: 'end' })
  y += 16
  // grid of 20 evidence chips: 4 cols at 360, 5 cols at 691
  const cols = o.cols || 4
  const cellW = o.cellW || 68
  const gap = 5
  const names = o.names || []
  const rows = Math.ceil((o.count || 20) / cols)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      if (i >= (o.count || 20)) break
      const ex = padX + c * (cellW + gap)
      out += rect(ex, y, cellW, 60, { rx: 6, fill: th.panel, stroke: th.line2, sw: 1 })
      out += rect(ex + 4, y + 4, cellW - 8, 42, { rx: 4, fill: th.badgeBg })
      if (i % 3 === 0) {
        out += rect(ex + 8, y + 8, cellW - 16, 8, { rx: 2, fill: th.ink, opacity: 0.7 })
        out += rect(ex + 8, y + 19, cellW - 24, 3, { rx: 1.5, fill: th.ink2, opacity: 0.5 })
        out += rect(ex + 8, y + 25, cellW - 14, 3, { rx: 1.5, fill: th.ink2, opacity: 0.4 })
        out += rect(ex + 8, y + 31, cellW - 30, 11, { rx: 2, fill: th.brand, opacity: 0.75 })
      } else if (i % 3 === 1) {
        out += icon('file', ex + cellW / 2 - 8, y + 15, 16, th.ink3)
        out += rect(ex + 10, y + 34, cellW - 20, 2.5, { rx: 1.2, fill: th.ink3, opacity: 0.5 })
        out += rect(ex + 14, y + 38, cellW - 28, 2, { rx: 1, fill: th.ink3, opacity: 0.35 })
      } else {
        out += icon('image', ex + cellW / 2 - 8, y + 15, 16, th.ink3)
        out += rect(ex + 10, y + 34, cellW - 20, 2.5, { rx: 1.2, fill: th.ink3, opacity: 0.5 })
      }
      out += text(ex + cellW / 2, y + 54, ellipsize(names[i] || `ev-${String(i + 1).padStart(2, '0')}.png`, 8.5, cellW - 10), { size: 8.5, fill: th.ink2, anchor: 'middle' })
    }
    y += 60 + gap
  }
  y += 2
  return { h: y, svg: rect(0, 0, w, y, { fill: th.inset }) + out + scrollHint(w, y), }
}

function scrollHint(w, h) {
  if (h < 80) return ''
  const bh = Math.max(28, Math.round(h * 0.34))
  return rect(w - 4, 8, 2, bh, { rx: 1, fill: '#8A8D92', opacity: 0.5 })
}
function verifyBody(w, th, o = {}) {
  const padX = 8
  const inner = w - padX * 2
  let y = 8
  let out = ''
  // latest verification
  out += icon('time', padX, y, 12, th.ink3)
  out += text(padX + 16, y + 10, '最近复测 · 2026-10-27 12:40', { size: 9.5, fill: th.ink3 })
  const latest = '2 通过 / 0 失败'
  const lw = badgeW(latest)
  out += badge(w - padX - lw, y + 1, latest, th, 'ok', { w: lw }).svg
  y += 20
  // command list (flattened: no inner toggle in R2; R1 keeps inner toggle)
  const cmds = o.commands || []
  if (R1) {
    // R1: inner disclosure toggle showing only the toggle row, body hidden
    const lw2 = btnW('复测', 9.5)
    out += rect(w - padX - lw2, y, lw2, 20, { rx: 5, fill: 'none', stroke: th.line2, sw: 1 })
    out += text(w - padX - lw2 / 2, y + 13.5, '复测', { size: 9.5, weight: 600, fill: th.ink2, anchor: 'middle' })
    out += text(padX, y + 13, '命令选择区默认收起（内层开关）', { size: 9.5, fill: th.ink2 })
    y += 26
  } else {
    for (let i = 0; i < cmds.length; i++) {
      const on = i < 2
      out += rect(padX, y + 1, 12, 12, { rx: 3, fill: on ? th.brand : th.panel, stroke: on ? 'none' : th.field, sw: 1.1 })
      if (on) out += icon('check', padX + 1, y + 1, 10, th.panel)
      const label = cmds[i]
      out += text(padX + 18, y + 11, ellipsize(label, 9.5, inner - 24), { size: 9.5, fill: th.ink2 })
      y += 19
    }
    y += 4
    const runLabel = '运行复测'
    const runW = btnW(runLabel, 10)
    out += button(padX, y, runW, 26, runLabel, th, { kind: 'primary', size: 10 }).svg
    out += text(padX + runW + 8, y + 17, '重新检测命令', { size: 9.5, weight: 600, fill: th.ink2 })
    y += 32
  }
  y += 2
  return { h: y, svg: rect(0, 0, w, y, { fill: th.inset }) + out }
}

function deliveryBody(w, th, o = {}) {
  const padX = 8
  const inner = w - padX * 2
  let y = 8
  let out = ''
  // action buttons (wrap)
  const actions = ['把未通过项发给 agent', '导出验收报告', '打包交付（zip）', '下载构建产物']
  let x = padX
  let rowH = 0
  for (const a of actions) {
    const bw = btnW(a, 9.5)
    if (x + bw > w - padX) { x = padX; y += 30 }
    out += button(x, y, bw, 24, a, th, { size: 9.5 }).svg
    x += bw + 5
    rowH = 24
  }
  y += rowH + 10
  // preview sharing
  out += text(padX, y + 9, '预览分享', { size: 9.5, weight: 600, fill: th.ink3 })
  y += 14
  out += text(padX, y + 10, '端口', { size: 9.5, fill: th.ink3 })
  out += rect(padX + tw('端口', 9.5) + 5, y, 56, 24, { rx: 5, fill: th.inputBg, stroke: th.line2, sw: 1 })
  out += text(padX + tw('端口', 9.5) + 12, y + 16, '5173', { size: 10, fill: th.ink })
  const createW = btnW('创建分享链接', 9.5)
  out += button(w - padX - createW, y, createW, 24, '创建分享链接', th, { size: 9.5 }).svg
  y += 30
  const shares = o.shares || []
  for (const s of shares) {
    out += rect(padX, y, inner, 22, { rx: 4, fill: 'none' })
    out += text(padX, y + 14, ellipsize(s.left, 9, inner - 128), { size: 9, fill: th.ink2 })
    out += text(w - padX, y + 14, '复制链接 · 打开 · 关闭', { size: 9, fill: th.ink2, anchor: 'end' })
    y += 22
  }
  out += text(padX, y + 9, '链接指向当前 Harness 主机的预览端口，局域网/手机可直接打开。', { size: 9, fill: th.ink3 })
  y += 18
  // delivery history
  out += text(padX, y + 9, '交付记录', { size: 9.5, weight: 600, fill: th.ink3 })
  y += 15
  const hist = o.deliveries || []
  for (const d of hist) {
    out += text(padX, y + 11, ellipsize(d.name, 9, inner - 120), { size: 9, fill: th.ink2 })
    out += text(w - padX, y + 11, '下载', { size: 9, weight: 600, fill: th.ink2, anchor: 'end' })
    out += text(w - padX - tw('下载', 9) - 10, y + 11, d.meta, { size: 9, fill: th.ink3, anchor: 'end' })
    y += 20
  }
  y += 2
  // bundle
  out += rect(padX, y, inner, 26, { rx: 5, fill: 'none' })
  out += text(padX, y + 16, '交付包已生成：deliveries/delivery-1.2.84.zip', { size: 9, fill: th.ink2 })
  out += text(w - padX, y + 16, '下载', { size: 9, weight: 600, fill: th.ink2, anchor: 'end' })
  y += 30
  return { h: y, svg: rect(0, 0, w, y, { fill: th.inset }) + out }
}

/* ------------------------------------------------------------------ *
 * data
 * ------------------------------------------------------------------ */
const T = {
  refresh: '刷新', saving: '保存中…', collapseAll: '全部收起', expandAll: '全部展开',
}
const HINT = 'agent 作为产品经理写验收项；你在这里勾选通过 / 不通过，驳回时可把未通过项发回对话。'
const COUNT_ROWS = [
  { kind: 'neutral', label: '待验收 9' },
  { kind: 'pass', label: '通过 7' },
  { kind: 'fail', label: '未通过 2' },
  { kind: 'warn', label: '阻塞 1' },
]
const ITEMS_A = [
  { title: '证据库、复测中心、交付与预览分享默认收起，点区块头展开', status: 'pass', selected: false, checked: true },
  { title: '折叠状态写入 localStorage，刷新与重开面板后保持', status: 'pass', selected: false, checked: true },
  { title: '「全部收起 / 全部展开」作用于三区块、全部分组与详情', status: 'pending', selected: false, checked: false },
  { title: '清单默认展开并占满剩余高度，可独立滚动', status: 'pending', selected: false, checked: false },
  { title: '选中详情随选中展开、可手动收起，取消选中即消失', status: 'pending', selected: false, checked: false },
  { title: '分类分组头可折叠、带数量徽标，折叠状态持久化', status: 'pending', selected: false, checked: false },
  { title: '折叠不影响勾选、批量、状态修改、删除与筛选', status: 'pending', selected: false, checked: false },
]
const ITEMS_B = [
  { title: '折叠头为 button，aria-expanded / aria-controls 同步', status: 'pending', selected: false, checked: false },
  { title: 'Enter / Space 可切换，焦点可见，收起内容不进 Tab', status: 'pending', selected: false, checked: false },
  { title: '360 / 691 无横向溢出，浅深主题正文对比度 ≥ 4.5:1', status: 'fail', selected: false, checked: false },
  { title: '中英文折叠文案齐全，无硬编码中文，缺失回退不崩溃', status: 'pending', selected: false, checked: false },
  { title: '证据库徽标 = 证据数，复测徽标 = 最近 pass / fail', status: 'pass', selected: false, checked: true },
  { title: '交付徽标 = 分享数 · 交付记录数，为 0 时只显示一项', status: 'pass', selected: false, checked: true },
  { title: '验收台既有操作与全局功能无回归，质量门全绿', status: 'fail', selected: false, checked: false },
]
const ITEMS_C = [
  { title: '版本与文档同步到 1.2.84，交付后根版本 1.2.86', status: 'pending', selected: false },
  { title: '只改 client.js / i18n / 插件版本 / CHANGELOG / docs', status: 'pass', selected: false, checked: true },
  { title: '回滚方式写入 release 记录，可 revert 本批次提交', status: 'blocked', selected: false },
  { title: '设计稿与自检评分随 design 阶段提交', status: 'pending', selected: false },
  { title: '验收复核报告引用本轮 10 条验收项', status: 'pending', selected: false },
  { title: '测试报告覆盖默认收起 / 持久化 / 键盘三组', status: 'pending', selected: false },
]
const EV_NAMES = ['360-default.png', 'a11y.log', '691-shots.png', 'dark.png', 'audit.json', 'tab-order.log', 'overflow.png', 'focus.png', 'collapse.png', 'grep.log', 'report.md', 'mobile.png', 'tree.png', 'history.log', 'bundle.zip.txt', 'contrast.png', 'modal.png', 'keyboard.png', 'theme.png', 'notes.md']
const SHARES = [
  { left: 'localhost:5173 → :4173' },
  { left: 'localhost:3000 → :4180' },
  { left: 'localhost:8080 → :4181' },
]
const DELIVERIES = [
  { name: 'delivery-1.2.83.zip', meta: '128 文件 · 10-27 12:02' },
  { name: 'delivery-1.2.82.zip', meta: '126 文件 · 10-26 18:40' },
  { name: 'delivery-1.2.81.zip', meta: '124 文件 · 10-26 11:08' },
]
const COMMANDS = [
  'npm test · 自检 host-smoke',
  'npm run check · 语法检查',
  'npm run check:json · package/JSON 校验',
  'npm run build · 重建客户端 bundle',
]

/* ------------------------------------------------------------------ *
 * mocks (R2 — final)
 * ------------------------------------------------------------------ */
const G_ITEMS = [
  { label: '验收 · 折叠与持久化', items: ITEMS_A },
  { label: '验收 · 可访问性与布局', items: ITEMS_B },
  { label: '验收 · 回归与文档', items: ITEMS_C },
]

function mockDefault360() {
  const th = LIGHT
  const W = 360
  let y = 0
  let body = labelStrip(W, th, '验收台 · 默认态 · 侧栏 360px · 浅色', 'v1.2.84 设计稿')
  y = 26
  const add = (part) => { body += `<g transform="translate(0 ${y})">${part.svg}</g>`; y += part.h }
  add(accToolbar(W, th, { toggleLabel: '全部收起', toggleOpen: true }))
  add(accHint(W, th, HINT))
  add(accCounts(W, th, COUNT_ROWS))
  add(accAdd(W, th))
  add(accFilters(W, th))
  add(accTemplateToggle(W, th))
  const listH = 430
  const list = renderList(W, th, { y, listH, groups: G_ITEMS.map((g) => ({ ...g, open: true })) })
  body += list.svg
  y += list.h
  const blockStack = stack([
    blockHead(W, th, { title: '证据库', badges: [{ label: '20 条证据', kind: 'neutral' }], open: false }),
    blockHead(W, th, { title: '复测中心', badges: [{ label: '2 通过 / 0 失败', kind: 'ok' }], open: false }),
    blockHead(W, th, { title: '交付与预览分享', badges: [{ label: '3 个分享', kind: 'neutral' }, { label: '5 个交付', kind: 'neutral' }], open: false }),
  ], y)
  body += blockStack.svg
  y = blockStack.y
  const foot = noteStrip(W, th, [
    '① 三区块只露区块头：标题 + 摘要徽标 + 箭头，整行 button 可点（高 44）。',
    '② 清单默认展开、吃掉剩余高度 430px，三区块固定在清单下方。',
    '③ 「全部收起」= 三区块 + 全部分组 + 详情（单按钮动态文案）。',
    '④ 徽标最多 2 个、每个 ≤96px 省略；超 2 个合并为 +n。',
  ])
  body += `<g transform="translate(0 ${y})">${foot.svg}</g>`
  y += foot.h
  return { name: 'acceptance-collapse-default-360', svg: doc(W, y, body, '验收台默认态（三区块收起）360px') }
}

function mockExpanded360() {
  const th = LIGHT
  const W = 360
  let y = 0
  let body = labelStrip(W, th, '验收台 · 三区块展开 · 侧栏 360px · 浅色', 'v1.2.84 设计稿')
  y = 26
  const add = (part) => { body += `<g transform="translate(0 ${y})">${part.svg}</g>`; y += part.h }
  add(accToolbar(W, th, { toggleLabel: '全部收起', toggleOpen: true }))
  add(accHint(W, th, HINT))
  add(accCounts(W, th, COUNT_ROWS))
  add(accAdd(W, th))
  add(accFilters(W, th))
  const listH = 132
  const list = renderList(W, th, { y, listH, hint: '↓ 清单保底 96px，仍可滚动', groups: G_ITEMS.map((g) => ({ ...g, open: true })) })
  body += list.svg
  y += list.h
  const blocks = [
    { head: blockHead(W, th, { title: '证据库', badges: [{ label: '20 条证据', kind: 'neutral' }], open: true }), body: evidenceBody(W, th, { count: 20, cols: 4, names: EV_NAMES }) },
    { head: blockHead(W, th, { title: '复测中心', badges: [{ label: '2 通过 / 0 失败', kind: 'ok' }], open: true }), body: verifyBody(W, th, { commands: COMMANDS }) },
    { head: blockHead(W, th, { title: '交付与预览分享', badges: [{ label: '3 个分享', kind: 'neutral' }, { label: '5 个交付', kind: 'neutral' }], open: true }), body: deliveryBody(W, th, { shares: SHARES, deliveries: DELIVERIES }) },
  ]
  for (const b of blocks) {
    body += `<g transform="translate(0 ${y})">${b.head.svg}</g>`; y += b.head.h
    body += `<g transform="translate(0 ${y})">${b.body.svg}</g>`; y += b.body.h
  }
  const foot = noteStrip(W, th, [
    '① 展开后内容与 v1.2.83 一致：上传、复测命令、打包/下载/分享都在。',
    '② 复测中心已扁平化：展开 = 最近结果 + 命令列表 + 运行，无内层开关。',
    '③ 真实面板内区块体各自滚动：证据 ≤260 / 复测 ≤240 / 交付 ≤340',
    '   （右侧滚动条示意）；本图连续绘出完整内容便于逐块评审。',
  ])
  body += `<g transform="translate(0 ${y})">${foot.svg}</g>`
  y += foot.h
  return { name: 'acceptance-collapse-expanded-360', svg: doc(W, y, body, '验收台三区块展开态 360px') }
}

function mockAllCollapsed360() {
  const th = LIGHT
  const W = 360
  let y = 0
  let body = labelStrip(W, th, '验收台 · 全部收起 · 侧栏 360px · 浅色', 'v1.2.84 设计稿')
  y = 26
  const add = (part) => { body += `<g transform="translate(0 ${y})">${part.svg}</g>`; y += part.h }
  add(accToolbar(W, th, { toggleLabel: '全部展开', toggleOpen: false }))
  add(accHint(W, th, HINT))
  add(accCounts(W, th, COUNT_ROWS))
  add(accAdd(W, th))
  add(accFilters(W, th))
  const listH = 200
  const list = renderList(W, th, {
    y, listH,
    hint: '↓ 全部分组已收起 · 点分组头单独展开，或用「全部展开」',
    groups: G_ITEMS.map((g) => ({ ...g, open: false })),
  })
  body += list.svg
  y += list.h
  const dh = detailHead(W, th, { title: '证据库、复测中心、交付与预览分享默认收起，点区块头展开', status: 'pass', statusLabel: '通过', open: false })
  body += `<g transform="translate(0 ${y})">${dh.svg}</g>`; y += dh.h
  const blockStack = stack([
    blockHead(W, th, { title: '证据库', badges: [{ label: '20 条证据', kind: 'neutral' }], open: false }),
    blockHead(W, th, { title: '复测中心', badges: [{ label: '2 通过 / 0 失败', kind: 'ok' }], open: false }),
    blockHead(W, th, { title: '交付与预览分享', badges: [{ label: '3 个分享', kind: 'neutral' }, { label: '5 个交付', kind: 'neutral' }], open: false }),
  ], y)
  body += blockStack.svg
  y = blockStack.y
  const foot = noteStrip(W, th, [
    '① 「全部收起」后：三区块 + 全部分组 + 详情都收起，选中不取消。',
    '② 详情头保留状态徽标 + 选中标题 + 「详情已收起」，清单行高亮仍在。',
    '③ 工具区按钮变成「全部展开」，一次恢复三区块 + 全部分组 + 详情。',
    '④ 折叠偏好写 localStorage，刷新后仍是本态（选中项按现状不持久）。',
  ])
  body += `<g transform="translate(0 ${y})">${foot.svg}</g>`
  y += foot.h
  return { name: 'acceptance-collapse-all-collapsed-360', svg: doc(W, y, body, '验收台全部收起态 360px') }
}

function mockDetail360() {
  const th = LIGHT
  const W = 360
  let y = 0
  let body = labelStrip(W, th, '验收台 · 选中项详情展开 · 侧栏 360px · 浅色', 'v1.2.84 设计稿')
  y = 26
  const add = (part) => { body += `<g transform="translate(0 ${y})">${part.svg}</g>`; y += part.h }
  add(accToolbar(W, th, { toggleLabel: '全部收起', toggleOpen: true }))
  add(accHint(W, th, HINT))
  add(accCounts(W, th, COUNT_ROWS))
  add(accAdd(W, th))
  add(accFilters(W, th))
  const itemsA = [{ ...ITEMS_A[0], selected: true, checked: true }, { ...ITEMS_A[1] }, { ...ITEMS_A[2] }]
  const listH = 196
  const list = renderList(W, th, {
    y, listH,
    hint: '↓ 选中行 = brand 8% 底 + 2px 左指示条（不只靠颜色）',
    groups: [{ label: '验收 · 折叠与持久化', open: true, items: itemsA, count: ITEMS_A.length }],
  })
  body += list.svg
  y += list.h
  const dh = detailHead(W, th, { title: '证据库、复测中心、交付与预览分享默认收起，点区块头展开', status: 'pass', statusLabel: '通过', open: true })
  body += `<g transform="translate(0 ${y})">${dh.svg}</g>`; y += dh.h
  const db = detailBody(W, th, {
    category: '验收 · 折叠与持久化',
    retest: '复测 2 轮',
    requirement: '打开验收台（localStorage 无偏好）时三块均为收起态，只显示区块头；点击任意位置展开，再点收起；证据徽标 = 证据数量，复测徽标 = 最近通过/失败，交付徽标 = 分享数 / 交付记录数。',
    note: '折叠状态写入 localStorage，分组 key 用分类原值，切中英文不丢状态。',
    evidence: 3,
  })
  body += `<g transform="translate(0 ${y})">${db.svg}</g>`; y += db.h
  const blockStack = stack([
    blockHead(W, th, { title: '证据库', badges: [{ label: '20 条证据', kind: 'neutral' }], open: false }),
    blockHead(W, th, { title: '复测中心', badges: [{ label: '2 通过 / 0 失败', kind: 'ok' }], open: false }),
    blockHead(W, th, { title: '交付与预览分享', badges: [{ label: '3 个分享', kind: 'neutral' }, { label: '5 个交付', kind: 'neutral' }], open: false }),
  ], y)
  body += blockStack.svg
  y = blockStack.y
  const foot = noteStrip(W, th, [
    '① 详情头 48px：状态徽标 + 选中标题（≤2 行截断）+ 箭头，整行 button。',
    '② 收起后详情头显示「详情已收起 · 选中保留」，清单行高亮不消失。',
    '③ 取消选中 → 详情整块消失；选中另一项 → 自动重新展开。',
    '④ 详情展开时清单最短 96px，仍可滚动（本图 196px）。',
  ])
  body += `<g transform="translate(0 ${y})">${foot.svg}</g>`
  y += foot.h
  return { name: 'acceptance-collapse-detail-360', svg: doc(W, y, body, '验收台选中详情展开态 360px') }
}

function mock691() {
  const th = LIGHT
  const W = 691
  let y = 0
  let body = labelStrip(W, th, '验收台 · 默认态 · 691px 截图宽度（compact 全宽）· 浅色', 'v1.2.84 设计稿')
  y = 26
  const add = (part) => { body += `<g transform="translate(0 ${y})">${part.svg}</g>`; y += part.h }
  add(accToolbar(W, th, { toggleLabel: '全部收起', toggleOpen: true }))
  add(accHint(W, th, HINT))
  add(accCounts(W, th, COUNT_ROWS))
  add(accAdd(W, th))
  add(accFilters(W, th))
  add(accTemplateToggle(W, th))
  const listH = 470
  const list = renderList(W, th, { y, listH, groups: G_ITEMS.map((g) => ({ ...g, open: true })) })
  body += list.svg
  y += list.h
  const blockStack = stack([
    blockHead(W, th, { title: '证据库', badges: [{ label: '20 条证据', kind: 'neutral' }], open: false, hover: true }),
    blockHead(W, th, { title: '复测中心', badges: [{ label: '2 通过 / 0 失败', kind: 'ok' }], open: false, focus: true }),
    blockHead(W, th, { title: '交付与预览分享', badges: [{ label: '3 个分享', kind: 'neutral' }, { label: '5 个交付记录', kind: 'neutral' }], open: false }),
  ], y)
  body += blockStack.svg
  y = blockStack.y
  const foot = noteStrip(W, th, [
    '① 691px（Owner 本机截图宽度，compact 全宽）：徽标 2 个完整显示，不省略。',
    '② 区块头 44px、整行 button；证据库 = hover（ink 6% 底），复测中心 = :focus-visible',
    '   （2px brand 环 inset -2，避免被 overflow:hidden 裁掉；浅色 18.90:1）。',
    '③ 清单仍是主内容：470px，3 个分组全部展开；箭头固定最右列。',
    '④ 面板宽度 <420px 才走窄规则（徽标 ≤1 + n、标题省略）；691 不触发。',
  ])
  body += `<g transform="translate(0 ${y})">${foot.svg}</g>`
  y += foot.h
  return { name: 'acceptance-collapse-691', svg: doc(W, y, body, '验收台 691px 截图宽度') }
}

function mockDark900() {
  const th = DARK
  const PW = 560
  const W = 900
  let panel = ''
  let y = 0
  panel += labelStrip(PW, th, '验收台 · 深色主题片段 · 面板 560px', 'v1.2.84')
  y = 26
  const add = (part) => { panel += `<g transform="translate(0 ${y})">${part.svg}</g>`; y += part.h }
  add(accToolbar(PW, th, { toggleLabel: '全部收起', toggleOpen: true }))
  add(accCounts(PW, th, COUNT_ROWS, 28))
  add(accFilters(PW, th))
  const itemsA = [{ ...ITEMS_A[0], selected: true, checked: true }, { ...ITEMS_A[1] }, { ...ITEMS_A[2] }]
  const listH = 208
  const list = renderList(PW, th, { y, listH, groups: [{ label: '验收 · 折叠与持久化', open: true, items: itemsA, count: ITEMS_A.length }] })
  panel += list.svg
  y += list.h
  const dh = detailHead(PW, th, { title: '证据库、复测中心、交付与预览分享默认收起，点区块头展开', status: 'pass', statusLabel: '通过', open: false })
  panel += `<g transform="translate(0 ${y})">${dh.svg}</g>`; y += dh.h
  const bh1 = blockHead(PW, th, { title: '证据库', badges: [{ label: '20 条证据', kind: 'neutral' }], open: false })
  panel += `<g transform="translate(0 ${y})">${bh1.svg}</g>`; y += bh1.h
  const bh2 = blockHead(PW, th, { title: '复测中心', badges: [{ label: '2 通过 / 0 失败', kind: 'ok' }], open: true })
  panel += `<g transform="translate(0 ${y})">${bh2.svg}</g>`; y += bh2.h
  const vb = verifyBody(PW, th, { commands: COMMANDS })
  panel += `<g transform="translate(0 ${y})">${vb.svg}</g>`; y += vb.h
  const bh3 = blockHead(PW, th, { title: '交付与预览分享', badges: [{ label: '3 个分享', kind: 'neutral' }, { label: '5 个交付', kind: 'neutral' }], open: false, focus: true })
  panel += `<g transform="translate(0 ${y})">${bh3.svg}</g>`; y += bh3.h
  const panelEnd = y + 8
  // notes column
  let notes = ''
  let nx = PW + 24
  let ny = 44
  notes += text(nx, ny, '深色主题：折叠组件实测对比度', { size: 12, weight: 700, fill: th.ink })
  ny += 10
  notes += text(nx, ny + 8, '面板底 = bg-layer-2 46% + bg-layer-1（#272729）', { size: 9, fill: th.ink2 })
  ny += 28
  const rows = [
    ['区块头标题', 'label-primary #F9FAFB / #272729 = 14.27'],
    ['摘要徽标', 'label-secondary #CFD3D6 / #343436 = 8.25'],
    ['徽标（通过）', '#4ED17E / #233C2C = 6.13'],
    ['徽标（不通过）', '#F25A5A / #3C1F1B = 4.55'],
    ['徽标（阻塞）', '#F7AD31 / #2A261D = 7.88'],
    ['箭头 chevron', 'label-secondary #CFD3D6 = 9.90（≥3 非文本）'],
    ['焦点环 2px', 'brand #F9FAFB / 面板 = 14.27（≥3）'],
    ['选中行', 'brand 8% #38383A，正文 #F9FAFB = 11.20'],
    ['分隔线', 'border-l1 #FFFFFF0F → #343436（装饰，不表意）'],
    ['主按钮（运行复测）', 'fill #F9FAFB / 文字 #0F1115 = 18.08'],
  ]
  for (const [k, v] of rows) {
    notes += text(nx, ny, k, { size: 9.5, weight: 600, fill: th.ink2 })
    ny += 13
    notes += text(nx, ny, v, { size: 9, fill: th.ink3 })
    ny += 19
  }
  ny += 10
  notes += text(nx, ny, '与浅色主题同一套组件与 token：', { size: 9.5, weight: 600, fill: th.ink })
  ny += 15
  notes += text(nx, ny, '只改 alias 取值，不新增硬编码色；深浅切换无布局位移。', { size: 9, fill: th.ink3 })
  ny += 13
  notes += text(nx, ny, '深色下「运行复测」= 白底深字（brand-primary 反转）。', { size: 9, fill: th.ink3 })
  ny += 13
  notes += text(nx, ny, '展开的复测区块：最近结果 + 命令列表 + 运行，无内层开关。', { size: 9, fill: th.ink3 })
  ny += 13
  notes += text(nx, ny, '折叠头全部是 button；收起内容 hidden，不进 Tab 序列。', { size: 9, fill: th.ink3 })
  const H = Math.max(panelEnd, ny + 16, 520)
  let body = rect(0, 0, W, H, { fill: th.canvas })
  body += rect(0, 0, PW, H, { fill: th.panel })
  body += vline(PW, 0, H, th.line)
  body += panel + notes
  return { name: 'acceptance-collapse-dark-900', svg: doc(W, H, body, '验收台深色主题片段 900px') }
}

/* ------------------------------------------------------------------ *
 * R1 first draft (iteration evidence) — deliberately unresolved
 * ------------------------------------------------------------------ */
function mockDefaultR1() {
  const th = LIGHT
  const W = 360
  let y = 0
  let body = labelStrip(W, th, 'R1 首版 · 默认态 · 360px（未迭代）', 'v1.2.84 r1')
  y = 26
  const add = (part) => { body += `<g transform="translate(0 ${y})">${part.svg}</g>`; y += part.h }
  add(accToolbar(W, th, { t: T, twoButtons: true }))
  add(accHint(W, th, HINT))
  add(accCounts(W, th, COUNT_ROWS))
  add(accAdd(W, th))
  add(accFilters(W, th))
  add(accTemplateToggle(W, th))
  const listH = 360
  body += rect(0, y, W, listH, { fill: th.panel })
  let ly = y
  body += `<g transform="translate(0 ${ly})">${groupHead(W, th, { label: '验收 · 折叠与持久化', count: 7, open: true, interactive: false }).svg}</g>`
  ly += 28
  for (let i = 0; i < 4; i++) { const r = itemRow(W, th, ITEMS_A[i]); body += `<g transform="translate(0 ${ly})">${r.svg}</g>`; ly += r.h }
  body += `<g transform="translate(0 ${ly})">${groupHead(W, th, { label: '验收 · 可访问性与布局', count: 7, open: true, interactive: false }).svg}</g>`
  ly += 28
  for (let i = 0; i < 2; i++) { const r = itemRow(W, th, ITEMS_B[i]); body += `<g transform="translate(0 ${ly})">${r.svg}</g>`; ly += r.h }
  y += listH
  // R1: action buttons inside block headers -> crowded / overflowing at 360
  const blockStack = stack([
    blockHead(W, th, { title: '证据库', badges: [{ label: '20 条证据', kind: 'neutral' }], actions: ['添加证据'], open: false }),
    blockHead(W, th, { title: '复测中心', badges: [{ label: '2 通过 / 0 失败', kind: 'ok' }], actions: ['复测'], open: false }),
    blockHead(W, th, { title: '交付与预览分享', badges: [{ label: '3 个分享', kind: 'neutral' }, { label: '5 个交付', kind: 'neutral' }], actions: ['打包', '分享'], open: false }),
  ], y)
  body += blockStack.svg
  y = blockStack.y
  const foot = noteStrip(W, th, [
    'R1 问题（渲染后检查）：① 操作按钮放进区块头 → 嵌套按钮 + 行内拥挤；',
    '② 交付头「标题+2 按钮+2 徽标+箭头」超出 360 右缘（裁切）；',
    '③ 分组头是 div，无箭头、不可点；④ 两个工具区按钮语义重复。',
  ])
  body += `<g transform="translate(0 ${y})">${foot.svg}</g>`
  y += foot.h
  return { name: 'acceptance-collapse-default-r1-360', svg: doc(W, y, body, 'R1 验收台默认态 360px（迭代前）') }
}

function mockExpandedR1() {
  const th = LIGHT
  const W = 360
  let y = 0
  let body = labelStrip(W, th, 'R1 首版 · 展开态 · 360px（未迭代）', 'v1.2.84 r1')
  y = 26
  const add = (part) => { body += `<g transform="translate(0 ${y})">${part.svg}</g>`; y += part.h }
  add(accToolbar(W, th, { t: T, twoButtons: true }))
  add(accHint(W, th, HINT))
  add(accCounts(W, th, COUNT_ROWS))
  add(accAdd(W, th))
  add(accFilters(W, th))
  // R1: blocks expanded with no max-height -> list crushed to 24px
  const listH = 24
  body += rect(0, y, W, listH, { fill: th.panel })
  body += text(10, y + 16, '清单被挤到 24px（禁止塌成 0 未落实）', { size: 9, fill: th.errInk })
  y += listH
  const blocks = [
    { head: blockHead(W, th, { title: '证据库', badges: [{ label: '20 条证据', kind: 'neutral' }], actions: ['添加证据'], open: true }), body: evidenceBody(W, th, { count: 20, cols: 4, names: EV_NAMES }) },
    { head: blockHead(W, th, { title: '复测中心', badges: [{ label: '2 通过 / 0 失败', kind: 'ok' }], actions: ['复测'], open: true }), body: verifyBody(W, th, { commands: COMMANDS }) },
    { head: blockHead(W, th, { title: '交付与预览分享', badges: [{ label: '3 个分享', kind: 'neutral' }, { label: '5 个交付', kind: 'neutral' }], actions: ['打包', '分享'], open: true }), body: deliveryBody(W, th, { shares: SHARES, deliveries: DELIVERIES }) },
  ]
  for (const b of blocks) {
    body += `<g transform="translate(0 ${y})">${b.head.svg}</g>`; y += b.head.h
    body += `<g transform="translate(0 ${y})">${b.body.svg}</g>`; y += b.body.h
  }
  const foot = noteStrip(W, th, [
    'R1 问题（渲染后检查）：① 三块都展开后清单只剩 24px，主内容被挤没；',
    '② 复测中心两层开关：区块头 + 内层「复测」按钮，用户要点两次；',
    '③ 区块体无 max-height，证据 20 条把面板拉长到 1600+；',
    '④ 展开态与收起态按钮文案相同，状态反馈不清。',
  ])
  body += `<g transform="translate(0 ${y})">${foot.svg}</g>`
  y += foot.h
  return { name: 'acceptance-collapse-expanded-r1-360', svg: doc(W, y, body, 'R1 验收台展开态 360px（迭代前）') }
}

/* ------------------------------------------------------------------ *
 * main
 * ------------------------------------------------------------------ */
const files = R1
  ? [mockDefaultR1(), mockExpandedR1()]
  : [mockDefault360(), mockExpanded360(), mockAllCollapsed360(), mockDetail360(), mock691(), mockDark900()]

for (const f of files) {
  writeFileSync(join(OUT, `${f.name}.svg`), f.svg)
  console.log('wrote', f.name + '.svg', f.svg.length, 'bytes')
}
