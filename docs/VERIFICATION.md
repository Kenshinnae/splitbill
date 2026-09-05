# ผลตรวจ baseline

## ผลตรวจล่าสุดหลังแก้ภาษาและ PWA (2026-09-05)

`npm run lint`, `npm test` (27 เคส), `tsc --noEmit --incremental false` และ `npm run build` ผ่านในสำเนา source เดียวกันที่ `/private/tmp/splitbill-validation` หลัง npm ci ตาม lockfile เพื่อเลี่ยงไฟล์ dataless ใน dependencies เดิม Build ใช้สิทธิ์เปิดพอร์ตภายในที่ Turbopack ต้องใช้ มีคำเตือน NFT tracing ของ Firebase config fallback แต่ build สำเร็จ

ตรวจ browser หน้าแรก/login สลับไทย/อังกฤษ, จำค่าหลัง reload, ข้อมูลฟอร์มไม่หาย, viewport 390×844 ไม่ล้น, html lang และฟอนต์ถูกต้อง Console ไม่มี error หลังแก้ Firebase hydration ใช้ config จำลองใน temp ไม่ได้เรียก OCR จริงหรือทดสอบ photo picker บน iPhone จริง

รายละเอียด test cases, สิ่งที่เปลี่ยน และข้อจำกัดอยู่ใน [LANGUAGE_AND_PWA.md](LANGUAGE_AND_PWA.md) ผลด้านล่างเป็นประวัติการสำรวจก่อนแก้โค้ด ไม่ใช่สถานะล่าสุด

วันที่ 2026-09-05, checkout baseline `6a9558a`, Node v24.13.1, npm 11.8.0

## ขอบเขตการสำรวจ

อ่าน routes ทั้งหมด, shared components/hooks, Firestore model/service/rules/indexes, calculations/tests, receipt API/schema/mapper และ parser เดิม, Firebase config bootstrap, PWA/notifications, scripts และ project configs อ่านคู่มือ Next.js ที่ติดตั้งหัวข้อ environment variables และ route handlers ประกอบ

ตรวจ local Git: origin fetch/push ตรง https://github.com/Kenshinnae/splitbill.git, branch main, working tree ก่อนเริ่มสะอาด ไม่ได้ติดต่อ GitHub เพื่อยืนยัน remote HEAD

## Automated checks

| คำสั่ง | ผล |
| --- | --- |
| npm test | ผ่าน 2 files / 17 tests: calculations 4, receipt-parser 13 |
| ./node_modules/.bin/tsc --noEmit --incremental false | ผ่าน exit 0 |
| npm run lint | หยุดด้วย Ctrl+C (exit 130) หลังรอหลายนาทีโดยไม่มีผลจาก ESLint; ยังยืนยัน pass/fail ไม่ได้ |
| npm run build | หยุดด้วย Ctrl+C (exit 130) หลังรอหลายนาทีโดยไม่มีผลจาก Next build; ยังยืนยัน build ไม่ได้ |
| Markdown local links / code fences | ผ่านการตรวจไฟล์อ้างอิงและคู่ code fences ทั้ง 10 ไฟล์ Markdown ที่เปลี่ยน/เพิ่ม |
| git diff --check | ผ่าน; ตรวจรายการเปลี่ยนแปลงแล้วมีเฉพาะ Markdown |

Lint/build ถูกหยุดเพื่อไม่ทิ้ง process ตรวจสอบค้างไว้ ไม่มี diagnostic ที่ใช้ระบุสาเหตุได้ และไม่ได้แก้โค้ดเพื่อให้ผ่าน ต้องรันสองรายการนี้ใหม่เมื่อเริ่มรอบแก้ฟังก์ชันก่อน deploy อย่าใช้ artifacts ใน .next เดิมเป็นหลักฐานของ build ครั้งนี้

Tests ปัจจุบันครอบคลุม shared/quantity/single ตัวอย่างพื้นฐานและ parser ข้อความไทย ไม่ครอบคลุม Firestore rules, service mutations, multi-user flow, OpenAI route/mapper, image normalization หรือ browser UI จึงไม่ใช่หลักฐานว่า guest flow หรือ production ทำงานครบ

TypeScript tsconfig exclude **/*.test.ts และ vitest.config.ts; Vitest ใช้ node environment และ include lib/**/*.test.ts, alias @ ไป root; ESLint ใช้ Next core-web-vitals และ TypeScript configs

## สิ่งที่ไม่ได้ทดสอบหรือเปลี่ยน

- ไม่ได้ login หรือสร้าง/แก้/ลบบิลจริง ไม่ได้เรียก OpenAI extraction ด้วยรูปจริง
- ไม่ได้เปิด browser ตรวจหน้าจอ, mobile rendering, guest หลายคน, PWA install หรือ notification
- ไม่ได้ยืนยัน deployed Firebase rules, indexes, Hostinger env/build settings, production URL หรือ live service status
- ไม่มี emulator test suite ใน source ที่สำรวจ และไม่ได้ deploy rules
- ไม่ได้รัน seed-owner, ngrok หรือ zip:hostinger
- ไม่ได้อ่านค่าลับจาก .env.local/.env.hostinger เพื่อใส่รายงาน
- รอบนี้เปลี่ยนเฉพาะ README.md, AGENTS.md และ docs/*.md ไม่มี application behavior change, commit หรือ push

Known issues เป็นข้อสังเกตที่มีหลักฐานจาก source; ประเด็น concurrency/browser/deployed config ต้อง reproduce ใน test environment เมื่อเริ่มงานแก้ไข อ่าน [Known issues](KNOWN_ISSUES.md) และ [Maintenance](MAINTENANCE.md)
