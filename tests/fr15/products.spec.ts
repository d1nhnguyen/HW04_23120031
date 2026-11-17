import { test as base, expect, type Response } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AdminProductsPage, type TableRow } from '../../pages/admin-products.page';
import { ProductsApi, type Product } from '../../support/products-api';

// ---------- Dữ liệu test: toàn bộ nằm trong data/fr15.products.json ----------

type NameSpec = { text?: string; unique?: boolean; length?: number; fill?: string; ref?: 'input' | 'setup' };

type Case = {
  id: string;
  title: string;
  op: 'add' | 'edit' | 'delete';
  bug: string | null;
  setup: null | { name: NameSpec; price: number; category: string; description: string; imageUrl: string };
  input: { name?: NameSpec; price?: string; category?: string };
  expected: {
    outcome: 'accept' | 'reject';
    formPrefill?: { name: NameSpec; price: string; category: string };
    ui: {
      rowCountDelta: number;
      row?: { present: boolean; name: NameSpec; price?: number; noHtmlElementInName?: string };
      othersUnchanged: boolean;
    };
    server: {
      countDelta: number;
      product?: { name: NameSpec; nameLength?: number; price: number; category: string; description?: string };
      productPresent?: boolean;
      othersUnchanged?: boolean;
    };
    alert: { shown: boolean | 'unspecified'; text?: string };
    validation?: { field: 'name'; state: 'valueMissing' };
  };
};

const data = JSON.parse(
  readFileSync(path.join(__dirname, '..', '..', 'data', 'fr15.products.json'), 'utf8'),
) as { meta: { admin: { email: string; password: string } }; cases: Case[] };

const RUN_BY = process.env.RUN_BY ?? '23120031';
/** Thời gian tối đa chờ giao diện gửi yêu cầu lưu / xóa sau khi bấm nút. */
const SETTLE_MS = 3000;

// ---------- Fixture: API + dọn dữ liệu theo id, chạy cả khi test fail ----------

const test = base.extend<{ api: ProductsApi }>({
  api: async ({ request }, use) => {
    const api = new ProductsApi(request);
    await api.login(data.meta.admin.email, data.meta.admin.password);
    const idsBefore = new Set((await api.list()).map((p) => p.id));

    await use(api);

    // Xóa mọi sản phẩm có id mới sinh trong test (kể cả sản phẩm tên rỗng / chỉ có khoảng trắng).
    for (const p of await api.list()) {
      if (!idsBefore.has(p.id)) await api.remove(p.id);
    }
  },
});

// ---------- Hàm hỗ trợ ----------

/** Sinh tên thật từ mô tả trong file dữ liệu. Hậu tố duy nhất nằm TRONG tổng độ dài. */
function resolveName(spec: NameSpec, uid: string, refs: { input?: string; setup?: string }): string {
  if (spec.ref) {
    const value = refs[spec.ref];
    if (value === undefined) throw new Error(`Không có tên để tham chiếu: ${spec.ref}`);
    return value;
  }
  if (spec.length !== undefined) {
    const fill = spec.fill ?? 'A';
    if (spec.length <= uid.length) throw new Error('Độ dài yêu cầu ngắn hơn hậu tố duy nhất');
    return fill.repeat(spec.length - uid.length) + uid;
  }
  const text = spec.text ?? '';
  return spec.unique ? `${text} ${uid}` : text;
}

