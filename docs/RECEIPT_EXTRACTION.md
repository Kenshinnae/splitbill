# การอ่านใบเสร็จ

> ปรับปรุง 2026-09-05: อ่าน [ภาษาและ PWA — พฤติกรรมปัจจุบัน](LANGUAGE_AND_PWA.md) ประกอบ โดยหัวข้อภาษา, image decode, upload/extraction, Firebase hydration และ service worker ในบันทึกใหม่นี้แทนรายละเอียด baseline เดิม

Baseline `6a9558a` ณ 2026-09-05 อธิบาย implementation ใน repository ไม่ได้ยืนยัน availability ของ model หรือเรียก API จริงในการสำรวจนี้

## เส้นทางที่ใช้งานจริง

```text
app/bills/new/page.tsx :: onUpload
  normalizeReceiptImage(file)
  uploadBillReceiptImage(billId, ready)
  setBillImageUrl(billId, url)
  extractReceiptViaOpenAI(ready, user)
    user.getIdToken()
    POST /api/extract-receipt multipart { image, idToken }
      verifyFirebaseIdToken → Identity Toolkit accounts:lookup
      OpenAI /v1/responses → JSON schema output
      mapExtractionToParsedLineItems
  replaceItemsFromParsed (เมื่อ items ไม่ว่าง)
  updateBillTitle จาก merchant_name เมื่อชื่อยังเป็นค่าเริ่มต้น
```

Upload ไป Storage ก่อน extraction ถ้าอ่านไม่สำเร็จรูปยังถูกเก็บและแก้รายการเองได้ ถ้า extract ไม่มีรายการจะแจ้งให้กรอกเองและไม่ลบรายการเดิม ถ้ามีรายการจะ **แทน items เดิมทั้งชุด** ไม่ merge โดยใช้ ID ใหม่และ default splitMode shared

## File map

| Source | หน้าที่ |
| --- | --- |
| app/bills/new/page.tsx | Orchestrate upload/extract/save/title/error UI |
| lib/receipt-image.ts | Browser createImageBitmap + canvas → JPEG |
| lib/bill-service.ts | Storage upload/retry และ Firestore writes |
| lib/extract-receipt-client.ts | multipart request, response coercion, รวม error+detail |
| app/api/extract-receipt/route.ts | Token validation, image limit, OpenAI request, decode/error handling |
| lib/receipt-extraction-schema.ts | RECEIPT_EXTRACTION_JSON_SCHEMA และ RECEIPT_VISION_INSTRUCTIONS |
| lib/map-extraction-to-parsed-items.ts | Raw extraction types และ mapper |

## Image normalization

Receipt จำกัดขอบยาว 2048px, JPEG quality 0.85; QR 1200px, quality 0.92 ไม่ upscale และเปลี่ยนชื่อเป็น .jpg ถ้า createImageBitmap/context/blob ใช้ไม่ได้หรือ decode ล้มเหลว คืนไฟล์ต้นฉบับ จึงไม่ได้รับประกันแปลง HEIC ได้ทุก browser การเปลี่ยน extension ใน upload service ไม่ใช่การแปลงข้อมูลภาพ

## API contract

POST /api/extract-receipt เป็น Node.js runtime, export maxDuration=120 แต่ไม่มี AbortController/timeout ของ fetch เอง และค่า export ไม่ยืนยันว่า Hostinger บังคับ 120 วินาทีจริง

Request เป็น FormData มี image Blob และ idToken string ตรวจ token ด้วย `accounts:lookup` โดยใช้ NEXT_PUBLIC_FIREBASE_API_KEY จาก server env โดยตรง ไม่ใช้ public-config fallback ตรวจเพียง token ของ user ที่ lookup ได้ ไม่ได้รับ billId หรือเช็กเจ้าของบิล

