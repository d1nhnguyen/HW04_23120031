import { expect, type Locator, type Page } from '@playwright/test';

export const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:5174';

export type TableRow = { name: string; price: string };

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
    this.rows = page.locator('tbody tr');
    this.nameCells = page.locator('tbody tr td:nth-child(2)');
    this.priceCells = page.locator('tbody tr td:nth-child(3)');
  }

  async login(email: string, password: string) {
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

  /** Chụp bảng hiện tại (dùng ở bước Arrange, sau khi đã chờ bảng tải xong). */
  async readTable(): Promise<TableRow[]> {
    const names = await this.nameCells.allTextContents();
    const prices = await this.priceCells.allTextContents();
    return names.map((name, i) => ({ name, price: prices[i] }));
  }

  /** Chỉ điền các ô được truyền vào; ô không truyền thì không chạm. */
  async fillForm(fields: { name?: string; price?: string; category?: string }) {
    if (fields.name !== undefined) await this.nameInput.fill(fields.name);
    if (fields.price !== undefined) await this.priceInput.fill(fields.price);
    if (fields.category !== undefined) await this.categorySelect.selectOption({ label: fields.category });
  }

  async nameValueMissing(): Promise<boolean> {
    return this.nameInput.evaluate((el: HTMLInputElement) => el.validity.valueMissing);
  }
}
