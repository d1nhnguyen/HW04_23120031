import { expect, type Locator, type Page } from '@playwright/test';

export const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:5174';

/** Một dòng của bảng sản phẩm: Tên đã gộp khoảng trắng, Giá là phần số của ô (bỏ ₫ và dấu phân cách). */
export type TableRow = { name: string; price: number };

/** Dấu vết ghi trong trang: trình duyệt có chặn form hay form đã được submit. */
export type FormProbe = {
  /** placeholder của các ô bị trình duyệt báo không hợp lệ (sự kiện `invalid`). */
  invalid: string[];
  /** số lần form thực sự được submit (sự kiện `submit`). */
  submit: number;
  /** số yêu cầu ghi (không phải GET) tới /api/products mà trang đã gửi. */
  sent: number;
  /** số XHR đang chờ phản hồi; 0 nghĩa là trang không còn chờ server. */
  pending: number;
};

/**
 * Chạy TRONG trang trước mọi script của SUT. Ghi lại:
 * - sự kiện `invalid` và `submit` (đã kiểm trên Chromium, Firefox, WebKit ở B6: khi ô bắt buộc bỏ trống,
 *   trình duyệt bắn `invalid` vào ô đó và KHÔNG bắn `submit`);
 * - số yêu cầu ghi tới /api/products và số XHR còn đang chờ.
 */
function installFormProbe() {
  const probe = { invalid: [] as string[], submit: 0, sent: 0, pending: 0 };
  (window as unknown as { __formProbe: typeof probe }).__formProbe = probe;
  // Trang gọi server bằng XHR (axios). Đếm yêu cầu ghi và số XHR còn đang chờ.
  type TrackedXhr = XMLHttpRequest & { __method?: string; __url?: string };
  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (this: TrackedXhr, method: string, url: string | URL) {
    this.__method = method.toUpperCase();
    this.__url = String(url);
    // eslint-disable-next-line prefer-rest-params
    return open.apply(this, arguments as unknown as Parameters<typeof open>);
  } as typeof open;
  XMLHttpRequest.prototype.send = function (this: TrackedXhr, body?: Document | XMLHttpRequestBodyInit | null) {
    probe.pending++;
    if (this.__method !== 'GET' && /\/api\/products(\/|$)/.test(this.__url ?? '')) probe.sent++;
    this.addEventListener('loadend', () => probe.pending--);
    return send.call(this, body);
  };
  document.addEventListener(
    'invalid',
    (event) => probe.invalid.push((event.target as HTMLInputElement).placeholder),
    true,
  );
  document.addEventListener('submit', () => probe.submit++, true);
}

/** Page Object của Web Admin – mục Sản phẩm. Locator lấy theo bảng khảo sát B2. */
export class AdminProductsPage {
  /** Nguyên văn mọi alert / confirm đã bật, theo thứ tự. */
  readonly dialogs: string[] = [];

  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly appHeading: Locator;
  readonly productsNav: Locator;
  readonly productsHeading: Locator;

  readonly nameInput: Locator;
  readonly priceInput: Locator;
  readonly imageUrlInput: Locator;
  readonly descriptionInput: Locator;
  readonly categorySelect: Locator;
  readonly saveButton: Locator;
  readonly addModeHeading: Locator;
  readonly editModeHeading: Locator;

  /** Bảng sản phẩm (không phải bảng xem trước của phần Import CSV). */
  readonly table: Locator;
  readonly rows: Locator;
  readonly nameCells: Locator;
  readonly priceCells: Locator;

  constructor(readonly page: Page) {
    // Đăng ký trước mọi thao tác: Admin báo kết quả bằng alert(), không xử lý thì trang treo.
    page.on('dialog', async (dialog) => {
      this.dialogs.push(dialog.message());
      await dialog.accept();
    });

    this.emailInput = page.getByPlaceholder('Email');
    this.passwordInput = page.getByPlaceholder('Password');
    this.loginButton = page.getByRole('button', { name: 'Login' });
    this.appHeading = page.getByRole('heading', { name: 'EShop Admin' });
    // Mục ở thanh bên là <li> có onClick, không phải link hay button.
    this.productsNav = page.getByRole('listitem').filter({ hasText: /^Sản phẩm$/ });
    this.productsHeading = page.getByRole('heading', { name: 'Quản lý Sản phẩm' });

    this.nameInput = page.getByPlaceholder('Tên sản phẩm');
    this.priceInput = page.getByPlaceholder('Giá tiền');
    this.imageUrlInput = page.getByPlaceholder('URL Ảnh');
    this.descriptionInput = page.getByPlaceholder('Mô tả');
    this.categorySelect = page.getByRole('combobox');
    this.saveButton = page.getByRole('button', { name: 'Lưu sản phẩm' });
    this.addModeHeading = page.getByRole('heading', { name: 'Thêm sản phẩm mới' });
    this.editModeHeading = page.getByRole('heading', { name: 'Sửa sản phẩm' });

    // Bảng sản phẩm: Ảnh | Tên SP | Giá | Hành động
    this.table = page.locator('table').filter({ has: page.getByRole('columnheader', { name: 'Tên SP' }) });
    this.rows = page.locator('tbody tr');
    this.nameCells = page.locator('tbody tr td:nth-child(2)');
    this.priceCells = page.locator('tbody tr td:nth-child(3)');
  }

