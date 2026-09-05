# Configuration และ deployment

> ปรับปรุง 2026-09-05: อ่าน [ภาษาและ PWA — พฤติกรรมปัจจุบัน](LANGUAGE_AND_PWA.md) ประกอบ โดยหัวข้อภาษา, image decode, upload/extraction, Firebase hydration และ service worker ในบันทึกใหม่นี้แทนรายละเอียด baseline เดิม

สำรวจ 2026-09-05 baseline `6a9558a` พฤติกรรม Hostinger auto-build มาจากข้อมูลผู้ใช้ ยังไม่ได้เปิด dashboard/logs หรือยืนยัน production settings

## Environment variables

ห้ามใส่ค่าจริงของ secret ลงเอกสาร Git หรือ public JSON เครื่องนี้มี .env.local, .env.hostinger และ .env.example; การสำรวจอ่านเฉพาะ template และโค้ดที่ใช้ env ไม่ได้คัดลอกค่าลับ

| Variable | ใช้ที่ใด |
| --- | --- |
| NEXT_PUBLIC_FIREBASE_API_KEY | Firebase browser config และ server token lookup ของ extraction |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | Firebase Auth config |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | Firebase project config |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | Storage config |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | Firebase public config |
| NEXT_PUBLIC_FIREBASE_APP_ID | Firebase public config |
| OPENAI_API_KEY | Server-only extraction API ห้าม prefix NEXT_PUBLIC_ |
| OPENAI_RECEIPT_MODEL | Optional override; source default gpt-5.6-sol |
| OPENAI_RECEIPT_IMAGE_DETAIL | Optional low/high/auto/original; default original |
| NGROK_AUTHTOKEN | Optional สำหรับ script ngrok |
| NGROK_PORT | Optional port tunnel → fallback PORT → 3000 |
| PORT | npm start port → fallback 3000 |

Firebase web config ตั้งใจเปิดเผยแก่ browser การจำกัดข้อมูลขึ้นกับ rules ตัว readiness check ตรวจเพียง apiKey/projectId ไม่ได้ยืนยันว่าค่าทั้ง 6 ถูกต้องครบ

.gitignore ignore `.env*` ทั้งหมด **รวม .env.example ซึ่งยังไม่ track** และ ignore public/firebase-config.json, ZIP, .next, node_modules, tsbuildinfo, next-env.d.ts หาก clone ใหม่ไม่มี template ให้สร้าง .env.local ด้วยชื่อตัวแปรในตาราง เมื่อเปลี่ยน env ให้ restart dev server

## Firebase bootstrap: ลำดับที่ต้องเข้าใจก่อนแก้ Hostinger

1. app/layout.tsx อ่านไฟล์ public config ก่อน env แล้ว embed JSON ที่ escape `<` ใน script ก่อน React
2. lib/firebase-server-config.ts ลอง `<cwd>/public/firebase-config.json`, `<cwd>/firebase-config.json`, `<cwd>/../public/firebase-config.json` ตามลำดับ
3. lib/firebase-bootstrap-script.ts ใช้ embedded config; ถ้าไม่มี apiKey ลอง synchronous XHR /firebase-config.json แล้วตั้ง window.__FIREBASE_CONFIG__
4. lib/firebase-public-config.ts ฝั่ง client เลือก window config ที่มี apiKey/projectId ก่อน env
5. components/FirebaseConfigGate.tsx ถ้ายังไม่พร้อม: fetch static JSON no-store → GET /api/public-config no-store → ค่อย mount children
6. GET /api/public-config ใช้ file-before-env resolver คืนเฉพาะ 6 Firebase public fields หรือ 503
7. lib/firebase.ts initialize app/auth/db/storage แบบ singleton; db ใช้ auto-detect long polling

ไฟล์ config เก่าที่ตกค้างสามารถชนะ env ใหม่ได้ อย่าสับสนระหว่าง config ที่ browser ใช้ได้กับ server extraction: verifyFirebaseIdToken ใช้ resolver ฝั่ง server เดียวกันแล้วในรอบภาษา/PWA

Local Next.js guide ที่อ่านประกอบ: node_modules/next/dist/docs/01-app/02-guides/environment-variables.md และ 03-api-reference/03-file-conventions/route.md ภายใต้ 01-app; NEXT_PUBLIC_* ที่ถูก bundle มีพฤติกรรม build-time จึงมี fallback หลายชั้นในแอปนี้ อย่าสรุปว่า layout อ่าน runtime env สดทุก request โดยไม่มีการตรวจ render mode/build output

## Local setup และตรวจสอบ

