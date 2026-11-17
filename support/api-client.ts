import { expect, type APIRequestContext } from '@playwright/test';
import { url, type Account } from './env';

/** Phần dùng chung cho mọi lớp gọi API của SUT: đăng nhập lấy token và gọi có xác thực. */
export class ApiClient {
  protected token = '';

  constructor(
    protected readonly request: APIRequestContext,
    protected readonly baseUrl: string = url('api'),
  ) {}

  async login(account: Account) {
    const res = await this.request.post(`${this.baseUrl}/login`, {
      data: { email: account.email, password: account.password },
    });
    expect(res.ok(), `đăng nhập API bằng ${account.email}`).toBeTruthy();
    this.token = (await res.json()).token;
  }

  protected auth() {
    return { Authorization: `Bearer ${this.token}` };
  }
}

/**
 * Dọn dữ liệu theo id: xóa mọi bản ghi có id không nằm trong tập id chụp trước test.
 * Gọi trong fixture, sau `use()`, để vẫn chạy khi test fail. Không dọn theo tên, vì có bản ghi không có tên để tìm.
 */
export async function cleanupNewRecords<T extends { id: number }>(
  idsBefore: Set<number>,
  list: () => Promise<T[]>,
  remove: (id: number) => Promise<void>,
) {
  for (const record of await list()) {
    if (!idsBefore.has(record.id)) await remove(record.id);
  }
}
