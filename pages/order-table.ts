import type { Locator, Page } from '@playwright/test';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Bảng đơn hàng dùng chung cho Web Admin (mục Đơn hàng) và trang Hồ sơ (Lịch sử đơn hàng).
 * Cả hai bảng: ô đầu tiên của dòng là "#<mã đơn>", có một cột "Trạng thái", nút thao tác nằm trong dòng.
 * Dòng luôn được tìm theo mã đơn, không theo vị trí: bảng dài thêm qua mỗi test vì không xóa được đơn.
 */
export class OrderTable {
  readonly rows: Locator;

  constructor(
    private readonly page: Page,
    readonly table: Locator,
  ) {
    this.rows = table.locator('tbody tr');
  }

  /** Dòng có ô đầu khớp ĐÚNG "#<id>" (không khớp #1 với #12). */
  row(id: number): Locator {
    return this.rows.filter({ has: this.page.locator('td:first-child', { hasText: new RegExp(`^#${id}$`) }) });
  }

  /** Mọi nút thao tác trong dòng của đơn `id`. */
  buttons(id: number): Locator {
    return this.row(id).getByRole('button');
  }

  button(id: number, label: string): Locator {
    return this.row(id).getByRole('button', { name: label, exact: true });
  }

  /** Vị trí cột "Trạng thái", tra theo tiêu đề cột để không phụ thuộc thứ tự cột. */
  private async statusColumn(): Promise<number> {
    const headers = (await this.table.getByRole('columnheader').allTextContents()).map((h) => h.trim());
    const index = headers.indexOf('Trạng thái');
    if (index < 0) throw new Error(`Bảng đơn không có cột "Trạng thái": [${headers.join(', ')}]`);
    return index;
  }

  async statusCell(id: number): Promise<Locator> {
    return this.row(id).getByRole('cell').nth(await this.statusColumn());
  }

  /** Nhãn trạng thái của mọi dòng đang hiển thị, theo mã đơn. */
  async readStatuses(): Promise<Record<string, string>> {
    const column = await this.statusColumn();
    const out: Record<string, string> = {};
    for (const row of await this.rows.all()) {
      const cells = row.getByRole('cell');
      const id = (await cells.first().textContent())?.trim() ?? '';
      out[id] = (await cells.nth(column).textContent())?.trim() ?? '';
    }
    return out;
  }
}

export { escapeRegExp };
