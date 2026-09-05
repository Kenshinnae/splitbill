# ภาษาและ PWA — พฤติกรรมปัจจุบัน

ปรับปรุง 2026-09-05 หลังการสำรวจ baseline `6a9558a` ผู้ใช้ขอภาษาไทย/อังกฤษและรายงานว่า PWA บน **iPhone เลือกรูปจากคลังแล้วอัปโหลด/อ่านบิลไม่สำเร็จ** พร้อมอนุญาตให้ push หลังแก้

หัวข้อนี้แทนคำอธิบายเก่าใน baseline ที่ยังระบุ English-only, bitmap-only, รอ Storage ก่อน OCR, server token verification อ่าน env อย่างเดียว หรือ service worker ดักทุก request

## ภาษาและฟอนต์

| ไฟล์ | หน้าที่ |
| --- | --- |
| `components/LanguageProvider.tsx` | React context, useI18n, LanguageSwitch ไทย/EN, ค่าเริ่มต้น th |
| `lib/i18n.ts` | translate(language, message, values), interpolation และ Language type |
| `lib/translations.ts` | English message → คำแปลไทย; ใช้ข้อความเดิมเป็น key |
| `app/layout.tsx` | ครอบ LanguageProvider และวาง switch ก่อน FirebaseConfigGate เพื่อให้ใช้ได้แม้ config โหลดไม่ได้ |
| `app/globals.css` | ฟอนต์, line height ไทย, input ขนาด 16px บนมือถือ |
| `public/fonts/NotoSansThaiLooped.ttf`, `OFL.txt` | Google Font และใบอนุญาต ใช้ next/font/local |

ภาษาเก็บใน localStorage `splitbill_language`; storage ใช้ไม่ได้ยังสลับใน session ได้ ฟัง storage event เพื่อ sync tab และอัปเดต html lang ไม่มี locale prefix ใน URL จึงใช้ share link เดิมได้ สลับภาษาไม่ reload หรือ remount หน้าบิลและไม่เปลี่ยนข้อมูลในฟอร์ม

แปล labels, placeholders, headings, progress/counts, confirms, known errors และ local notification ใช้ `t("ข้อความอังกฤษ", { count: ... })` สำหรับข้อความมีตัวแปร ไม่แปลชื่อร้าน รายการ บิล หรือ participant ที่ผู้ใช้กรอก ชื่อเริ่มต้นในฐานข้อมูลยังเป็น New bill/Untitled bill และยอดยังเป็น THB

ฟอนต์มาจาก [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/notosansthailooped) แบบ variable font มีใบอนุญาต OFL โหลดจากโดเมนแอป ไม่ต้องดาวน์โหลดฟอนต์จาก Google ระหว่าง build หรือขณะใช้งาน

## Firebase hydration

`FirebaseConfigGate` เริ่ม ready=false ทั้ง SSR และ browser แล้วค่อย resolve config ใน effect เดิม browser อาจมี config จาก head script และ render children ทันที ขณะที่ SSR render loading ทำให้ hydration mismatch ซึ่งพบจริงระหว่างตรวจ browser รอบนี้

API extraction ตรวจ token ผ่าน Identity Toolkit เช่นเดิม แต่เลือก Firebase web API key ผ่าน `resolveFirebasePublicConfigForServer` เพื่อให้ใช้ config จาก JSON แบบเดียวกับ public-config route ได้ด้วย ยังไม่เปลี่ยน auth model หรือ rules

## รูปจากคลัง iPhone

`lib/receipt-image.ts` ลอง createImageBitmap ก่อน ถ้าไม่มีหรือ throw ให้ลอง HTMLImageElement/object URL รองรับ WebKit ที่เปิดรูปผ่านสองเส้นทางได้ต่างกัน แปลง JPEG ด้วย canvas, พื้นขาว, ไม่ upscale และ release bitmap/object URL/canvas หลังเสร็จ

- Receipt: ขอบยาวไม่เกิน 2048px, quality 0.85
- QR: ขอบยาวไม่เกิน 1200px, quality 0.92
- หากทั้งสอง decode ไม่ได้แต่เป็น JPEG/PNG/WebP ขนาดไม่เกิน 15 MiB ให้ใช้ไฟล์เดิมได้
- HEIC ที่ decode ไม่ได้จะแสดงให้แปลง JPEG หรือใช้ภาพหน้าจอ ไม่เปลี่ยน extension หลอกเป็น JPEG
- ไม่ได้เพิ่ม HEIC decoder แยก จึงไม่ได้รับประกันการเปิด HEIC ทุกชนิดบน iOS ทุกเวอร์ชัน

