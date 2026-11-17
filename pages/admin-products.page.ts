import { expect, type Locator, type Page } from '@playwright/test';
import { AdminShell } from './admin-shell.page';

/** Một dòng của bảng sản phẩm: Tên đã gộp khoảng trắng, Giá là phần số của ô (bỏ ₫ và dấu phân cách). */
export type TableRow = { name: string; price: number };

/** Page Object của Web Admin – mục Sản phẩm (riêng của FR-15). Locator lấy theo bảng khảo sát B2. */
export class AdminProductsPage extends AdminShell {
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

  constructor(page: Page) {
    // Mục Sản phẩm ghi dữ liệu qua /api/products và /api/products/<id>.
    super(page, '/api/products(/|$)');

    this.productsNav = this.navItem('Sản phẩm');
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
}
