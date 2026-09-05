# คู่มือสำหรับแก้ไข SplitBill

> ปรับปรุง 2026-09-05: อ่าน [ภาษาและ PWA — พฤติกรรมปัจจุบัน](LANGUAGE_AND_PWA.md) ประกอบ โดยหัวข้อภาษา, image decode, upload/extraction, Firebase hydration และ service worker ในบันทึกใหม่นี้แทนรายละเอียด baseline เดิม

สำรวจจาก source วันที่ **2026-09-05**, baseline `6a9558a` เอกสารอธิบายพฤติกรรมที่มีอยู่ แยกจากข้อเสนอในอนาคต ไม่ได้ยืนยันว่า rules หรือ env บน Firebase/Hostinger ตรงกับไฟล์ในเครื่อง

| งาน | อ่านก่อน |
| --- | --- |
| เริ่มงานครั้งแรก | [Architecture](ARCHITECTURE.md) แล้ว [Maintenance](MAINTENANCE.md) |
| แก้ setup / room / summary | [Architecture](ARCHITECTURE.md) และ [Data](DATA_AND_CALCULATIONS.md) |
| ยอดหาร / จำนวน / ภาษี | [Data](DATA_AND_CALCULATIONS.md) และ [Known issues](KNOWN_ISSUES.md) |
| อ่านใบเสร็จ / upload | [Receipt](RECEIPT_EXTRACTION.md) และ [Configuration](CONFIG_AND_DEPLOYMENT.md) |
| Guest เลือกแล้ว error | [Known issues K01–K02](KNOWN_ISSUES.md) และ [Data](DATA_AND_CALCULATIONS.md) |
| QR / notification / PWA | [Architecture](ARCHITECTURE.md) และ [Data](DATA_AND_CALCULATIONS.md) |
| push / build / deploy | [Configuration](CONFIG_AND_DEPLOYMENT.md) และ [Verification](VERIFICATION.md) |

ใช้ path และชื่อฟังก์ชันเพื่อค้นหา source โดยตรง เช่น `rg -n 'finalizeBill' app lib` ไม่จำเป็นต้องอ่านทั้ง repository ซ้ำ แต่ source เป็นข้ออ้างอิงสุดท้ายหากเอกสารไม่ตรงกับโค้ด

## ข้อเท็จจริงสำคัญ

- `price` เป็นยอดรวมแถว ไม่ต้องคูณ `qty` อีก
- Upload ปัจจุบันใช้ OpenAI จริง ไม่มี fallback ไป mock OCR
- VAT/service charge จาก extraction ยังไม่ถูกนำไปคิดยอดหาร
- Summary คำนวณจาก collections ปัจจุบัน ไม่ใช่ snapshot ยอดตอน finalize
- Guest ใช้ participant ID ใน localStorage ไม่มี Firebase identity ของตน
- UI guard กับ Firestore/Storage rules ไม่เหมือนกันทุกจุด อ่าน known issues ก่อนแก้สิทธิ์
- Push main กระตุ้น Hostinger build ตามข้อมูลผู้ใช้ รอบแก้ภาษา/PWA ได้รับอนุญาตให้ push
