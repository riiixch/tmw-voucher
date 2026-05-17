export interface RetryOptions {
  /**
   * จำนวนครั้งสูงสุดที่จะพยายามส่งคำขอซ้ำเมื่อเกิดการเชื่อมต่อล้มเหลว (ค่าเริ่มต้น: 0 คือไม่ยิงซ้ำ)
   */
  retries?: number;

  /**
   * เวลารอบแรกที่จะรอคอยก่อนเริ่มการยิงคำขอซ้ำรอบสอง ในหน่วยมิลลิวินาที (ค่าเริ่มต้น: 1000ms)
   */
  minTimeout?: number;

  /**
   * ตัวคูณทวีคูณสำหรับคำนวณเวลาการหน่วงรอบถัดไป (Exponential factor, ค่าเริ่มต้น: 2)
   */
  factor?: number;
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  retryOptions?: RetryOptions;
}

export type RequesterFunction = (url: string, options?: RequestOptions) => Promise<any>;

export interface TmwVoucherConfig {
  /**
   * เบอร์โทรศัพท์เริ่มต้นที่จะใช้รับเงิน (10 หลัก เช่น '0812345678')
   */
  mobile?: string;
  
  /**
   * กำหนดเวลาหมดเวลาเชื่อมต่อสูงสุด (มิลลิวินาที) ค่าเริ่มต้นคือ 15000ms
   */
  timeout?: number;

  /**
   * ฟังก์ชันส่ง Request แบบกำหนดเอง (เช่น การใช้งานร่วมกับ proxy หรือ Axios)
   * หากไม่ได้ระบุ จะใช้ curl.exe (บน Windows) หรือ curl (บน Unix) ดีฟอลต์เพื่อ bypass Cloudflare
   */
  requester?: RequesterFunction;

  /**
   * การตั้งค่าลองใหม่อัตโนมัติเมื่อเกิดการเชื่อมต่อหรือเน็ตเวิร์กขัดข้อง (Automatic Retry with Exponential Backoff)
   */
  retryOptions?: RetryOptions;
}

export interface RedeemResult {
  /**
   * สถานะความสำเร็จของการเคลมซองอั่งเปา
   */
  success: boolean;

  /**
   * จำนวนเงินที่ได้รับ หน่วยเป็นสตางค์ (เช่น 5000 สตางค์ = 50.00 บาท)
   * จะมีค่าเมื่อ success เป็น true เท่านั้น
   */
  amountSatang?: number;

  /**
   * จำนวนเงินที่ได้รับ หน่วยเป็นบาท (เช่น 50.0)
   * จะมีค่าเมื่อ success เป็น true เท่านั้น
   */
  amountBaht?: number;

  /**
   * รหัสความผิดพลาดที่ตอบกลับมาจากระบบ TrueMoney Wallet API (เช่น 'VOUCHER_OUT_OF_STOCK')
   * จะมีค่าเมื่อ success เป็น false เท่านั้น
   */
  code?: string;

  /**
   * ข้อความชี้แจงสถานะความผิดพลาดหรือสถานะสำเร็จจาก TrueMoney Wallet API
   */
  message?: string;
}
