import { readFileSync } from 'node:fs';
import path from 'node:path';

export type Account = { email: string; password: string };

export type AutomationConfig = {
  /** Mã người chạy, hiện trong tiêu đề report và annotation "Run by". */
  runBy: string;
  /** Số test case tối thiểu của một feature. */
  minTestCases: number;
  /** Số kiểu assertion khác nhau tối thiểu mà suite của một feature phải dùng. */
  minAssertionKinds: number;
  /** File đặc tả dùng làm nguồn của kết quả mong đợi. */
  spec: string;
  sut: {
    /** Thư mục mã nguồn SUT trên máy. */
    dir: string;
    /** Lệnh đưa dữ liệu SUT về seed, chạy một lần ở đầu mỗi lượt. Phần tử đầu là đường dẫn tính từ gốc dự án. */
    resetCommand: string[];
    /** Gợi ý in ra khi SUT chưa chạy. */
    startHint: string;
    /**
     * Các dịch vụ phải phản hồi trước khi chạy test. `url` là TÊN KHÓA trong `urls` (không phải địa chỉ),
     * để địa chỉ chỉ ghi ở một nơi; `path` là đường dẫn nối thêm khi kiểm (ví dụ "/products").
     */
    services: { name: string; url: string; path?: string }[];
  };
  urls: Record<string, string>;
  accounts: Record<string, Account>;
  /** Repo GitHub chứa issue của SUT, dạng "owner/repo". */
  bugTracker: string;
};

/**
 * Mọi giá trị riêng của dự án (mã người chạy, đường dẫn SUT, URL, tài khoản) nằm trong
 * automation.config.json. Script và test không ghi cứng các giá trị này.
 * Ghi đè khi cần: AUTOMATION_CONFIG=<file khác>, RUN_BY, API_URL, ADMIN_URL, WEB_URL.
 */
const file = process.env.AUTOMATION_CONFIG ?? path.join(__dirname, '..', 'automation.config.json');
const raw = JSON.parse(readFileSync(file, 'utf8')) as AutomationConfig;

export const config: AutomationConfig = {
  ...raw,
  runBy: process.env.RUN_BY ?? raw.runBy,
  urls: {
    ...raw.urls,
    ...(process.env.API_URL ? { api: process.env.API_URL } : {}),
    ...(process.env.ADMIN_URL ? { admin: process.env.ADMIN_URL } : {}),
    ...(process.env.WEB_URL ? { web: process.env.WEB_URL } : {}),
  },
};

export function account(name: string): Account {
  const found = config.accounts[name];
  if (!found) throw new Error(`automation.config.json không có tài khoản "${name}"`);
  return found;
}

export function url(name: string): string {
  const found = config.urls[name];
  if (!found) throw new Error(`automation.config.json không có URL "${name}"`);
  return found;
}
