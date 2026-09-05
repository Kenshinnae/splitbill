# ประเด็นที่พบจากการสำรวจ

> ปรับปรุง 2026-09-05: อ่าน [ภาษาและ PWA — พฤติกรรมปัจจุบัน](LANGUAGE_AND_PWA.md) ประกอบ โดยหัวข้อภาษา, image decode, upload/extraction, Firebase hydration และ service worker ในบันทึกใหม่นี้แทนรายละเอียด baseline เดิม

วันที่ 2026-09-05 baseline `6a9558a` รายการนี้เป็นข้อสังเกตจาก source ไม่ใช่ผลทดสอบ production รายการ K01–K10 ยังไม่ได้แก้; K11/K12 ปรับบางส่วนแล้วตาม LANGUAGE_AND_PWA.md

## K01 — Guest write สำเร็จบางส่วนแต่รายงาน error

หลักฐาน: lib/bill-service.ts :: addParticipant/addGuestParticipant, setSelection/setClaimedQuantity, setParticipantDone เขียน document ย่อยก่อน แล้ว await updateDoc ของ bill.updatedAt; firebase/firestore.rules อนุญาต guest เขียนข้อมูลย่อยเมื่อ active แต่ update bill ได้เฉพาะ owner

ผลตาม rules ใน repository: guest อาจมีชื่อ/selection/done ถูกบันทึกแล้วแต่ promise reject ที่ขั้นสุดท้าย UI แสดง error การ joinWithNewName จะไม่ถึง joinAs จึงอาจกดซ้ำและได้ชื่อซ้ำ ควรแยกนโยบาย touch bill และทดสอบ unauthenticated guest ใน emulator เมื่อแก้ ไม่ควรเปิดให้ guest update bill ทุก field เพื่อแก้ทางลัด

## K02 — Guest single payer batch ถูกปฏิเสธทั้งชุด

assignSingleItem รวมเปลี่ยน selections และ update bill.updatedAt ไว้ใน batch เดียว guest ไม่มีสิทธิ์ update bill จึงตาม rules นี้ batch จะ fail ทั้งหมด ต่างจาก K01 ที่ partial success ตรวจด้วย guest session เมื่อแก้

## K03 — ยอดท้ายใบเสร็จไม่ถูกนำมาหาร

receipt-extraction-schema ตัด VAT/service/discount/total จาก items API ส่ง metadata เหล่านี้กลับ แต่ app/bills/new ใช้เฉพาะ items/merchant_name และ model ไม่มี field สำหรับ charges ดังนั้นยอดแสดงอาจน้อยกว่ายอดใบเสร็จจริง ต้องกำหนดนโยบายการกระจายภาษี/ค่าบริการก่อนเพิ่ม logic

## K04 — Draft/Storage เปิดกว้างกว่าหน้าจอ

