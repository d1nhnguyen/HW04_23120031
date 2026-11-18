import { expect } from '@playwright/test';
import { ApiClient } from './api-client';

/** Một đơn như GET /api/admin/orders trả về (danh sách của admin có thêm user_name). */
export type Order = {
  id: number;
  user_id: number;
  total_amount: number;
  status: string;
  shipping_address: string | null;
  created_at: string;
  user_name?: string;
};

/**
 * API đơn hàng phía Admin (riêng của FR-10): đọc danh sách, đọc một đơn, đổi trạng thái cho bước setup.
 * SUT KHÔNG có API xóa đơn, nên lớp này không có hàm dọn dữ liệu.
 */
export class AdminOrdersApi extends ApiClient {
  async list(): Promise<Order[]> {
    const res = await this.request.get(`${this.baseUrl}/admin/orders`, { headers: this.auth() });
    expect(res.ok(), 'GET /admin/orders').toBeTruthy();
    return res.json();
  }

  async get(id: number): Promise<Order> {
    const res = await this.request.get(`${this.baseUrl}/orders/${id}`, { headers: this.auth() });
    expect(res.ok(), `GET /orders/${id}`).toBeTruthy();
    return res.json();
  }

  /** Đổi trạng thái cho bước setup. Chỉ gọi theo chuyển hợp lệ của sơ đồ, nên phải thành công. */
  async setStatus(id: number, status: string) {
    const res = await this.request.put(`${this.baseUrl}/admin/orders/${id}/status`, {
      headers: this.auth(),
      data: { status },
    });
    expect(res.ok(), `PUT /admin/orders/${id}/status → ${status} (setup)`).toBeTruthy();
  }
}

/** API phía khách hàng (riêng của FR-10): tạo đơn cho bước setup. */
export class CustomerOrdersApi extends ApiClient {
  /** POST /api/checkout. Đơn mới ở trạng thái pending. Trả về id đơn. */
  async checkout(totalAmount: number, shippingAddress: string): Promise<number> {
    const res = await this.request.post(`${this.baseUrl}/checkout`, {
      headers: this.auth(),
      data: { total_amount: totalAmount, shipping_address: shippingAddress },
    });
    expect(res.ok(), 'POST /checkout (setup)').toBeTruthy();
    return (await res.json()).orderId;
  }
}
