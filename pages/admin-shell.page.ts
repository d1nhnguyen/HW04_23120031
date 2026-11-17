import { expect, type Locator, type Page } from '@playwright/test';
import { url, type Account } from '../support/env';
import { ProbedPage } from './probed-page';

/**
 * Phần dùng chung của mọi Page Object trên Web Admin: đăng nhập, thanh bên, hộp thoại, bộ ghi dấu vết.
 * Page Object của từng mục (Sản phẩm, Đơn hàng…) kế thừa lớp này.
 */
export class AdminShell extends ProbedPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly appHeading: Locator;

  /**
   * @param writePattern mẫu regex của URL mà mục này ghi dữ liệu, ví dụ '/api/products(/|$)'.
   */
  constructor(page: Page, writePattern: string) {
    super(page, writePattern);

    this.emailInput = page.getByPlaceholder('Email');
    this.passwordInput = page.getByPlaceholder('Password');
    this.loginButton = page.getByRole('button', { name: 'Login' });
    this.appHeading = page.getByRole('heading', { name: 'EShop Admin' });
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
}
