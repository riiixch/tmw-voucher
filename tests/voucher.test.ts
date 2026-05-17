import { describe, it, expect, vi } from 'vitest';
import { 
  TmwVoucher, 
  redeemVoucher, 
  extractVoucherCode, 
  TmwInvalidUrlError, 
  TmwValidationError,
  TmwMaintenanceError, 
  TmwNetworkError 
} from '../src/index.js';

describe('TMW Voucher Utility - extractVoucherCode (Robustness checks)', () => {
  it('ควรแยกแยะรหัสซองอั่งเปาจาก URL เต็มรูปแบบได้ถูกต้อง', () => {
    const url = 'https://gift.truemoney.com/campaign/?v=5a1b2c3d4e5f6g7h8i9j0k';
    expect(extractVoucherCode(url)).toBe('5a1b2c3d4e5f6g7h8i9j0k');
  });

  it('ควรแยกแยะรหัสซองอั่งเปาจาก URL ที่ไม่มีโปรโตคอลได้ถูกต้อง', () => {
    const url = 'gift.truemoney.com/campaign/?v=5a1b2c3d4e5f6g7h8i9j0k';
    expect(extractVoucherCode(url)).toBe('5a1b2c3d4e5f6g7h8i9j0k');
  });

  it('ควรส่งคืนรหัสเดิมทันทีหากระบุเป็นรหัสซองอั่งเปาตรงๆ', () => {
    const code = '5a1b2c3d4e5f6g7h8i9j0k';
    expect(extractVoucherCode(code)).toBe('5a1b2c3d4e5f6g7h8i9j0k');
  });

  it('ควรตัดช่องว่างส่วนเกินหน้าและหลังออกได้ถูกต้อง', () => {
    const code = '   5a1b2c3d4e5f6g7h8i9j0k  ';
    expect(extractVoucherCode(code)).toBe('5a1b2c3d4e5f6g7h8i9j0k');
  });

  it('Refactor: ควรตัดสัญลักษณ์แอบแฝง เช่น เครื่องหมายสแลชหรือแฮชที่ติดมาออกได้สำเร็จ', () => {
    // ในกรณีที่ user คัดลอกเบราว์เซอร์แล้วมีเศษพ่วงมา
    const codeWithHash = '   5a1b2c3d4e5f6g7h8i9j0k#hash  ';
    const codeWithSlash = 'https://gift.truemoney.com/campaign/?v=5a1b2c3d4e5f6g7h8i9j0k/';
    expect(extractVoucherCode(codeWithHash)).toBe('5a1b2c3d4e5f6g7h8i9j0k');
    expect(extractVoucherCode(codeWithSlash)).toBe('5a1b2c3d4e5f6g7h8i9j0k');
  });

  it('ควรส่งคืน null หากรูปแบบซองไม่ถูกต้อง หรือมีอักขระพิเศษ', () => {
    expect(extractVoucherCode('https://gift.truemoney.com/campaign/')).toBeNull();
    expect(extractVoucherCode('invalid-hash!@#')).toBeNull();
    expect(extractVoucherCode('')).toBeNull();
  });
});

