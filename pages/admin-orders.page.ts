import type { Page } from '@playwright/test';
import { AdminShell } from './admin-shell.page';
import { OrderTable } from './order-table';

/** Page Object của Web Admin – mục Đơn hàng (riêng của FR-10). Locator lấy theo bảng khảo sát B2. */
export class AdminOrdersPage extends AdminShell {
  readonly orders: OrderTable;

  constructor(page: Page) {
    // Mục Đơn hàng ghi dữ liệu qua PUT /api/admin/orders/<id>/status.
    super(page, '/api/admin/orders/\\d+/status$');
    // Bảng đơn: ID | Người đặt | Tổng tiền | Địa chỉ | Trạng thái | Hành động
    this.orders = new OrderTable(
      page,
      page.locator('table').filter({ has: page.getByRole('columnheader', { name: 'Hành động' }) }),
    );
  }

  async openOrders() {
    await this.openSection('Đơn hàng', 'Quản lý Đơn hàng');
  }
}