canReadBillDoc/canReadBill อนุญาต draft และทุกสถานะที่รองรับแม้ไม่มี auth; Not shared yet เป็นเพียง UI barrier ไม่ใช่การซ่อนข้อมูลในฐานข้อมูล Storage bills/** อนุญาต authenticated user คนใดก็ได้เขียน/ลบ ไม่ตรวจ owner รวม path owner QR

Guest participant/selection ไม่มี identity binding หรือ field validation จึงแก้ข้อมูลของ participant คนอื่นใน active bill ได้ตาม rules ไม่ควรเรียกว่า private draft หรือ participant ownership จนกว่าจะมีการเปลี่ยน rules และ flow ที่เกี่ยวข้อง

## K05 — Finalize ยังไม่ใช่ snapshot ที่แก้ไม่ได้

allDone อยู่ใน UI; finalizeBill/rules ไม่ตรวจเงื่อนไขนี้ ไม่บังคับว่าทุกรายการ assigned และ owner ยังแก้ items/participants ได้ตาม rules Summary คำนวณจากข้อมูลสดจึงเปลี่ยนได้หลัง finalize ไม่ได้เก็บ totals snapshot

participant ยังเลือกของหลัง done ได้และไม่ reset done; หากต้องการ lock จริงต้องออกแบบ transaction/rules และสถานะร่วมกัน ขณะนี้ closed เป็น read compatibility ไม่มี writer

## K06 — ลบข้อมูลมากไม่ได้แบ่ง batch จริง

deleteCollectionDocs มี comment ว่า chunk แต่ getDocs ดึงทั้ง collection แล้วใส่ทุก doc ใน batch ไม่มี limit/chunk การวนซ้ำและเงื่อนไข size<400 ไม่ช่วยจำกัดขนาด batch จึงเสี่ยงเกินขีดจำกัดที่โค้ดตั้งใจรองรับ บิลอาจถูกลบบาง collections แล้วล้มเหลว

replaceItemsFromParsed/deleteBillItem/removeParticipant/clearSelectionsForItem ก็ไม่มี chunk สำหรับ operation จำนวนมาก Storage cleanup กลืน error และ listAll เฉพาะ items ใน folder ไม่ recurse prefixes ทำให้มี orphan files ได้

## K07 — เศษสตางค์ / quantity / unassigned

สูตรใช้ floating point และ round เฉพาะตอนแสดง ไม่แจกเศษให้ยอดรายคนรวมตรงกับบิล เช่น 100/3; quantity คิดตาม units ที่ claim จริง ไม่บังคับรวมเท่ากับ qty ในใบเสร็จ; single มี selected หลายคนถูกตัดออกจากยอดทั้งหมด

assignedItemsCount ไม่นับแถวฟรีเพราะ share=0; ข้อความ footer summary ยังกล่าวถึง equal split อย่างเดียวแม้รองรับ 3 modes จุดเหล่านี้อาจเป็นพฤติกรรมที่ตั้งใจ ต้องคุย requirement ก่อนเปลี่ยนสูตร

## K08 — Guest identity และ realtime readiness

joinedId จาก localStorage ไม่ตรวจว่า participant ยังอยู่ก่อนตัดสิน showJoin ถ้า ID เก่าถูกลบ อาจไม่มี me และไม่แสดงหน้าเลือกชื่อใหม่ ไม่มี UI switch identity โดยตรง

useRealtimeBill loading จบเมื่อ bill snapshot ตอบ ไม่รอทุก subcollection; เปลี่ยน billId ที่มีค่าแล้วไม่ clear arrays เดิมทันที จึงอาจมีข้อมูลช่วงเปลี่ยนผ่าน Timer เฝ้า bill document เท่านั้น

## K09 — Draft/selection concurrency และ replace

create draft effect มี cancellation guard เฉพาะ UI ไม่ยกเลิก write จึงมีความเสี่ยง orphan draft เมื่อ effect ถูกเรียกซ้ำ/unmount ก่อน redirect โดยยังไม่ได้ reproduce

assignSingleItem read แล้ว batch write ไม่ใช่ transaction; concurrent claims อาจเหลือหลาย assignees แล้วสูตรถือว่า unassigned เปลี่ยน mode ล้าง selections และเปลี่ยน mode คนละ commit ส่วน replaceItemsFromParsed ไม่ cleanup selections ของ item ID เก่า

## K10 — QR และ notification ไม่ได้เป็น snapshot/preference สมบูรณ์

finalize คัดลอก URL แต่ไฟล์ QR อยู่ path คงที่ร่วมทุกบิล การ overwrite/delete QR อาจกระทบภาพในบิลเก่า ไม่ได้สำเนารูปถาวรต่อบิล

notifyEnabled ถูก save แต่ room ไม่อ่าน; sessionStorage mark ก่อนทราบว่า notification แสดงจริง; ถ้า service worker ไม่ active navigator.serviceWorker.ready อาจรอโดยไม่ fallback จนกว่าจะ reject ระบบนี้ไม่มี remote push เมื่อปิดแอป

## K11 — Extraction validation / coverage

เพิ่ม outer catch และ fetch timeouts แล้ว; หลัง JSON.parse cast type ไม่มี full schema validation; mapper อาจ throw ถ้า items/notes ไม่ใช่ array และไม่มี finite-number checks ครบ API ตรวจ Firebase user แต่ไม่มี bill ownership หรือ rate limiter ในแอป

เพิ่ม HTMLImageElement fallback และแจ้งให้แปลง HEIC เป็น JPEG หากยัง decode ไม่ได้ Parser tests เดิมไม่ครอบคลุม extraction route/mapper/real image flow

## K12 — Config ของ Git deployment ต่างจาก ZIP

.env.example ถูก ignore และยังไม่ track; git clone ไม่ได้ env หรือ public config ที่ ZIP สร้าง Server extraction เปลี่ยนใช้ public-config resolver แล้ว และแก้ initial ready ของ FirebaseConfigGate ให้ตรงกันระหว่าง SSR/hydration; ไฟล์ config เก่ามี precedence เหนือ env ส่วน ZIP script ลบไฟล์ config ที่สร้างทิ้งโดยไม่ restore ของเดิม

README เดิมอธิบาย mock OCR, owner-only active/completed guest reads และ redirect หน้าแรกไม่ตรงกับ source รอบนี้ปรับเอกสารให้ตรงแล้ว แต่ยังไม่ได้เปลี่ยน application code