describe('TmwVoucher Class - Core Redemption & Normalization Flows', () => {
  const dummyMobile = '0812345678';
  const dummyVoucher = '5a1b2c3d4e5f6g7h8i9j0k';

  it('ควรโยน TmwValidationError หากไม่มีการตั้งค่าเบอร์โทรศัพท์มือถือ', async () => {
    const client = new TmwVoucher();
    await expect(client.redeem(dummyVoucher)).rejects.toThrow(TmwValidationError);
  });

  it('ควรโยน TmwValidationError ล่วงหน้าใน Constructor หากเบอร์โทรศัพท์น้อยกว่า 10 หลัก (เช่น 9 หลัก)', () => {
    expect(() => new TmwVoucher({ mobile: '081234567' })).toThrow(TmwValidationError);
  });

  it('ควรโยน TmwValidationError ล่วงหน้าใน Constructor หากเบอร์โทรศัพท์มากกว่า 10 หลัก (เช่น 11 หลัก)', () => {
    expect(() => new TmwVoucher({ mobile: '08123456789' })).toThrow(TmwValidationError);
  });

  it('ควรโยน TmwValidationError ล่วงหน้าใน Constructor หากเบอร์โทรศัพท์มีตัวหนังสือปะปน', () => {
    expect(() => new TmwVoucher({ mobile: '0812345abc' })).toThrow(TmwValidationError);
  });

  it('Refactor: ควรทำการแปลงเบอร์โทรสากล (+66 หรือ 66) ให้เป็น 0 อัตโนมัติและผ่านการยืนยันตัวตนได้', async () => {
    const mockRequester = vi.fn().mockImplementation(async (url) => {
      if (url.includes('/configuration')) return { status: { code: 'SUCCESS' } };
      if (url.includes('/redeem')) {
        return {
          status: { code: 'SUCCESS' },
          data: { my_ticket: { amount_baht: '50.00' } }
        };
      }
      return null;
    });

    // ทดสอบแบบระบุ +66 พร้อมขีดแดชและช่องเคาะวรรค
    const client1 = new TmwVoucher({ mobile: '+66 81-234-5678', requester: mockRequester });
    const result1 = await client1.redeem(dummyVoucher);
    expect(result1.success).toBe(true);
    expect(result1.amountBaht).toBe(50.00);

    // ทดสอบแบบระบุ 66 นำหน้าตรงๆ
    const client2 = new TmwVoucher({ mobile: '66812345678', requester: mockRequester });
    const result2 = await client2.redeem(dummyVoucher);
    expect(result2.success).toBe(true);
  });

  it('ควรโยน TmwInvalidUrlError หากโค้ดซองเสียหรือไม่ถูกต้อง', async () => {
    const client = new TmwVoucher({ mobile: dummyMobile });
    await expect(client.redeem('url-เสีย')).rejects.toThrow(TmwInvalidUrlError);
  });

  it('ควรเคลมซองสำเร็จ หากสถานะ API ตอบกลับมาเป็น SUCCESS', async () => {
    // จำลองตัวยิง HTTP
    const mockRequester = vi.fn().mockImplementation(async (url) => {
      if (url.includes('/configuration')) {
        return { status: { code: 'SUCCESS' } };
      }
      if (url.includes('/redeem')) {
        return {
          status: { code: 'SUCCESS', message: 'แลกรับสำเร็จ' },
          data: { my_ticket: { amount_baht: '100.50' } }
        };
      }
      return null;
    });

    const client = new TmwVoucher({ mobile: dummyMobile, requester: mockRequester });
    const result = await client.redeem(dummyVoucher);

    expect(result.success).toBe(true);
    expect(result.amountBaht).toBe(100.50);
    expect(result.amountSatang).toBe(10050);
    expect(result.message).toBe('แลกรับสำเร็จ');
  });

  it('ควรส่งคืนรหัสข้อผิดพลาดและข้อมูลเฟลอย่างสุภาพ หากกดเคลมซองไม่สำเร็จ (เช่น ซองโดนรับไปครบแล้ว)', async () => {
    const mockRequester = vi.fn().mockImplementation(async (url) => {
      if (url.includes('/configuration')) {
        return { status: { code: 'SUCCESS' } };
      }
      if (url.includes('/redeem')) {
        return {
          status: { code: 'VOUCHER_OUT_OF_STOCK', message: 'ซองนี้ถูกเติมเงินจนหมดโควต้าแล้ว' }
        };
      }
      return null;
    });

    const client = new TmwVoucher({ mobile: dummyMobile, requester: mockRequester });
    const result = await client.redeem(dummyVoucher);

    expect(result.success).toBe(false);
    expect(result.code).toBe('VOUCHER_OUT_OF_STOCK');
    expect(result.message).toBe('ซองนี้ถูกเติมเงินจนหมดโควต้าแล้ว');
  });

  it('ควรโยน TmwMaintenanceError หาก TrueMoney อยู่ในช่วงปรับปรุงระบบ', async () => {
    const mockRequester = vi.fn().mockImplementation(async (url) => {
      if (url.includes('/configuration')) {
        return { status: { code: 'MAINTENANCE', message: 'ปิดปรับปรุง' } };
      }
      return null;
    });

    const client = new TmwVoucher({ mobile: dummyMobile, requester: mockRequester });
    await expect(client.redeem(dummyVoucher)).rejects.toThrow(TmwMaintenanceError);
  });

  it('ควรโยน TmwNetworkError หาก Requester เชื่อมต่ออินเทอร์เน็ตไม่ได้หรือ curl พัง', async () => {
    const mockRequester = vi.fn().mockImplementation(async () => {
      throw new Error('Connection refused by peer');
    });

    const client = new TmwVoucher({ mobile: dummyMobile, requester: mockRequester });
    await expect(client.redeem(dummyVoucher)).rejects.toThrow(TmwNetworkError);
  });
});

