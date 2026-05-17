import { TmwVoucherConfig, RedeemResult } from './types.js';
import { extractVoucherCode } from './utils.js';
import { defaultCurlRequester } from './requester.js';
import {
  TmwInvalidUrlError,
  TmwValidationError,
  TmwMaintenanceError,
  TmwNetworkError,
  TmwVoucherError
} from './errors.js';

// ส่งออกโครงสร้างภายนอกสำหรับการนำไปใช้ร่วมกัน
export * from './types.js';
export * from './errors.js';
export { extractVoucherCode } from './utils.js';

/**
 * คลาสหลักสำหรับการจัดการและแลกรับซองอั่งเปา TrueMoney Wallet
 */
export class TmwVoucher {
  private mobile?: string;
  private timeout: number;
  private requester: typeof defaultCurlRequester;

  /**
   * สร้างอินสแตนซ์ของระบบ TrueMoney Voucher Redeemer
   * @param config การตั้งค่าเริ่มต้นสำหรับการเคลมซองอั่งเปา
   */
  constructor(config: TmwVoucherConfig = {}) {
    this.mobile = config.mobile;
    this.timeout = config.timeout ?? 15000;
    this.requester = config.requester ?? defaultCurlRequester;
  }

  /**
   * ตรวจสอบว่าระบบจัดแคมเปญแจกซองของ TrueMoney Wallet ปิดปรับปรุงอยู่หรือไม่
   * @returns สัญญาที่ระบุสถานะ: true หากปิดปรับปรุงอยู่, false หากระบบทำงานปกติ
   * @throws {TmwNetworkError} หากมีปัญหาในการเข้าถึง API ของทรูมันนี่ หรือข้อมูลตอบกลับเสียหาย
   */
  async checkMaintenance(): Promise<boolean> {
    let response: any;
    try {
      response = await this.requester('https://gift.truemoney.com/campaign/vouchers/configuration', {
        method: 'GET',
        timeout: this.timeout
      });
    } catch (err: any) {
      // Refactor: หลีกเลี่ยงการครอบซ้ำหากเป็น Error ของห้องสมุดอยู่แล้ว
      if (err instanceof TmwVoucherError) throw err;
      throw new TmwNetworkError(`เช็คสถานะการปรับปรุงระบบ TrueMoney ล้มเหลว (เกิดข้อผิดพลาดในการเชื่อมต่อ): ${err.message}`);
    }

    if (!response) {
      throw new TmwNetworkError('เช็คสถานะการปรับปรุงระบบล้มเหลว (ผลการตอบกลับจาก TrueMoney API เป็นค่าว่างเปล่า)');
    }

    const status = response.status;
    if (!status || typeof status.code !== 'string') {
      throw new TmwNetworkError('รูปแบบผลการตอบกลับตรวจสอบการปรับปรุงระบบจาก TrueMoney API ไม่ถูกต้อง (ไม่พบฟิลด์ status หรือ status.code)');
    }

    return status.code !== 'SUCCESS';
  }

