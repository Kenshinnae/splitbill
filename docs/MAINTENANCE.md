# คู่มือเลือกไฟล์และตรวจการแก้ไข

> ปรับปรุง 2026-09-05: อ่าน [ภาษาและ PWA — พฤติกรรมปัจจุบัน](LANGUAGE_AND_PWA.md) ประกอบ โดยหัวข้อภาษา, image decode, upload/extraction, Firebase hydration และ service worker ในบันทึกใหม่นี้แทนรายละเอียด baseline เดิม

อ่าน [สารบัญ](README.md) และหัวข้อที่เกี่ยวข้องก่อน แล้วเปิด source เฉพาะส่วนที่จะเปลี่ยน ไม่ควรถือว่า Markdown ใช้แทน source ได้ตลอดโดยไม่อัปเดต

## Change map

| ต้องการแก้ | จุดเริ่มต้น | ส่วนที่ต้องตรวจร่วม |
| --- | --- | --- |
| Landing/login | app/page.tsx, app/login/page.tsx | useAuth, OwnerGuard |
| Dashboard/list order | app/dashboard/page.tsx, useOwnerBills | billsForOwnerQuery, sortBillsByUpdatedAtDesc |
| Create draft / edit items | app/bills/new/page.tsx | bill-service, types, rules |
| Upload/extraction | receipt-image, extract-receipt-client, API route | schema, mapper, onUpload; ไม่ใช่ mock-ocr |
| Split mode / quantity | lib/calculations.ts, types/index.ts | editor, room, bill-service, tests, rules |
| Guest join / done / selection | app/bill/[billId]/page.tsx | service + rules; K01/K02 |
| Finalize | room onFinalize, service finalizeBill | summary, rules, unassigned/allDone policy |
| Summary / formatting | summary page, calculations, currency | editor vs assigned totals, rounding |
| Payment QR | settings, receipt-image, service upload/clear | finalizeBill, summary, Storage rules |
| Notification | lib/notify.ts, room allDone effect | settings, PwaRegister, public/sw.js |
| Logo/PWA | lib/pwa-icon.tsx, manifest, icon routes | layout metadata, app/favicon.ico, sw |
| Shared style | AppShell, globals.css | Tailwind classes ในแต่ละหน้า, mobile footer |
| Firebase initialization | firebase-public-config/server-config/bootstrap-script, firebase.ts | layout, FirebaseConfigGate, public-config route, Hostinger env |
| Delete bill | DeleteBillButton, bill-service deleteBill | subcollection cleanup, Storage rules, large batches |
| Error messages | firebase-client-errors.ts, localErr ของแต่ละหน้า | partial success ของ service |

Paths ย่อที่ไม่ระบุ folder: hooks อยู่ hooks/, components อยู่ components/, helpers อยู่ lib/ รายละเอียด path เต็มใน Architecture/Data/Receipt

## Workflow

1. อ่าน AGENTS.md, git status, เอกสารที่ตรงกับงาน และ Known issues
2. อ่านคู่มือ Next.js เวอร์ชันที่ติดตั้งก่อนเขียนโค้ดตาม AGENTS.md; ใช้ rg --files node_modules/next/dist/docs เพื่อหาหัวข้อ routing, server/client components, environment variables ที่เกี่ยวข้อง
3. รักษางานที่มีอยู่ใน working tree เปิด source เฉพาะส่วนที่จะแก้ ตรวจ type/consumer/rules คู่กัน
4. แก้ในขอบเขตที่ผู้ใช้ขอ ไม่รวมการแก้ known issues อื่นหรือ upgrade dependency โดยอัตโนมัติ
5. ตรวจตามความเสี่ยงของงาน ใช้ tests ที่ตรวจพฤติกรรมจริง ไม่เขียน test ที่ลอก implementation หรือเพิ่มให้การเปลี่ยนข้อความเล็กน้อยโดยไม่จำเป็น
6. อัปเดตเอกสารที่เปลี่ยนพฤติกรรม/fields/route/env และสถานะ issue ให้ตรง พร้อมลงผลตรวจใน Verification
7. ตรวจ diff และไฟล์ที่กำลังจะ commit ก่อน publish; push เมื่ออยู่ในขอบเขตที่ผู้ใช้สั่ง deploy เพราะ Hostinger build ทันที

## Validation ตามงาน

| Change | ตรวจอะไร |
| --- | --- |
| เอกสารอย่างเดียว | Internal links, source names, git diff --check, ไม่มี application diff |
| Type/service/UI | npm run lint, tsc, npm run build ตามขอบเขต |
| สูตรหาร | npm test; shared/quantity/single, unassigned, legacy mode, stale IDs, rounding policy |
| Guest/rules | Firebase emulator tests หรือแยก test project; owner กับ unauthenticated guest, active/draft/completed, multi-client concurrency |
| Receipt | Route/mapper tests สำหรับ invalid form/token/size/response/error; ภาพจริงเมื่อได้รับ scope ให้เรียก external API |
| QR | Upload/replace/remove และ summary ของบิลเก่า/ใหม่ |
| PWA | Browser install/permission/SW registration; notification ขณะ room เปิด; ไม่อ้างว่ารองรับ offline |

## Manual smoke flow สำหรับรอบแก้ฟังก์ชัน

ใช้ test Firebase project/account และรูปทดสอบ เพราะ flow นี้สร้าง/แก้/ลบข้อมูลและ OCR เรียก API ที่มีค่าใช้จ่าย:

1. Owner login → dashboard → create draft ใส่ 3 items อย่างละ mode และ 2 participants
2. ตรวจ autosave on blur, qty ไม่คูณ price, สลับ mode แล้ว selections เดิมถูกล้าง
3. Start sharing แล้วเปิด guest แยก browser context เพื่อไม่ใช้ owner auth เดิม
4. เลือกชื่อ/เพิ่มชื่อ, กด shared, quantity, single ตรวจยอดเปลี่ยนทั้งสองหน้าต่างและ error ของ K01/K02
5. กด done ทุกคน ตรวจ finalize ปลดล็อก และ unassigned behavior ตาม requirement
6. Finalize ตรวจ guest redirect, group total, QR และ guest แก้ selections ต่อไม่ได้
7. Settings QR/notification ตรวจอุปกรณ์ที่รองรับ ถ้าแก้ deletion ให้ลบบิลทดสอบและตรวจ subcollections/Storage

## ดูแลเอกสารให้ไม่ล้าสมัย

- Route/UI/component flow → ARCHITECTURE.md
- Schema/service/rules/calculation → DATA_AND_CALCULATIONS.md
- OCR/model/default/error contract → RECEIPT_EXTRACTION.md
- Env/scripts/hosting → CONFIG_AND_DEPLOYMENT.md
- ประเด็นที่แก้แล้ว → KNOWN_ISSUES.md พร้อมหลักฐานตรวจ ไม่ลบเพียงเพราะเปลี่ยน UI
- คำสั่งและผลตรวจจริง → VERIFICATION.md
- Entry points/ภาพรวม → README.md และ docs/README.md

ไม่ใส่ secret, token, receipt ของผู้ใช้ หรือ payment QR จริงลง docs ไม่ต้องแก้ remote หรือสร้าง branch ใหม่เพียงเพื่ออ่านโปรเจค