/** Ô Giá trên bảng: so phần số, bỏ qua ký hiệu ₫ và dấu phân cách hàng nghìn. */
function priceCellPattern(price: number): RegExp {
  const digits = String(price).replace('-', '').split('').join('[.,\\s]?');
  const sign = price < 0 ? '-' : '';
  return new RegExp(`^\\s*${sign}${digits}\\s*₫?\\s*$`);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Yêu cầu ghi (POST / PUT / DELETE) tới /api/products. */
function isProductMutation(res: Response): boolean {
  const { pathname } = new URL(res.url());
  return /\/api\/products(\/[^/]+)?$/.test(pathname) && res.request().method() !== 'GET';
}

function isProductListRefresh(res: Response): boolean {
  return new URL(res.url()).pathname.endsWith('/api/products') && res.request().method() === 'GET';
}

// ---------- 15 test sinh từ file dữ liệu ----------

test.describe('FR-15 Quản lý sản phẩm – Web Admin', () => {
  for (const c of data.cases) {
    test(`${c.id} – ${c.title}`, async ({ page, api }, testInfo) => {
      testInfo.annotations.push(
        { type: 'Run by', description: `${RUN_BY} · ${new Date().toISOString()}` },
        { type: 'Bug', description: c.bug ?? 'không (kỳ vọng pass)' },
      );
      const soft = expect.configure({ soft: true });
      const uid = `${testInfo.project.name.slice(0, 2)}${Date.now().toString(36)}`;

      // ===== Arrange =====
      const categories = await api.categories();
      const categoryId = (label: string) => {
        const found = categories.find((cat) => cat.name === label);
        if (!found) throw new Error(`Không có danh mục "${label}" trong SUT`);
        return found.id;
      };

      const refs: { input?: string; setup?: string } = {};
      let setupProduct: Product | undefined;
      if (c.setup) {
        refs.setup = resolveName(c.setup.name, uid, refs);
        setupProduct = await api.create({
          name: refs.setup,
          price: c.setup.price,
          description: c.setup.description,
          imageUrl: c.setup.imageUrl,
          category_id: categoryId(c.setup.category),
        });
      }
      if (c.input.name) refs.input = resolveName(c.input.name, uid, refs);

      // Chụp phía server trước thao tác (sau khi đã tạo sản phẩm setup).
      const serverBefore = await api.list();

      const admin = new AdminProductsPage(page);
      await admin.login(data.meta.admin.email, data.meta.admin.password);
      await admin.openProducts();
      await expect(admin.rows).toHaveCount(serverBefore.length);
      const tableBefore = await admin.readTable();

      // Ghi vị trí dòng của sản phẩm setup TRƯỚC khi thao tác (sau khi Sửa không tìm theo tên được nữa).
      let targetIndex = -1;
      if (setupProduct) {
        targetIndex = tableBefore.findIndex((r) => r.name === refs.setup);
        expect(targetIndex, 'sản phẩm setup phải có trên bảng').toBeGreaterThanOrEqual(0);
        await expect(admin.nameCell(targetIndex)).toHaveText(refs.setup!);
      }

      // ===== Act =====
      const mutation = page.waitForResponse(isProductMutation, { timeout: SETTLE_MS }).catch(() => null);
      const refresh = page.waitForResponse(isProductListRefresh, { timeout: SETTLE_MS * 2 }).catch(() => null);

      if (c.op === 'add') {
        await expect(admin.addModeHeading).toBeVisible();
        await admin.fillForm({ name: refs.input, price: c.input.price, category: c.input.category });
      }
      if (c.op === 'edit') {
        await admin.editButton(targetIndex).click();
        await expect(admin.editModeHeading).toBeVisible();
        if (c.expected.formPrefill) {
          const prefill = c.expected.formPrefill;
          await soft(admin.nameInput).toHaveValue(resolveName(prefill.name, uid, refs));
          await soft(admin.priceInput).toHaveValue(prefill.price);
          await soft(admin.categorySelect).toHaveValue(String(categoryId(prefill.category)));
        }
        await admin.fillForm({ name: refs.input, price: c.input.price, category: c.input.category });
      }

      // Case biên độ dài: ô Tên phải giữ đúng chuỗi đã sinh (không bị cắt bớt).
      if (c.input.name?.length !== undefined) {
        expect([...refs.input!].length, 'độ dài tên script sinh ra').toBe(c.input.name.length);
        await expect(admin.nameInput).toHaveValue(refs.input!);
      }

      await admin.resetProbe();
      if (c.op === 'delete') {
        await admin.deleteButton(targetIndex).click();
      } else {
        await admin.saveButton.click();
      }

      // Chờ giao diện gửi yêu cầu (nếu có). Thêm / Xóa thành công KHÔNG có alert nên không chờ dialog.
      const mutationResponse = await mutation;
      if (mutationResponse && c.op !== 'edit') await refresh; // Thêm / Xóa: giao diện tải lại danh sách

      // ===== Assert =====

      // 1. Yêu cầu thực gửi đi
      if (c.expected.outcome === 'accept') {
        expect(mutationResponse, 'giao diện phải gửi yêu cầu lưu / xóa').not.toBeNull();
        soft(
          mutationResponse!.ok(),
          `yêu cầu hợp lệ phải được server chấp nhận (2xx), thực tế trả ${mutationResponse!.status()}`,
        ).toBe(true);
      }
      if (c.expected.outcome === 'reject' && mutationResponse) {
        soft(
          mutationResponse.status(),
          `SUT đã NHẬN dữ liệu sai: ${mutationResponse.request().method()} /api/products trả ` +
            `${mutationResponse.status()}, theo đặc tả phải từ chối (4xx)`,
        ).toBeGreaterThanOrEqual(400);
      }
      if (c.expected.validation) {
        // Trình duyệt đã chặn: ô bắt buộc nhận sự kiện `invalid`, form không được submit, không có yêu cầu ghi.
        const blockedField = await admin.nameInput.getAttribute('placeholder');
        const probe = await admin.readProbe();
        expect(probe.invalid, 'trình duyệt phải báo ô Tên bỏ trống là không hợp lệ').toEqual([blockedField]);
        expect(probe.submit, 'form không được submit khi ô bắt buộc bỏ trống').toBe(0);
        expect(mutationResponse, 'không được gửi yêu cầu ghi khi ô bắt buộc bỏ trống').toBeNull();
        // Form giữ nguyên trạng thái: ô Tên vẫn rỗng, ô Giá còn giá trị, vẫn ở đúng chế độ.
        await soft(admin.nameInput).toHaveValue('');
        await soft(admin.priceInput).toHaveValue(c.input.price ?? String(c.setup!.price));
        await soft(c.op === 'edit' ? admin.editModeHeading : admin.addModeHeading).toBeVisible();
      }
      if (c.input.name?.length !== undefined && mutationResponse) {
        const sent = mutationResponse.request().postDataJSON() as { name: string };
        soft([...sent.name].length, 'độ dài tên thực gửi tới server').toBe(c.input.name.length);
      }

      // 2. Giao diện (soft, không tải lại trang): dựng bảng mong đợi từ bảng trước thao tác
      const expectedTable: { name: string; price: RegExp }[] = tableBefore.map((r: TableRow) => ({
        name: r.name,
        price: new RegExp(`^${escapeRegExp(r.price)}$`),
      }));
      const uiRow = c.expected.ui.row;
      if (uiRow) {
        const rowName = resolveName(uiRow.name, uid, refs);
        if (c.op === 'add' && uiRow.present) {
          // Giả định: sản phẩm mới nằm cuối bảng (thứ tự theo id tăng dần).
          expectedTable.push({ name: rowName, price: priceCellPattern(uiRow.price!) });
        }
        if (c.op === 'edit' && uiRow.present) {
          expectedTable[targetIndex] = { name: rowName, price: priceCellPattern(uiRow.price!) };
        }
        if (c.op === 'delete' && !uiRow.present) {
          expectedTable.splice(targetIndex, 1);
        }
      }
      await soft(admin.rows).toHaveCount(tableBefore.length + c.expected.ui.rowCountDelta);
      await soft(admin.nameCells).toHaveText(expectedTable.map((r) => r.name));
      await soft(admin.priceCells).toHaveText(expectedTable.map((r) => r.price));
      if (uiRow?.noHtmlElementInName) {
        const index = expectedTable.length - 1;
        await soft(admin.nameCell(index).locator(uiRow.noHtmlElementInName)).toHaveCount(0);
      }

      // 3. Alert
      if (c.expected.alert.shown === true) {
        await soft.poll(() => admin.dialogs).toEqual([c.expected.alert.text]);
      }
      if (c.expected.alert.shown === false) {
        soft(admin.dialogs, 'không được có alert').toEqual([]);
      }

      // 4. Phía server (expect cứng): chụp lại toàn bộ danh sách và so sánh
      const serverAfter = await api.list();
      const idsBefore = new Set(serverBefore.map((p) => p.id));
      const created = serverAfter.filter((p) => !idsBefore.has(p.id));
      const targetId = setupProduct?.id;

      expect(serverAfter.length - serverBefore.length, 'số sản phẩm phía server thay đổi').toBe(
        c.expected.server.countDelta,
      );

      if (c.expected.server.othersUnchanged) {
        const others = (list: Product[]) =>
          list.filter((p) => p.id !== targetId && idsBefore.has(p.id));
        expect(others(serverAfter), 'các sản phẩm khác phía server giữ nguyên').toEqual(others(serverBefore));
      }

      const expectedProduct = c.expected.server.product;
      if (expectedProduct) {
        const actual = c.op === 'add' ? created[0] : serverAfter.find((p) => p.id === targetId);
        expect(actual, 'sản phẩm đích phải tồn tại phía server').toBeDefined();
        expect(actual!.name).toBe(resolveName(expectedProduct.name, uid, refs));
        expect(actual!.price).toBe(expectedProduct.price);
        expect(Number(actual!.category_id)).toBe(categoryId(expectedProduct.category));
        if (expectedProduct.nameLength !== undefined) {
          expect([...actual!.name].length).toBe(expectedProduct.nameLength);
        }
        if (expectedProduct.description !== undefined) {
          expect(actual!.description).toBe(expectedProduct.description);
        }
      }
      if (c.expected.server.productPresent === false) {
        expect(serverAfter.some((p) => p.id === targetId), 'sản phẩm đã xóa không còn phía server').toBe(false);
      }
    });
  }
});
