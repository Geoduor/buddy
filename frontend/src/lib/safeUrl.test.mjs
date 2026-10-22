// Run: node frontend/src/lib/safeUrl.test.mjs  (also runs in CI)
import assert from 'node:assert/strict'
import { learnUrl } from './safeUrl.js'

const ok = [
  'https://learn.microsoft.com/en-us/training/modules/describe-cloud-compute/6-describe-consumption-based-model',
  'https://learn.microsoft.com/credentials/certifications/resources/study-guides/az-900',
]
for (const u of ok) assert.equal(learnUrl(u), new URL(u).href, `should allow ${u}`)

const bad = [
  'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x',
  'http://learn.microsoft.com/x', 'https://evil.example/x', 'https://learn.microsoft.com.evil.example/x',
  'https://evil.example/https://learn.microsoft.com/', 'https://user@evil.example/', '//learn.microsoft.com/x',
  '', null, undefined, 42, {}, 'not a url',
]
for (const u of bad) assert.equal(learnUrl(u), null, `should reject ${String(u)}`)
console.log(`safeUrl: ${ok.length} allowed and ${bad.length} rejected as expected`)
