<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SplitBill project guide

- เริ่มจาก [docs/README.md](docs/README.md) แล้วอ่านเฉพาะเอกสารหัวข้อที่จะเปลี่ยน ใช้ path/function map เพื่อตรวจ source ที่เกี่ยวข้อง ไม่ต้องสำรวจทั้งโปรเจคซ้ำ
- อ่าน [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) ก่อนแก้ guest writes, calculations, finalize, QR หรือ Firebase configuration
- Source เป็นข้ออ้างอิงสุดท้ายเมื่อเอกสารไม่ตรงกับโค้ด เมื่อเปลี่ยนพฤติกรรม ให้ปรับเอกสารที่เกี่ยวข้องและบันทึกผลตรวจจริงตาม [docs/MAINTENANCE.md](docs/MAINTENANCE.md)
- Repository คือ `https://github.com/Kenshinnae/splitbill.git` และ branch หลัก `main`; checkout ที่สำรวจตั้ง origin ถูกต้องแล้ว ไม่ต้อง add remote ซ้ำ
- ผู้ใช้แจ้งว่า push จะทำให้ Hostinger build ใหม่ทันที ถือเป็น deploy step ทำเมื่ออยู่ในขอบเขตงานที่ผู้ใช้สั่ง ดู [docs/CONFIG_AND_DEPLOYMENT.md](docs/CONFIG_AND_DEPLOYMENT.md)
- การสำรวจเดิมไม่ได้ deploy; คำขอถัดมาอนุญาตให้เพิ่มไทย/อังกฤษ แก้ PWA upload และ push ได้ โดยไม่ได้ขอ deploy Firebase rules
- ระบบภาษาและรูปปัจจุบัน: [docs/LANGUAGE_AND_PWA.md](docs/LANGUAGE_AND_PWA.md); ใช้ useI18n และ translation dictionary สำหรับข้อความ UI ไม่แปลข้อมูลที่ผู้ใช้กรอก
