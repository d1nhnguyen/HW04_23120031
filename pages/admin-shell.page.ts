import { expect, type Locator, type Page } from '@playwright/test';
import { url, type Account } from '../support/env';
import { installFormProbe, readProbe, resetProbe, waitUntilSettled, type FormProbe } from '../support/form-probe';

/**
 * Phần dùng chung của mọi Page Object trên Web Admin: đăng nhập, thanh bên, hộp thoại, bộ ghi dấu vết.
 * Page Object của từng mục (Sản phẩm, Đơn hàng…) kế thừa lớp này.
 */
export class AdminShell {
  /** Nguyên văn mọi alert / confirm đã bật, theo thứ tự. */
  readonly dialogs: string[] = [];

  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly appHeading: Locator;

  private probeInstalled = false;

  /**
   * @param writePattern mẫu regex của URL mà mục này ghi dữ liệu, ví dụ '/api/products(/|$)'.
   */
  constructor(
    readonly page: Page,
    private readonly writePattern: string,
  ) {
    // Đăng ký trước mọi thao tác: Admin báo kết quả bằng alert(), không xử lý thì trang treo.
    page.on('dialog', async (dialog) => {
      this.dialogs.push(dialog.message());
      await dialog.accept();
    });

    this.emailInput = page.getByPlaceholder('Email');
    this.passwordInput = page.getByPlaceholder('Password');
    this.loginButton = page.getByRole('button', { name: 'Login' });
    this.appHeading = page.getByRole('heading', { name: 'EShop Admin' });
  }

  /** Cài bộ ghi dấu vết vào trang. Phải xong TRƯỚC khi mở trang, nên được await ở đầu login(). */
  private async installProbe() {
    if (this.probeInstalled) return;
    await installFormProbe(this.page, this.writePattern);
    this.probeInstalled = true;
  }

  async login(account: Account) {
    await this.installProbe();
    await this.page.goto(url('admin'));
    await this.emailInput.fill(account.email);
    await this.passwordInput.fill(account.password);
    await this.loginButton.click();
    await expect(this.appHeading).toBeVisible();
  }

  /** Mục ở thanh bên là <li> có onClick, không phải link hay button; khớp đúng cả chuỗi nhãn. */
  navItem(label: string): Locator {
    const exact = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    return this.page.getByRole('listitem').filter({ hasText: exact });
  }

  async openSection(label: string, heading: string) {
    await this.navItem(label).click();
    await expect(this.page.getByRole('heading', { name: heading })).toBeVisible();
  }

  resetProbe(): Promise<void> {
    return resetProbe(this.page);
  }

  readProbe(): Promise<FormProbe> {
    return readProbe(this.page);
  }

  waitUntilSettled(): Promise<void> {
    return waitUntilSettled(this.page);
  }
}