  private probeInstalled = false;

  /** Cài bộ ghi dấu vết vào trang. Phải xong TRƯỚC khi mở trang, nên được await ở đầu login(). */
  private async installProbe() {
    if (this.probeInstalled) return;
    await this.page.addInitScript(installFormProbe);
    this.probeInstalled = true;
  }

  async login(email: string, password: string) {
    await this.installProbe();
    await this.page.goto(ADMIN_URL);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await expect(this.appHeading).toBeVisible();
  }

  async openProducts() {
    await this.productsNav.click();
    await expect(this.productsHeading).toBeVisible();
  }

  row(index: number): Locator {
    return this.rows.nth(index);
  }

  nameCell(index: number): Locator {
    return this.row(index).getByRole('cell').nth(1);
  }

  editButton(index: number): Locator {
    return this.row(index).getByRole('button', { name: 'Sửa' });
  }

  deleteButton(index: number): Locator {
    return this.row(index).getByRole('button', { name: 'Xóa' });
  }

  /** Các dòng có ô Tên khớp ĐÚNG cả chuỗi `name`. */
  rowsNamed(name: string): Locator {
    const exact = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    return this.rows.filter({ has: this.page.locator('td:nth-child(2)', { hasText: exact }) });
  }

  /** Chụp bảng hiện tại theo đúng thứ tự hiển thị. */
  async readTable(): Promise<TableRow[]> {
    const names = await this.nameCells.allTextContents();
    const prices = await this.priceCells.allTextContents();
    return names.map((name, i) => ({
      name: name.replace(/\s+/g, ' ').trim(),
      price: Number((prices[i] ?? '').replace(/[^\d-]/g, '')),
    }));
  }

  /** Chỉ điền các ô được truyền vào; ô không truyền thì không chạm. */
  async fillForm(fields: { name?: string; price?: string; category?: string }) {
    if (fields.name !== undefined) await this.nameInput.fill(fields.name);
    if (fields.price !== undefined) await this.priceInput.fill(fields.price);
    if (fields.category !== undefined) await this.categorySelect.selectOption({ label: fields.category });
  }

  /** Xóa dấu vết cũ (ví dụ lần submit của form đăng nhập) ngay trước thao tác cần kiểm. */
  async resetProbe() {
    await this.page.evaluate(() => {
      const probe = (window as unknown as { __formProbe: FormProbe }).__formProbe;
      probe.invalid = [];
      probe.submit = 0;
      probe.sent = 0;
    });
  }

  /**
   * Chờ trang nói chuyện xong với server rồi vẽ lại. Không dùng thời gian cố định:
   * - Yêu cầu lưu / xóa được gửi ngay trong lượt xử lý cú click, nên sau click `pending` đã > 0 nếu có gửi.
   * - Các lệnh tải lại danh sách nối tiếp nhau trong cùng chuỗi promise, nên `pending` chỉ về 0 khi xong hết.
   * - Nếu trình duyệt chặn form thì `pending` vẫn là 0 và hàm trả về ngay.
   */
  async waitUntilSettled() {
    await this.page.waitForFunction(
      () => (window as unknown as { __formProbe: FormProbe }).__formProbe.pending === 0,
    );
    await this.page.evaluate(
      () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
    );
  }

  async readProbe(): Promise<FormProbe> {
    return this.page.evaluate(() => {
      const probe = (window as unknown as { __formProbe: FormProbe }).__formProbe;
      return { invalid: [...probe.invalid], submit: probe.submit, sent: probe.sent, pending: probe.pending };
    });
  }
}
