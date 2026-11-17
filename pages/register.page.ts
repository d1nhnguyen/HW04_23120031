import { expect, type Locator, type Page } from '@playwright/test';
import { url } from '../support/env';
import type { FormProbe } from '../support/form-probe';
import { ProbedPage } from './probed-page';

/** Bốn ô của form Đăng ký theo đặc tả FR-01. */
export type RegisterField = 'name' | 'email' | 'password' | 'confirm';

/** Nhãn hiển thị của từng ô. Ba nhãn đầu quan sát ở B2; nhãn ô xác nhận lấy theo tên ô trong đặc tả (S4). */
const LABELS: Record<RegisterField, string> = {
  name: 'Họ Tên',
  email: 'Email',
  password: 'Mật khẩu',
  confirm: 'Xác nhận mật khẩu',
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Page Object của Web khách hàng – trang Đăng ký (riêng của FR-01). Locator lấy theo bảng khảo sát B2. */
export class RegisterPage extends ProbedPage {
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  /** Ô Xác nhận mật khẩu. Ở B2 ô này KHÔNG tồn tại: kiểm số phần tử trước khi chạm vào. */
  readonly confirmInput: Locator;
  readonly submitButton: Locator;
  /** Khung thông báo lỗi của trang (không phải bong bóng của trình duyệt). */
  readonly errorMessage: Locator;
  /** Vùng nội dung chính của trang, dùng để chụp bằng chứng. */
  readonly main: Locator;

  /** Hai phần tử chỉ có ở trang Đăng nhập (tiêu đề trang đó lại ghi "Đăng Ký" nên không dùng tiêu đề). */
  readonly loginSubmitButton: Locator;
  readonly forgotPasswordLink: Locator;

  readonly registerUrl: RegExp;
  readonly loginUrl: RegExp;

  constructor(page: Page) {
    // Form Đăng ký ghi dữ liệu qua POST /api/register.
    super(page, '/api/register$');

    this.heading = page.getByRole('heading', { name: 'Đăng Ký Tài Khoản' });
    this.nameInput = this.input('name');
    this.emailInput = this.input('email');
    this.passwordInput = this.input('password');
    this.confirmInput = this.input('confirm');
    this.submitButton = page.getByRole('button', { name: 'Đăng Ký', exact: true });
    this.errorMessage = page.locator('main div.bg-red-100');
    this.main = page.locator('main');

    this.loginSubmitButton = page.getByRole('button', { name: 'Sign In' });
    this.forgotPasswordLink = page.getByRole('link', { name: 'Quên mật khẩu?' });

    const base = escapeRegExp(url('web'));
    this.registerUrl = new RegExp(`^${base}/register/?$`);
    this.loginUrl = new RegExp(`^${base}/login/?$`);
  }

  /**
   * Ô nhập đứng NGAY SAU nhãn có đúng chuỗi chữ đó. Nhãn không gắn với ô bằng for / id và ô không có
   * name hay placeholder, nên không dùng được getByLabel.
   */
  private input(field: RegisterField): Locator {
    return this.page.locator(`form label:text-is("${LABELS[field]}") + input`);
  }

  async open() {
    await this.installProbe();
    await this.page.goto(`${url('web')}/register`);
    await expect(this.heading).toBeVisible();
    await expect(this.errorMessage, 'chưa có thông báo lỗi nào trước khi thao tác').toHaveCount(0);
  }

  /** Điền ba ô luôn có của form, đúng từng ký tự. */
  async fillForm(fields: { name: string; email: string; password: string }) {
    await this.nameInput.fill(fields.name);
    await this.emailInput.fill(fields.email);
    await this.passwordInput.fill(fields.password);
  }

  /** Các ô bị trình duyệt chặn (sự kiện `invalid`), tra từ nhãn mà bộ ghi dấu vết ghi lại. */
  blockedFields(probe: FormProbe): (RegisterField | 'unknown')[] {
    const fields = Object.keys(LABELS) as RegisterField[];
    return probe.invalidLabels.map((label) => fields.find((field) => LABELS[field] === label) ?? 'unknown');
  }

  /** Nguyên văn các thông báo lỗi đang hiện trên trang. */
  async errorMessages(): Promise<string[]> {
    return (await this.errorMessage.allTextContents()).map((text) => text.trim());
  }
}