API รับรูปไม่เกิน 15 × 1024 × 1024 bytes หลัง parse multipart; MIME image/* หรือ fallback image/jpeg; ยังไม่มีการ decode ตรวจเนื้อหารูปก่อนส่ง ใช้ Buffer แปลง base64 data URL ส่ง OpenAI ผ่าน native fetch ไม่มี OpenAI SDK dependency

ค่าที่ source ตั้ง:

- model: OPENAI_RECEIPT_MODEL หรือ `gpt-5.6-sol`
- image detail: OPENAI_RECEIPT_IMAGE_DETAIL หรือ original; รับ low/high/auto/original ค่าอื่น fallback original
- reasoning effort: low
- text.format: json_schema ชื่อ receipt_extraction, strict=true

ค่าข้างต้นเป็น defaults ที่พบในโค้ด ไม่ใช่คำแนะนำเปลี่ยน model ก่อนเปลี่ยน API/model ควรตรวจ official documentation และสิทธิ์ของ API project ขณะนั้น

Response สำเร็จ:

```json
{
  "items": [{ "name": "ตัวอย่าง", "price": 120, "qty": 2, "notes": ["ไม่ใส่น้ำแข็ง"] }],
  "merchant_name": "ร้านตัวอย่าง",
  "subtotal": 120,
  "service_charge": 12,
  "vat": 9.24,
  "total": 141.24
}
```

Schema กำหนดทุก property required และ additionalProperties=false; item qty integer >=1, price เป็น line total, notes array Prompt ให้คงชื่อไทย/อังกฤษ, เก็บ add-on ที่มีราคา, แนบ free modifier และตัดหัวบิล/ท้ายบิล/VAT/service charge/ส่วนลด/ยอดรวมออกจาก items

Mapper trim name, ข้ามชื่อว่าง, floor qty และขั้นต่ำ 1, price ขั้นต่ำ 0 และข้าม NaN, trim/filter notes ปัจจุบันยังไม่มี runtime validator สมบูรณ์หลัง JSON.parse และไม่ได้กัน Infinity/malformed arrays ทุกกรณี

**Editor ใช้ items และ merchant_name เท่านั้น** ไม่ persist subtotal/service_charge/vat/total จึงยังไม่ใช้ยอดท้ายบิลคำนวณหรือ reconcile

## Error paths

| HTTP | สาเหตุที่ route คืน JSON โดยตรง |
| --- | --- |
| 503 | OPENAI_API_KEY ไม่ได้ตั้ง |
| 400 | parse form ไม่ได้, ไม่มี Blob, รูปเกิน 15 MiB |
| 401 | ไม่มี token, lookup ไม่ผ่าน, Firebase web key ใน server env ไม่มี หรือ lookup network fail |
| 502 | OpenAI non-OK, response JSON เสีย, structured output หาย, model JSON เสีย |

OpenAI quota/billing และ rate limit มีข้อความเฉพาะ; error อื่นส่ง detail จาก service กลับ client Network exception ของ OpenAI fetch หรือ mapper exception ไม่มี outer catch ครอบ อาจกลายเป็น framework 500; client พยายาม parse JSON แล้ว fallback ข้อความทั่วไป

## Parser รุ่นเดิมที่ยังอยู่

ไม่พบ import จาก app/components/hooks ไป mock/parser pipeline เหล่านี้ใน baseline:

| Source | หน้าที่เดิม |
| --- | --- |
| lib/mock-ocr.ts | SAMPLE_THAI_RECEIPT_OCR, mockExtractReceiptText หน่วง 600ms, mockExtractLineItems |
| lib/receipt-pipeline.ts | parseReceiptHybridText รัน Thai + Western; mergeParsedLineItems dedupe name lowercase + price |
| lib/receipt-parser.ts | Normalize text, strip metadata, trailing price, leading qty, hyphen notes |
| lib/receipt-parse-strategies.ts | Western metadata filtering/parser |
| lib/receipt-meta.ts | Metadata phrases และ regex |
| lib/receipt-parser.test.ts | 13 tests ของ Thai parser ไม่ใช่ tests ของ OpenAI flow |

อย่าแก้ parser แล้วคาดว่าใบเสร็จใน UI จะเปลี่ยน และอย่าลบกลุ่มนี้โดยถือว่าอนุมัติแล้ว รอบนี้เพียงบันทึกสถานะ
