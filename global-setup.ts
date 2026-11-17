import { execFileSync } from 'node:child_process';
import path from 'node:path';

const SERVICES = [
  { name: 'Backend API', url: `${process.env.API_URL ?? 'http://localhost:3000/api'}/products` },
  { name: 'Web Admin (frontend-admin)', url: process.env.ADMIN_URL ?? 'http://localhost:5174' },
  { name: 'Web khách hàng (frontend-web)', url: process.env.WEB_URL ?? 'http://localhost:5173' },
];

async function isUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Chạy MỘT lần ở đầu mỗi lượt chạy (mỗi lệnh `npx playwright test`):
 * 1. Reset SUT về seed. Không reset trước từng test: mỗi lần phải khởi động lại backend mất 1–2 giây.
 *    Bỏ qua bằng SUT_RESET=0 khi đang gỡ lỗi.
 * 2. Kiểm tra backend và hai frontend đều phản hồi. Nếu thiếu dịch vụ nào thì dừng ngay với thông báo rõ,
 *    thay vì để mọi test fail vì môi trường (đỏ giả, không phải bug của SUT).
 */
export default async function globalSetup() {
  if (process.env.SUT_RESET !== '0') {
    execFileSync(path.join(__dirname, 'scripts', 'sut.sh'), ['reset'], { stdio: 'inherit' });
  }

  const down: string[] = [];
  for (const service of SERVICES) {
    if (!(await isUp(service.url))) down.push(`  - ${service.name}: ${service.url}`);
  }
  if (down.length > 0) {
    throw new Error(
      `Môi trường chưa sẵn sàng, KHÔNG chạy test. Dịch vụ không phản hồi:\n${down.join('\n')}\n` +
        'Bật SUT bằng: scripts/sut.sh start   (xem trạng thái: scripts/sut.sh status)',
    );
  }
}
