import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * Reset SUT về seed MỘT lần ở đầu mỗi lượt chạy (mỗi lệnh `npx playwright test`).
 * Không reset trước từng test: mỗi lần phải khởi động lại backend mất 1–2 giây.
 * Bỏ qua bằng SUT_RESET=0 khi đang gỡ lỗi.
 */
export default function globalSetup() {
  if (process.env.SUT_RESET === '0') return;
  execFileSync(path.join(__dirname, 'scripts', 'sut.sh'), ['reset'], { stdio: 'inherit' });
}
