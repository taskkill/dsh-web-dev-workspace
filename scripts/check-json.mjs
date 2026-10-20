import { readFileSync } from 'node:fs'

const files = [
  'package.json',
  'dsh-side-plugin/package.json',
  'dsh-side-plugin/locale/en.json',
  'dsh-side-plugin/locale/zh.json',
  'dsh-side-io/package.json',
  'dsh-side-io/locale/en.json',
  'dsh-side-io/locale/zh.json',
  'dsh-side-git/package.json',
  'dsh-side-git/locale/en.json',
  'dsh-side-git/locale/zh.json',
]

for (const file of files) JSON.parse(readFileSync(file, 'utf8'))
console.log('JSON OK')
