import { expect, type Locator, type Page } from '@playwright/test';
import { url } from '../support/env';
import { OrderTable } from './order-table';
import { WebShell } from './web-shell.page';

/** Page Object của Web khách hàng – trang Hồ sơ, bảng Lịch sử đơn hàng (riêng của FR-10). */
export class ProfilePage extends WebShell {
  readonly historyHeading: Locator;
  readonly orders: OrderTable;
  /** Link "Chào, <tên>" trên thanh điều hướng, chỉ có khi đã đăng nhập. Tên không cố định nên chọn theo đích /profile. */
  readonly profileLink: Locator;

  constructor(page: Page) {
    // Trang Hồ sơ hủy đơn qua PUT /api/orders/<id>/cancel.
    super(page, '/api/orders/\\d+/cancel$');
    this.historyHeading = page.getByRole('heading', { name: 'Lịch sử đơn hàng' });
    this.profileLink = page.getByRole('banner').locator('a[href="/profile"]');
    // Bảng Lịch sử đơn hàng: Mã ĐH | Ngày đặt | Tổng tiền | Trạng thái | Thao tác
    this.orders = new OrderTable(
      page,
      page.locator('table').filter({ has: page.getByRole('columnheader', { name: 'Mã ĐH' }) }),
    );
  }

  /**
   * Mở trang Hồ sơ bằng link trên thanh điều hướng (điều hướng trong SPA), KHÔNG dùng page.goto.
   * Lý do (B7, tìm ra trên WebKit khi tắt trace): ngay sau đăng nhập, trang gửi GET /api/users/me để kiểm phiên.
   * page.goto tải lại trang và hủy yêu cầu đó; trên WebKit, yêu cầu bị hủy đi vào nhánh lỗi của app và app XÓA
   * token khỏi localStorage, nên trang Hồ sơ hiện "Vui lòng đăng nhập". Bấm link thì trang không tải lại,
   * yêu cầu kiểm phiên chạy xong bình thường, giống người dùng thật.
   */
  async open() {
    await this.profileLink.click();
    await expect(this.page).toHaveURL(`${url('web')}/profile`);
    await expect(this.historyHeading).toBeVisible();
  }
}
