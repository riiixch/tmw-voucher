/**
 * ฟังก์ชันแยกแยะรหัสซองอั่งเปา (Voucher Hash) ออกมาจากลิงก์อั่งเปาอย่างปลอดภัยและยืดหยุ่นสูง
 *
 * รองรับรูปแบบอินพุตดังนี้:
 * - ลิงก์เต็มรูปแบบ: `https://gift.truemoney.com/campaign/?v=5xxxxxxxxxxxxxxxxx`
 * - ลิงก์ย่อ/ไม่ระบุโปรโตคอล: `gift.truemoney.com/campaign/?v=5xxxxxxxxxxxxxxxxx`
 * - รหัสซองตรงๆ หรือแอบแฝงเศษ: `5xxxxxxxxxxxxxxxxx#hash` หรือ `5xxxxxxxxxxxxxxxxx/`
 *
 * @param urlOrCode ลิงก์ซองอั่งเปาหรือรหัสซองอั่งเปา
 * @returns รหัสซองอั่งเปาความยาว 10-48 ตัวอักษรที่เป็นตัวเลขและตัวอักษรภาษาอังกฤษ หรือ null หากรูปแบบไม่ถูกต้อง
 */
export function extractVoucherCode(urlOrCode: string): string | null {
  if (!urlOrCode) return null;
  const trimmed = urlOrCode.trim();

  let code: string | null = null;

  // ขั้นตอนที่ 1: พยายามแยกพารามิเตอร์ `v` ผ่านระบบโครงสร้าง URL
  try {
    const formattedUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const url = new URL(formattedUrl);
    code = url.searchParams.get('v');
  } catch {
    // ป้องกันและข้ามกรณีเป็นข้อความดิบที่ไม่ใช่โครงสร้าง URL
  }

  // ขั้นตอนที่ 2: หากไม่ได้อยู่ในรูปแบบ URL สมบูรณ์ ให้ลองใช้ Regex ค้นหาพารามิเตอร์ `?v=` หรือ `&v=`
  if (!code) {
    const matchV = trimmed.match(/[?&]v=([a-zA-Z0-9]+)/);
    code = matchV ? matchV[1] : null;
  }

  // ขั้นตอนที่ 3: หากยังไม่พบอีก แสดงว่าเป็นข้อความดิบที่ส่งเข้ามา (เช่น 5a1b2c...#hash)
  // ให้พยายามจับกลุ่มข้อความตัวหนังสือและตัวเลข (alphanumeric) ชุดแรกที่มีความยาวตั้งแต่ 10 ถึง 48 หลัก
  if (!code) {
    const matchDirect = trimmed.match(/[a-zA-Z0-9]{10,48}/);
    code = matchDirect ? matchDirect[0] : null;
  }

  // ขั้นตอนที่ 4: ทำความสะอาด (Sanitize) และคัดกรองรอบสุดท้าย
  if (code) {
    // ตัดสัญลักษณ์พิเศษ เช่น เครื่องหมายเฉลียง / หรือเครื่องหมายแฮช # ที่อาจพ่วงติดมาระหว่างแกะข้อมูล
    const cleanedCode = code.trim().replace(/[^a-zA-Z0-9]/g, '');
    
    // ตรวจสอบความถูกต้องของขนาดที่ผ่านการขัดเกลาแล้ว
    if (cleanedCode.length >= 10 && cleanedCode.length <= 48) {
      return cleanedCode;
    }
  }

  return null;
}