  /**
   * ฟังก์ชันดำเนินการเคลมและรับเงินจากซองอั่งเปา TrueMoney Wallet
   *
   * @param voucherUrlOrCode ลิงก์ซองเต็มรูปแบบ หรือเฉพาะส่วนรหัสโค้ด
   * @param mobileNumber เบอร์โทรศัพท์ที่จะรับเงิน (หากไม่ระบุในฟังก์ชันนี้ จะดึงจากค่าเริ่มต้นที่ระบุในคอนสตรัคเตอร์)
   * @returns ผลการแลกรับเงิน
   * @throws {TmwValidationError} หากไม่ระบุเบอร์โทรศัพท์หรือระบุเบอร์โทรศัพท์ไม่ถูกต้อง (ไม่ครบ 10 หลัก หรือมีตัวหนังสือปน)
   * @throws {TmwInvalidUrlError} หากรูปแบบรหัสซองอั่งเปาไม่ถูกต้อง
   * @throws {TmwMaintenanceError} หากระบบปิดปรับปรุง
   * @throws {TmwNetworkError} หากมีปัญหาการเชื่อมต่อเครือข่าย หรือรูปแบบผลลัพธ์จาก API ไม่ตรงตามคาดหมาย
   */
  async redeem(voucherUrlOrCode: string, mobileNumber?: string): Promise<RedeemResult> {
    // 1. บังคับใส่และตรวจสอบความยาวเบอร์โทรศัพท์อย่างละเอียด
    const targetMobile = mobileNumber || this.mobile;
    if (!targetMobile) {
      throw new TmwValidationError('กรุณาระบุเบอร์โทรศัพท์ผู้รับเงิน (mobile) ทั้งนี้ต้องระบุใน Constructor หรือฟังก์ชัน redeem');
    }

    // Refactor & Clean Code: เพิ่มกระบวนการแปลงเบอร์โทรศัพท์ฟอร์แมตสากล (เช่น +66 หรือ 66 ให้เป็น 0 นำหน้าโดยอัตโนมัติ)
    // ขจัดช่องว่าง, ขีดแดช และเครื่องหมายบวกออก
    let cleanMobile = targetMobile.replace(/[-\s+]/g, '');
    
    // แปลง 66 หรือ +66 นำหน้าให้กลายเป็น 0 นำหน้า
    if (cleanMobile.startsWith('66')) {
      cleanMobile = '0' + cleanMobile.slice(2);
    }

    if (!/^[0-9]{10}$/.test(cleanMobile)) {
      throw new TmwValidationError(`รูปแบบเบอร์โทรศัพท์ผู้รับเงินไม่ถูกต้อง (${targetMobile}) เบอร์โทรศัพท์ต้องประกอบด้วยตัวเลข 10 หลักถ้วนเท่านั้น`);
    }

    // 2. ตรวจสอบรูปแบบโค้ดซองอั่งเปา
    let voucherCode: string | null = null;
    try {
      voucherCode = extractVoucherCode(voucherUrlOrCode);
    } catch (err: any) {
      throw new TmwInvalidUrlError(`เกิดข้อผิดพลาดขณะคัดกรองแปลงลิงก์ซองอั่งเปา: ${err.message}`);
    }

    if (!voucherCode) {
      throw new TmwInvalidUrlError('รูปแบบลิงก์หรือรหัสซองอั่งเปาไม่ถูกต้อง หรือส่งข้อมูลเปล่าเข้ามา');
    }

    // 3. ตรวจสอบการปิดปรับปรุงระบบ
    let isMaintenance = false;
    try {
      isMaintenance = await this.checkMaintenance();
    } catch (err: any) {
      if (err instanceof TmwVoucherError) throw err;
      throw new TmwNetworkError(`เช็คสถานะการเปิดปิดของระบบอั่งเปาล้มเหลวก่อนเริ่มเคลมซอง: ${err.message}`);
    }

    if (isMaintenance) {
      throw new TmwMaintenanceError('ระบบแคมเปญ TrueMoney ซองอั่งเปา ปิดปรับปรุงอยู่ชั่วคราว');
    }

    // 4. ดำเนินการส่งคำขอรับเงินจากระบบ TrueMoney API
    let response: any;
    try {
      response = await this.requester(
        `https://gift.truemoney.com/campaign/vouchers/${voucherCode}/redeem`,
        {
          method: 'POST',
          body: {
            mobile: cleanMobile,
            voucher_hash: voucherCode
          },
          headers: {
            'Origin': 'https://gift.truemoney.com',
            'Referer': `https://gift.truemoney.com/campaign/?v=${voucherCode}`
          },
          timeout: this.timeout
        }
      );
    } catch (err: any) {
      if (err instanceof TmwVoucherError) throw err;
      throw new TmwNetworkError(`การดำเนินการส่งข้อมูลเคลมซองล้มเหลว (เกิดปัญหาฝั่งเครือข่าย/curl): ${err.message}`);
    }

    // 5. วิเคราะห์ข้อมูลตอบกลับอย่างรอบคอบและปลอดภัยสูง
    if (!response) {
      throw new TmwNetworkError('การทำรายการเคลมซองล้มเหลว (ผลการตอบกลับจากระบบ TrueMoney Wallet API เป็นค่าว่างเปล่า)');
    }

    const status = response.status;
    if (!status || typeof status.code !== 'string') {
      throw new TmwNetworkError('รูปแบบผลลัพธ์ที่ตอบกลับจาก TrueMoney Wallet API ไม่ถูกต้อง (ไม่พบฟิลด์ status หรือ status.code ใน JSON ผลลัพธ์)');
    }

    try {
      if (status.code === 'SUCCESS') {
        const amountBahtStr = response.data?.my_ticket?.amount_baht;
        if (!amountBahtStr) {
          throw new TmwNetworkError('ผลตอบกลับแจ้งสถานะ SUCCESS แต่ไม่สามารถระบุฟิลด์จำนวนเงินที่รับได้ (data.my_ticket.amount_baht ขาดหายไป)');
        }

        const amountBaht = parseFloat(amountBahtStr);
        if (isNaN(amountBaht)) {
          throw new TmwNetworkError(`จำนวนเงินที่ระบบทรูมันนี่ส่งกลับมามีรูปแบบไม่ถูกต้องและไม่สามารถแปลงเป็นตัวเลขได้: "${amountBahtStr}"`);
        }

        const amountSatang = Math.round(amountBaht * 100);

        return {
          success: true,
          amountSatang,
          amountBaht,
          message: status.message || 'แลกรับซองสำเร็จ'
        };
      }

      // ส่งกลับผลลัพธ์ล้มเหลวตามเคสของธุรกิจ (เช่น ซองหมด, ซองเคลมซ้ำ) โดยไม่โยน Error เพื่อความสะดวกในการเขียนเงื่อนไขตรวจสอบ
      return {
        success: false,
        code: status.code,
        message: status.message || 'แลกรับซองไม่สำเร็จ'
      };
    } catch (err: any) {
      if (err instanceof TmwVoucherError) throw err;
      throw new TmwNetworkError(`เกิดข้อผิดพลาดในการถอดโครงสร้างวิเคราะห์ฟิลด์ข้อมูลตอบกลับจาก TrueMoney: ${err.message}`);
    }
  }
}

/**
 * ฟังก์ชันช่วยเรียกใช้งานทันทีโดยไม่ต้องสร้างคลาสอ็อบเจกต์ (Convenience Wrapper)
 *
 * @param mobileNumber เบอร์โทรศัพท์ 10 หลักที่ต้องการรับเงิน (บังคับใส่)
 * @param voucherUrlOrCode ลิงก์ซองเต็มรูปแบบ หรือเฉพาะส่วนรหัสโค้ด
 * @param options การตั้งค่าเชื่อมต่อแบบเสริม เช่น timeout หรือ custom requester
 * @returns ผลการแลกรับเงิน
 */
export async function redeemVoucher(
  mobileNumber: string,
  voucherUrlOrCode: string,
  options?: Omit<TmwVoucherConfig, 'mobile'>
): Promise<RedeemResult> {
  // บังคับใส่เบอร์โทรศัพท์อย่างแน่นอน
  if (!mobileNumber) {
    throw new TmwValidationError('กรุณาระบุเบอร์โทรศัพท์ผู้รับเงิน (mobileNumber)');
  }
  
  const client = new TmwVoucher({
    mobile: mobileNumber,
    ...options
  });
  return client.redeem(voucherUrlOrCode);
}
