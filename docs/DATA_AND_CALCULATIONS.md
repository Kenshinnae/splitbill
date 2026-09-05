# ข้อมูล สิทธิ์ และสูตรหาร

> ปรับปรุง 2026-09-05: อ่าน [ภาษาและ PWA — พฤติกรรมปัจจุบัน](LANGUAGE_AND_PWA.md) ประกอบ โดยหัวข้อภาษา, image decode, upload/extraction, Firebase hydration และ service worker ในบันทึกใหม่นี้แทนรายละเอียด baseline เดิม

Source: types/index.ts, lib/bill-service.ts, lib/calculations.ts, hooks/, firebase/ ณ baseline `6a9558a`

## Firestore model

id ของ bill/item/participant/selection ได้จาก document ID ตอนอ่าน ไม่อยู่ใน payload create; timestamps เขียน serverTimestamp() และ type รองรับ null ระหว่างรอค่า

| Path | Fields |
| --- | --- |
| users/{uid} | uid, email, role: owner, optional displayName/paymentQrUrl/notifyEnabled; service เขียน updatedAt แม้ยังไม่มีใน UserProfile type |
| bills/{billId} | ownerId, title, imageUrl string/null, status, createdAt, updatedAt, finalizedAt Timestamp/null, optional ownerPaymentQrUrl |
| bills/{billId}/items/{itemId} | name, price, optional qty/notes:string[]/splitMode, createdAt, updatedAt |
| bills/{billId}/participants/{participantId} | name, isDone, joinedAt, updatedAt |
| bills/{billId}/selections/{itemId}__{participantId} | itemId, participantId, selected, optional claimedQty, updatedAt |
| bills/{billId}/activity/{docId} | มี rules และ cleanup แต่ยังไม่มี writer/model ในแอป |

ชื่อ participant ไม่ unique ไม่มี auth UID ผูก participant; role ใน profile ไม่ใช่ custom claim และ rules ไม่ได้ตรวจ field นี้

## Lifecycle

`createDraftBill → draft → startSharing → active → finalizeBill → completed`

closed รองรับการอ่านแบบ finalized แต่ไม่มี action เขียนค่านี้ ไม่มี UI เปิดบิลกลับ สถานะเหล่านี้เป็น flow UI ไม่ใช่ transition constraint ของ rules

finalizeBill อ่าน bill → ลองอ่าน profile owner → คัดลอก QR URL ถ้ามี → เขียน completed, finalizedAt, updatedAt, ownerPaymentQrUrl ไม่เขียนยอดรวมและไม่ตรวจ allDone ใน service/rules เงื่อนไขทุกคน done อยู่ใน room UI เท่านั้น

## สูตรคำนวณ

**price คือยอดรวมแถว** 4 เครื่องดื่มรวม 440 บาท เก็บ qty=4, price=440 อย่าคูณ qty ซ้ำ qty เป็นข้อมูลประกอบ ไม่ได้จำกัดจำนวน units ที่ผู้ร่วมรับ

| Mode | สูตรต่อผู้ร่วม | ตัวอย่าง |
| --- | --- | --- |
| shared (default เมื่อไม่มี mode) | ราคาแถว / จำนวน participants ที่ selected=true | 120 บาท เลือก 3 คน → คนละ 40 |
| quantity | ราคาแถว × units คนนี้ / ผลรวม units | 120 บาท A รับ 2 B รับ 1 → 80 และ 40 |
| single | เต็มราคาเมื่อมีผู้ selected เพียง 1 คน | 120 บาท A คนเดียว → 120 |

คำนวณเฉพาะ participants ที่ยังอยู่; selection ของ ID ที่ไม่มี participant ไม่นับ claimedQty ตัดเศษลง ไม่ติดลบ undefined/NaN เป็น 0; quantity ใช้ claimedQty โดยไม่ดู selected

shared ไม่มีคนเลือก, quantity units รวมเป็น 0 หรือ single มีคนเลือก 0/มากกว่า 1 คน = **unassigned ไม่รวมยอด** ไม่หารให้ทุกคนอัตโนมัติ

| Function | หน้าที่ |
| --- | --- |
| getItemSplitMode | default mode ของ legacy items |
| computeItemAssignments | state, count, units, assignee สำหรับ room |
| computeParticipantTotals | Map participantId → total |
| getParticipantShareForItem | ยอดของคนหนึ่งต่อแถว |
| buildFinalSummary | name, totalOwed, assignedItemsCount นับเฉพาะแถว share > 0 |
| formatMoney | Format THB ด้วย Intl ไม่แจกเศษสตางค์ |

Editor total รวม price ทุก item; Summary group total รวมยอด participant จึงต่างกันได้เมื่อมี unassigned ไม่มี tax/discount/service charge layer และไม่มีการจัดสรรเศษสตางค์ เช่น 100/3 แสดง 33.33 สามคนแต่ group total 100.00