## Upload และอ่านรายการ

`app/bills/new/page.tsx::onUpload` normalize แล้วเริ่มสองงานผ่าน Promise.allSettled:

1. Upload รูปและ setBillImageUrl
2. Extract → replaceItemsFromParsed → merchant title

การอ่านรายการไม่ถูกขวางเมื่อ Storage ล้มเหลว มีข้อความแยกผลรูป/การอ่าน เก็บ File ที่ normalize แล้วใน React state สำหรับปุ่ม Read receipt again ซึ่งอ่านซ้ำโดยไม่ upload รูปซ้ำ หาก OS ปิดหน้า/ผู้ใช้ reload จะต้องเลือกรูปใหม่ ไม่ได้อ้างว่า request ทำงานต่อเมื่อ iOS suspend แอป

มี ref lock กันการเริ่มซ้ำและ disabled fieldset ระหว่างทำงาน ป้องกันแก้ item/start sharing/delete ขณะที่ OCR ยังเขียนรายการ ทั้ง receipt และ QR input reset value หลังเลือก จึงเลือกรูปเดิมซ้ำได้

`lib/bill-service.ts` ใช้ uploadBytesResumable และ cancel หลัง 30 วินาทีต่อ attempt คง refresh token/retry policy เดิมสูงสุด 3 attempts; เลิกเปลี่ยนชื่อ HEIC เป็น JPEG ใน service

`lib/extract-receipt-client.ts` ตรวจ offline, ส่ง multipart image/idToken แบบ no-store, timeout 115 วินาที หาก HTTP 401 ให้ refresh token และลอง 1 ครั้ง ไม่ auto-retry network/5xx ที่อาจประมวลผลหรือคิดค่า API ไปแล้ว รองรับ host error ที่ไม่ใช่ JSON และ HTTP 413

Server: Identity Toolkit timeout 15 วินาที, OpenAI fetch timeout 90 วินาที, outer catch คืน JSON 504 เมื่อ timeout หรือ 502 สำหรับ failure อื่น คง model/schema/price semantics เดิม export maxDuration=120 เป็น declaration ไม่ได้ยืนยัน actual Hostinger timeout

## Service worker

`public/sw.js` ไม่ดัก fetch แล้ว ให้ browser จัดการ upload/API/network โดยตรง ยังคง install/activate และ local notification click; ไม่มี offline cache หรือ remote push

`PwaRegister` register ด้วย updateViaCache=none และเรียก registration.update เพื่อรับ worker ใหม่ เมื่อ deploy แล้วเปิด PWA ขณะออนไลน์ให้ worker อัปเดต หากเปิดเวอร์ชันเก่าค้างอยู่ให้ปิดแล้วเปิดอีกครั้ง

## หลักฐานการตรวจและข้อจำกัด

- Tests 27 เคสผ่าน: 17 เดิม + 3 ภาษา/interpolation + 4 client recovery + 3 image fallback/resource cleanup
- Lint และ TypeScript ผ่าน; production build ผ่าน มีคำเตือน tracing จาก fallback path ของ firebase-server-config ที่มีอยู่เดิม
- ตรวจ browser หน้าแรกและ login ทั้งไทย/อังกฤษ, จำภาษาหลัง reload, คง email ที่กรอกเมื่อสลับภาษา, html lang, computed font, console ไม่มี errors ใน session หลังแก้ hydration
- ทดสอบ viewport 390×844 ไม่มี horizontal overflow เป็นการตรวจ layout ไม่ใช่การจำลอง iOS photo picker
- ยังไม่ได้ทดสอบติดตั้ง PWA และเลือกรูปจากคลังบน iPhone จริง หรือเรียก OCR ด้วยบัญชี/รูปจริง ไม่ได้สร้างบิล production เพื่อทดสอบ
- Dependencies ใน workspace เดิมมีไฟล์ macOS compressed/dataless ทำให้ lint/build ค้าง จึง npm ci ตาม lockfile ใน `/private/tmp/splitbill-validation` และคัดลอก source ชุดเดียวกันเพื่อตรวจ โดยไม่ใช้ env/secret จริง (browser UI ใช้ public Firebase config จำลองใน temp เท่านั้น)
- ไม่มี Firebase rules deploy หรือ dependency/model upgrade ในการแก้ครั้งนี้

หลักฐานอ้างอิง API ที่อ่านประกอบ: [MDN HTMLImageElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode), [MDN Service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), คู่มือ Next.js ที่ติดตั้งเรื่อง fonts และ internationalization
