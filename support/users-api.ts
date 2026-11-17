import { expect } from '@playwright/test';
import { ApiClient } from './api-client';
import type { Account } from './env';

/** Một tài khoản như GET /api/admin/users trả về. */
export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  login_attempts: number;
  locked_until: string | null;
  shipping_address: string | null;
};

export type NewAccount = Account & { name: string };

/** Gọi API của SUT để dựng, chụp và dọn dữ liệu tài khoản (riêng của FR-01). Cần đăng nhập bằng tài khoản admin. */
export class UsersApi extends ApiClient {
  async list(): Promise<User[]> {
    const res = await this.request.get(`${this.baseUrl}/admin/users`, { headers: this.auth() });
    expect(res.ok(), 'GET /admin/users').toBeTruthy();
    return res.json();
  }

  /** Tạo tài khoản cho bước setup, không qua giao diện. */
  async register(account: NewAccount): Promise<number> {
    const res = await this.request.post(`${this.baseUrl}/register`, {
      data: { name: account.name, email: account.email, password: account.password },
    });
    expect(res.ok(), 'POST /register (setup)').toBeTruthy();
    return (await res.json()).id;
  }

  async remove(id: number) {
    await this.request.delete(`${this.baseUrl}/admin/users/${id}`, { headers: this.auth() });
  }

  /** Thử đăng nhập bằng một cặp email + mật khẩu. Không đụng tới token admin của lớp này. */
  async canLogin(account: Account): Promise<boolean> {
    const res = await this.request.post(`${this.baseUrl}/login`, {
      data: { email: account.email, password: account.password },
    });
    if (!res.ok()) return false;
    const body = (await res.json().catch(() => ({}))) as { token?: string };
    return Boolean(body.token);
  }
}
