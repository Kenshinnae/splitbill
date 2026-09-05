# SplitBill

เว็บหารบิลแบบ real time สำหรับมือถือ เจ้าของบิล login ด้วย Firebase Email/Password สร้างรายการจากรูปใบเสร็จด้วย OpenAI หรือกรอกเอง แชร์ลิงก์ให้เพื่อนเลือกชื่อและรายการโดยไม่ต้องสมัครบัญชี รองรับหารเท่ากัน หารตามจำนวนที่รับ และจ่ายทั้งรายการคนเดียว เมื่อทุกคนกด done เจ้าของสรุปบิลพร้อมแสดงรูป QR รับเงินได้

## เริ่มอ่านโปรเจค

สำรวจจาก source ณ **2026-09-05**, baseline commit `6a9558a` ไม่ใช่ผลยืนยัน production เริ่มที่ [สารบัญ](docs/README.md) แล้วอ่านเฉพาะหัวข้อที่จะแก้

| เอกสาร | ใช้เมื่อ |
| --- | --- |
| [Architecture](docs/ARCHITECTURE.md) | ทำความเข้าใจ routes, components และ flow หน้าจอ |
| [Data and calculations](docs/DATA_AND_CALCULATIONS.md) | แก้ Firestore, realtime, สูตรหาร, finalize, QR |
| [Receipt extraction](docs/RECEIPT_EXTRACTION.md) | แก้ upload, OpenAI, schema, parser |
| [Configuration and deployment](docs/CONFIG_AND_DEPLOYMENT.md) | ตั้งค่าเครื่อง, Firebase, Hostinger, push |
| [Maintenance](docs/MAINTENANCE.md) | หาว่าควรแก้ไฟล์ใดและตรวจอะไร |
| [Known issues](docs/KNOWN_ISSUES.md) | ดูข้อจำกัดและประเด็นที่พบจาก source |
| [Verification](docs/VERIFICATION.md) | ผลตรวจ baseline และขอบเขตที่ยังไม่ได้ทดสอบ |

## Stack และคำสั่ง

Next.js **16.2.3** App Router, React **19.2.4**, TypeScript strict, Tailwind CSS 4, Firebase JS SDK 12 และ Vitest 4 ใช้ Node.js ตาม package.json: `>=20` ไม่มี Firebase Admin SDK หรือ backend CRUD ของบิล การเขียนบิลเกิดจาก browser ไป Firestore โดยตรง

```bash
npm ci
npm run dev
```

ตั้ง `.env.local` ก่อนใช้ Firebase และอ่านใบเสร็จ ดู [คู่มือตั้งค่า](docs/CONFIG_AND_DEPLOYMENT.md) เครื่องที่สำรวจมี `.env.example` แต่ยังไม่ถูก track จึงอาจไม่มีหลัง clone ใหม่

| คำสั่ง | หน้าที่ |
| --- | --- |
| `npm run dev` | Next dev ด้วย webpack |
| `npm run build` | Production build |
| `npm start` | Next server บน 0.0.0.0, ใช้ PORT หรือ 3000 |
| `npm run lint` | ESLint |
| `npm test` / `npm run test:watch` | Vitest ครั้งเดียว / watch |
| `./node_modules/.bin/tsc --noEmit --incremental false` | Typecheck โดยไม่สร้าง incremental cache |
| `npm run ngrok` | เปิด tunnel ไป dev server ที่รันอยู่ |
| `npm run seed-owner` | สร้าง Firebase Auth user ผ่าน REST มีผลกับระบบภายนอก |
| `npm run deploy:firebase-rules` | Deploy Firestore และ Storage rules ไม่รวม indexes |
| `npm run zip:hostinger` | สร้าง ZIP สำหรับวิธี upload เดิม พร้อม env production |

## Repository และการเผยแพร่

Repository: [Kenshinnae/splitbill](https://github.com/Kenshinnae/splitbill), branch `main` และ remote `origin` ตั้งถูกต้องใน checkout นี้แล้ว

**ตามข้อมูลจากเจ้าของโปรเจค การ push จะทำให้ Hostinger build ใหม่ทันที** ถือเป็นขั้นตอน deploy อ่าน [คู่มือ deploy](docs/CONFIG_AND_DEPLOYMENT.md) ก่อนดำเนินการ รอบแก้ไขถัดมาเพิ่มไทย/อังกฤษและแก้ PWA upload โดยผู้ใช้อนุญาตให้ push แล้ว ดู [บันทึกปัจจุบัน](docs/LANGUAGE_AND_PWA.md)

เอกสารช่วยลดการสำรวจทั้งโปรเจค เวลาแก้จริงยังต้องเปิด source เฉพาะส่วนที่เกี่ยวข้องและปรับเอกสารตาม โดยเฉพาะ Next.js ให้อ่านคู่มือเวอร์ชันที่ติดตั้งใน `node_modules/next/dist/docs/` ตาม [AGENTS.md](AGENTS.md)
