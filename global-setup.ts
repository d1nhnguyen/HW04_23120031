import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { config, url } from './support/env';

async function isUp(target: string): Promise<boolean> {
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Chạy MỘT lần ở đầu mỗi lượt chạy (mỗi lệnh `npx playwright test`):
 * 1. Reset SUT về seed bằng sut.resetCommand. Không reset trước từng test: mỗi lần phải khởi động lại backend
 *    mất 1–2 giây. Bỏ qua bằng SUT_RESET=0 khi đang gỡ lỗi.
 * 2. Kiểm tra mọi dịch vụ trong sut.services đều phản hồi. Nếu thiếu dịch vụ nào thì dừng ngay với thông báo rõ,
 *    thay vì để mọi test fail vì môi trường (đỏ giả, không phải bug của SUT).
 * Lệnh reset và danh sách dịch vụ nằm trong automation.config.json; mỗi dịch vụ tham chiếu một khóa trong `urls`.
 */
export default async function globalSetup() {
  if (process.env.SUT_RESET !== '0') {
    const [command, ...args] = config.sut.resetCommand;
    execFileSync(path.join(__dirname, command), args, { stdio: 'inherit' });
  }

  const down: string[] = [];
  for (const service of config.sut.services) {
    // Địa chỉ lấy từ `urls` (kể cả khi bị ghi đè bằng API_URL / ADMIN_URL / WEB_URL): đúng địa chỉ mà test sẽ mở.
    const target = url(service.url) + (service.path ?? '');
    if (!(await isUp(target))) down.push(`  - ${service.name}: ${target}`);
  }
  if (down.length > 0) {
    throw new Error(
      `Môi trường chưa sẵn sàng, KHÔNG chạy test. Dịch vụ không phản hồi:\n${down.join('\n')}\n` +
        `Bật SUT bằng: ${config.sut.startHint}`,
    );
  }
}
