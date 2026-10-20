import { readFileSync } from 'node:fs'

const files = [
  'package.json',
  'dsh-web-filebrowser-plugin/package.json',
  'dsh-web-filebrowser-plugin/locale/en.json',
  'dsh-web-filebrowser-plugin/locale/zh.json',
  'dsh-web-filebrowser-io/package.json',
  'dsh-web-filebrowser-io/locale/en.json',
  'dsh-web-filebrowser-io/locale/zh.json',
  'dsh-web-filebrowser-git/package.json',
  'dsh-web-filebrowser-git/locale/en.json',
  'dsh-web-filebrowser-git/locale/zh.json',
]

for (const file of files) JSON.parse(readFileSync(file, 'utf8'))
console.log('JSON OK')
