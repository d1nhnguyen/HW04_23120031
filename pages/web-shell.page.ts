import { expect, type Locator, type Page } from '@playwright/test';
import { url, type Account } from '../support/env';
import { escapeRegExp } from '../support/regexp';
import { ProbedPage } from './probed-page';

/**
 * Phần dùng chung của Page Object trên Web khách hàng có đăng nhập: form Đăng nhập.
 * Nhãn "Username" và nút "Sign In" là chữ thật trên trang (quan sát ở B2 của FR-01, FR-10).
 * Nhãn không gắn với ô (không for / id) nên chọn ô nằm ngay sau nhãn.
 */
export class WebShell extends ProbedPage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;

  constructor(page: Page, writePattern: string) {
    super(page, writePattern);
    this.usernameInput = page.locator('form label:text-is("Username") + input');
    this.passwordInput = page.locator('form label:text-is("Mật khẩu") + input');
    this.signInButton = page.getByRole('button', { name: 'Sign In' });
  }

  /** Đăng nhập qua giao diện. Đăng nhập thành công thì trang chuyển về trang chủ. */
  async login(account: Account) {
    await this.installProbe();
    await this.page.goto(`${url('web')}/login`);
    await this.usernameInput.fill(account.email);
    await this.passwordInput.fill(account.password);
    await this.signInButton.click();
    await expect(this.page, 'đăng nhập Web phải chuyển về trang chủ').toHaveURL(
      new RegExp(`^${escapeRegExp(url('web'))}/?$`),
    );
  }
}
