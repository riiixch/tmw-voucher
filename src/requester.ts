import { execFile } from 'child_process';
import { promisify } from 'util';
import { RequestOptions, RequesterFunction } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * ตัวส่งคำขอ HTTP (Requester) เริ่มต้นโดยใช้ curl ภายนอกระบบในการบายพาส Cloudflare TLS Fingerprint
 */
export const defaultCurlRequester: RequesterFunction = async (url, options = {}) => {
  const isWindows = process.platform === 'win32';
  const curlCmd = isWindows ? 'curl.exe' : 'curl';

  // แปลงมิลลิวินาทีเป็นวินาที (ปัดเศษขึ้น)
  const timeoutSec = Math.ceil((options.timeout || 15000) / 1000);

  const args = [
    '-s',                   // เงียบ (Silent mode)
    '-L',                   // ติดตาม Redirect
    '--max-time', String(timeoutSec), // หมดเวลาสูงสุด
  ];

  // flag ความปลอดภัยในการตรวจสอบใบรับรอง Schannel สำหรับ Windows
  if (isWindows) {
    args.push('--ssl-no-revoke');
  }

  // Headers เลียนแบบเบราว์เซอร์มาตรฐาน
  const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://gift.truemoney.com/',
  };

  const headers = { ...defaultHeaders, ...options.headers };
  for (const [key, value] of Object.entries(headers)) {
    args.push('-H', `${key}: ${value}`);
  }

  if (options.method === 'POST') {
    args.push('-X', 'POST');
    if (options.body) {
      args.push('-H', 'Content-Type: application/json');
      args.push('-d', JSON.stringify(options.body));
    }
  }

  args.push(url);

  try {
    const { stdout } = await execFileAsync(curlCmd, args);

    // Refactor: ตรวจสอบและทำความสะอาดผลลัพธ์จากภายนอก
    const trimmedStdout = (stdout || '').trim();
    if (!trimmedStdout) {
      throw new Error('เซิร์ฟเวอร์ตอบกลับมาเป็นค่าว่างเปล่า (Empty response body)');
    }

    try {
      return JSON.parse(trimmedStdout);
    } catch (parseErr: any) {
      throw new Error(`ไม่สามารถแปลงข้อมูลตอบกลับเป็น JSON ได้: ${parseErr.message} (ข้อมูลดิบ: ${trimmedStdout.substring(0, 100)}...)`);
    }
  } catch (err: any) {
    // ในกรณีที่ TrueMoney ส่งรหัสสถานะไม่สำเร็จ (เช่น 400 Bad Request) แต่มี JSON อยู่ใน stdout
    if (err.stdout) {
      const trimmedErrStdout = err.stdout.trim();
      if (trimmedErrStdout) {
        try {
          return JSON.parse(trimmedErrStdout);
        } catch { }
      }
    }

    // โยนข้อผิดพลาดเดิมหรือความผิดพลาดที่เกิดขึ้น
    throw new Error(err.message || 'การยิงคำขอ curl เกิดข้อผิดพลาดในการเชื่อมต่อ');
  }
};