## Service operations ใน lib/bill-service.ts

| กลุ่ม | Functions / ผลข้างเคียง |
| --- | --- |
| Refs | billDocRef, itemsCol, participantsCol, selectionsCol, selectionDocId |
| Profile | ensureUserProfile merge, getUserProfile get, updateOwnerSettings merge |
| Draft | createDraftBill ชื่อ fallback New bill; getBill; updateBillTitle fallback Untitled bill |
| Receipt | uploadBillReceiptImage คืน URL; setBillImageUrl อัปเดตบิลแยก |
| Replace | replaceItemsFromParsed batch ลบ items เดิม/สร้างใหม่ mode shared/touch bill; ไม่ลบ selections เก่า |
| Item CRUD | addBillItem, updateBillItem; deleteBillItem ลบ item ก่อนแล้ว batch cleanup selections/touch bill |
| Participants | addParticipant create แล้ว touch bill; addGuestParticipant alias; removeParticipant delete ก่อน batch cleanup |
| Done | setParticipantDone update participant ก่อน touch bill |
| Shared/units | setSelection merge ID คงที่แล้ว touch bill; setClaimedQuantity normalize แล้ว selected=units>0 |
| Single | assignSingleItem query selections ของ item; batch ปิดของเดิม/เปิด assignee/touch bill |
| Mode | clearSelectionsForItem batch ลบ selections/touch bill; caller ค่อยเปลี่ยน mode |
| State | startSharing, finalizeBill update bill |
| List | billsForOwnerQuery equality-only; sortBillsByUpdatedAtDesc sort copy ใน client |
| Delete | deleteBill ลบ subcollections items/participants/selections/activity → Storage best-effort → bill |

การเขียนที่แยก await ไม่ atomic ถ้า touch bill ล้มเหลวไม่ rollback ข้อมูลย่อย อ่าน [K01–K02](KNOWN_ISSUES.md) ก่อนแก้ guest flow

## Realtime

useRealtimeBill ลงทะเบียน 4 onSnapshot: bill, items orderBy createdAt asc, participants orderBy joinedAt asc, selections ไม่ sort; cleanup เมื่อ billId เปลี่ยน/unmount

loading=false เมื่อ bill ตอบ ไม่ได้รอทุก collection ครบ Timer 28 วินาทีเฝ้า bill snapshot; error แนะนำ browser ภายนอกเมื่อเชื่อมต่อค้าง Firebase init เปิด experimentalAutoDetectLongPolling ไม่มีการ configure offline persistence

useOwnerBills query ownerId เท่านั้นและ sort client จึงไม่ต้องใช้ composite ownerId+updatedAt ที่ยังเก็บใน firebase/firestore.indexes.json

## Rules ตาม repository (ยังไม่ยืนยัน deployed rules)

| Resource | Read | Write |
| --- | --- | --- |
| users | auth UID ตรง path | auth UID ตรง path |
| bill | owner หรือ status draft/active/completed/closed จึงเปิด guest ทุกสถานะที่รองรับ | create ต้อง auth และ ownerId ตรง; update/delete ต้อง owner เดิม |
| items | canReadBill | owner ทุกสถานะ |
| participants | canReadBill | create/update owner หรือ active; delete owner |
| selections | canReadBill | create/update เฉพาะ active ไม่ต้อง auth; delete owner |
| activity | canReadBill | owner |
| Storage bills/{billId}/... | สาธารณะ | authenticated user คนใดก็ได้ |
| Storage users/{uid}/... | สาธารณะ | auth UID ตรง path |

ไม่มี field validation, participant identity binding หรือ enforce allDone สถานะ finalized ล็อก guest selections แต่ไม่ทำข้อมูลทั้งหมด immutable สำหรับ owner อย่าใช้คำ read-only ใน UI เป็นหลักฐานสิทธิ์ฐานข้อมูล

## รูปและ QR

- Receipt: `bills/${billId}/${Date.now()}_${safeName}` refresh token ก่อน upload retry สูงสุด 3 attempts สำหรับ error ที่เข้าเงื่อนไข
- QR: `bills/owner-settings/${uid}/payment-qr.jpg`; upload แล้ว update profile ภายใน service มี refresh token/retry
- clearOwnerPaymentQr ลบ path ปัจจุบันและ legacy `users/${uid}/payment-qr.jpg` แบบ best-effort แล้ว profile URL=null
- Bill คัดลอก URL ตอน finalize ไม่ได้สำเนารูปแยกต่อบิล จึงไม่ใช่ immutable image snapshot
- Delete Storage เป็น best-effort; collection cleanup ไม่ได้แบ่ง batch ตาม comment จริง ดู K06