ใช้ package-lock.json กับ npm ci และ Node >=20 ตาม package.json เครื่องที่สำรวจใช้ Node v24.13.1 / npm 11.8.0

```bash
npm ci
npm run dev
```

ตั้ง Firebase project ให้มี Email/Password Auth, Firestore และ Storage บัญชี owner สร้างผ่าน Firebase Console Authentication → Users → Add user ไม่มี signup UI

seed-owner ใช้ Identity Toolkit accounts:signUp ต้องมี NEXT_PUBLIC_FIREBASE_API_KEY ใน process environment; script ไม่โหลด .env.local เอง และใช้งานไม่ได้ถ้าปิด signUp API มีผลสร้างบัญชีจริง

ngrok script โหลด .env.local โดยไม่ทับ env ที่มีอยู่ ต้องรัน npm run dev แยกก่อน มันไม่ start Next.js ให้ next.config.ts อนุญาต dev origins ของ ngrok; TunnelHint แสดงคำแนะนำเมื่อ hostname เป็น tunnel

## Git และ Hostinger

สถานะที่ตรวจใน local checkout:

- branch: main
- origin fetch/push: https://github.com/Kenshinnae/splitbill.git
- baseline HEAD: 6a9558a
- working tree ก่อนเขียนเอกสารสะอาด

**ผู้ใช้แจ้งว่า push แล้ว Hostinger build ใหม่ทันที** การ push จึงเป็น deploy step; คำขอถัดมาผู้ใช้อนุญาตให้แก้ภาษา/PWA และ push ได้

คำสั่งเริ่มต้นที่ผู้ใช้ให้ สำหรับ checkout ที่ยังไม่มี origin/ยังไม่ได้ตั้ง main เท่านั้น:

```bash
git remote add origin https://github.com/Kenshinnae/splitbill.git
git branch -M main
git push -u origin main
```

Checkout ปัจจุบันตั้ง origin/main แล้ว ไม่ต้อง remote add ซ้ำหรือ rename branch ใหม่ เมื่อมีงานที่อนุมัติให้ deploy ให้ตรวจ diff, test/build, commit เฉพาะไฟล์ของงาน แล้ว push origin main โดยไม่ force หลัง push ต้องดู Hostinger build result และ smoke test เว็บไซต์ จึงจะยืนยัน deploy สำเร็จได้

คำสั่งจากโปรเจคสำหรับ Node hosting คือ `npm run build` และ `npm start` (bind 0.0.0.0:${PORT:-3000}) ไม่มี output export/standalone ใน next.config.ts ต้องมี Node server เพื่อให้ API extraction ทำงาน ยังไม่ยืนยันคำสั่งจริงที่ตั้งใน Hostinger dashboard

Git checkout ใหม่ **ไม่ได้รับ .env.hostinger/.env.local/public config JSON** และ npm run build ไม่เรียก zip script ต้องมี Firebase public env และ OPENAI_API_KEY บน host ตาม flow นี้ อย่าแก้โดย commit secret

## วิธี ZIP เดิม

scripts/zip-hostinger.mjs:

1. อ่าน .env.hostinger ต้องมี Firebase apiKey/projectId
2. สร้าง public/firebase-config.json จาก Firebase public fields เท่านั้น
3. สร้าง .env.production จาก env เดิม ตัด comment/บรรทัดว่าง/NGROK_* ออก
4. zip repository เป็น bill-calculation-hostinger.zip โดย exclude node_modules, .next, .git, .env.local, .env.hostinger, .env.example, ZIP, .DS_Store, coverage
5. finally ลบ .env.production และ public/firebase-config.json หลัง pack ไม่เก็บสำรองไฟล์เดิม

ZIP อาจมี OPENAI_API_KEY ภายใน .env.production จึงเป็น deploy artifact ที่มี secret ไม่ใช่ไฟล์แจกสาธารณะ สคริปต์ไม่ build หรือ deploy ให้และไม่อยู่ใน npm run build ของ Git deployment รอบนี้ไม่ได้รัน ZIP script

## Firebase rules เป็น deployment แยก

firebase.json อ้างถึง firestore.rules, firestore.indexes.json, storage.rules; .firebaserc กำหนด project alias ต้องตรวจ target ก่อน deploy จริง

```bash
npm run deploy:firebase-rules
```

คำสั่งนี้ใช้ firebase deploy --only firestore:rules,storage จึง **ไม่รวม indexes** การ push ไป Hostinger ไม่ได้รัน Firebase rules deploy โดยอัตโนมัติจาก scripts ใน repository Composite index ที่เก็บไว้ยังไม่จำเป็นต่อ owner list query ปัจจุบัน
