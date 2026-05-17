/**
 * คลาสข้อผิดพลาดหลักของระบบ TrueMoney Voucher
 */
export class TmwVoucherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;

    // กู้คืน Prototype chain เพื่อช่วยในการระบุประเภทของ Error (instanceof) ในระบบ ESM/CJS
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * รูปแบบลิงก์หรือรหัสซองอั่งเปาไม่ถูกต้อง
 */
export class TmwInvalidUrlError extends TmwVoucherError {
  constructor(message: string = 'รูปแบบลิงก์หรือรหัสซองอั่งเปาไม่ถูกต้อง') {
    super(message);
  }
}

/**
 * ข้อมูลนำเข้าไม่ถูกต้องตามเงื่อนไขที่กำหนด (เช่น เบอร์โทรศัพท์ไม่ได้กรอก หรือรูปแบบไม่ครบ 10 หลัก)
 */
export class TmwValidationError extends TmwVoucherError {
  constructor(message: string = 'ข้อมูลนำเข้าไม่ถูกต้องตามเงื่อนไขที่กำหนด') {
    super(message);
  }
}

/**
 * ระบบแคมเปญ TrueMoney Wallet ซองอั่งเปา ปิดปรับปรุงอยู่
 */
export class TmwMaintenanceError extends TmwVoucherError {
  constructor(message: string = 'ระบบแคมเปญ TrueMoney Wallet ปิดปรับปรุงอยู่ชั่วคราว') {
    super(message);
  }
}

/**
 * เคลมซองอั่งเปาไม่สำเร็จ (เช่น ซองหมดอายุ, ซองโดนรับไปครบแล้ว, หรือเบอร์ผู้รับไม่ถูกต้อง)
 */
export class TmwRedeemError extends TmwVoucherError {
  /**
   * @param message ข้อความชี้แจงความผิดพลาด
   * @param code รหัสความผิดพลาดจาก TrueMoney Wallet (เช่น 'TARGET_USER_REDEEMED', 'VOUCHER_OUT_OF_STOCK')
   */
  constructor(message: string, public readonly code: string) {
    super(`${message} (โค้ด: ${code})`);
  }
}

/**
 * ปัญหาเกี่ยวกับการเชื่อมต่อเครือข่าย หรือกระบวนการรันคำสั่งภายนอก (curl) ล้มเหลว
 */
export class TmwNetworkError extends TmwVoucherError {
  constructor(message: string) {
    super(message);
  }
}