describe('Functional Wrapper - redeemVoucher', () => {
  it('ควรเรียกใช้งานและประมวลผลสำเร็จแบบไม่ต้องตั้ง Class', async () => {
    const mockRequester = vi.fn().mockImplementation(async (url) => {
      if (url.includes('/configuration')) {
        return { status: { code: 'SUCCESS' } };
      }
      if (url.includes('/redeem')) {
        return {
          status: { code: 'SUCCESS' },
          data: { my_ticket: { amount_baht: '20.00' } }
        };
      }
      return null;
    });

    const result = await redeemVoucher('0812345678', '5a1b2c3d4e5f6g7h8i9j0k', {
      requester: mockRequester
    });

    expect(result.success).toBe(true);
    expect(result.amountBaht).toBe(20);
    expect(result.amountSatang).toBe(2000);
  });

  it('ควรโยน TmwValidationError หากไม่ได้ส่งเบอร์โทรศัพท์มาใน Functional Wrapper', async () => {
    await expect(redeemVoucher('', '5a1b2c3d4e5f6g7h8i9j0k')).rejects.toThrow(TmwValidationError);
  });
});

describe('TmwVoucher Resilience - Automatic Retry & Backoff Flows', () => {
  const dummyMobile = '0812345678';
  const dummyVoucher = '5a1b2c3d4e5f6g7h8i9j0k';

  it('ควรพยายามส่งคำขอซ้ำ (Retry) เมื่อพบความล้มเหลวเครือข่าย และสำเร็จในรอบถัดไป', async () => {
    let callCount = 0;
    const mockRequester = vi.fn().mockImplementation(async (url) => {
      callCount++;
      if (url.includes('/configuration')) {
        return { status: { code: 'SUCCESS' } };
      }
      if (url.includes('/redeem')) {
        if (callCount < 3) {
          // จำลองความล้มเหลวเครือข่าย 2 รอบแรก (รอบ 1 เช็ค config, รอบ 2 ลองเคลมแล้วพัง)
          throw new Error('Transient network timeout');
        }
        return {
          status: { code: 'SUCCESS' },
          data: { my_ticket: { amount_baht: '35.00' } }
        };
      }
      return null;
    });

    const client = new TmwVoucher({
      mobile: dummyMobile,
      requester: mockRequester,
      retryOptions: {
        retries: 2,
        minTimeout: 10, // หน่วงเวลาน้อยๆ ในการเทสเพื่อความรวดเร็ว
        factor: 1.5
      }
    });

    const result = await client.redeem(dummyVoucher);
    
    expect(result.success).toBe(true);
    expect(result.amountBaht).toBe(35);
    // ทั้งหมดต้องถูกเรียก: รอบแรก config (สำเร็จ), รอบสอง redeem (พังรอบแรก), รอบสาม redeem (สำเร็จหลังจาก retry)
    expect(mockRequester).toHaveBeenCalledTimes(3);
  });
});
