import { expect, type Locator, type Page } from '@playwright/test';
import { url } from '../support/env';
import { OrderTable } from './order-table';
import { WebShell } from './web-shell.page';

/** Page Object của Web khách hàng – trang Hồ sơ, bảng Lịch sử đơn hàng (riêng của FR-10). */
export class ProfilePage extends WebShell {
  readonly historyHeading: Locator;
  readonly orders: OrderTable;

  constructor(page: Page) {
    // Trang Hồ sơ hủy đơn qua PUT /api/orders/<id>/cancel.
    super(page, '/api/orders/\\d+/cancel$');
    this.historyHeading = page.getByRole('heading', { name: 'Lịch sử đơn hàng' });
    // Bảng Lịch sử đơn hàng: Mã ĐH | Ngày đặt | Tổng tiền | Trạng thái | Thao tác
    this.orders = new OrderTable(
      page,
      page.locator('table').filter({ has: page.getByRole('columnheader', { name: 'Mã ĐH' }) }),
    );
  }

  async open() {
    await this.page.goto(`${url('web')}/profile`);
    await expect(this.historyHeading).toBeVisible();
  }
}
