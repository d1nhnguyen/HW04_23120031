import { test as base, expect, type Page, type Request, type Response, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AdminProductsPage, type FormProbe, type TableRow } from '../../pages/admin-products.page';
import { ProductsApi, type Product } from '../../support/products-api';

// ---------- Dữ liệu test: toàn bộ nằm trong data/fr15.products.json ----------

type NameSpec = { text?: string; unique?: boolean; length?: number; fill?: string; ref?: 'input' | 'setup' };

type Case = {
  id: string;
  title: string;
  op: 'add' | 'edit' | 'delete';
  bug: string[];
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
    validation?: { field: 'name'; blockedBy: 'browser-required' };
  };
};

const data = JSON.parse(
  readFileSync(path.join(__dirname, '..', '..', 'data', 'fr15.products.json'), 'utf8'),
) as { meta: { admin: { email: string; password: string } }; cases: Case[] };

const RUN_BY = process.env.RUN_BY ?? '23120031';

/**
 * Thời gian thử lại của assertion giao diện SAU khi trang đã xong việc với server và đã vẽ lại
 * (xem AdminProductsPage.waitUntilSettled). Lúc đó DOM đã ở trạng thái cuối, nên assertion nào sai
 * thì chờ thêm cũng không đúng lên; không cần chờ đủ 5 giây mặc định.
 */
const UI_AFTER_SETTLED = { timeout: 1000 };

const soft = expect.configure({ soft: true });

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

type Refs = { input?: string; setup?: string };

/** Sinh tên thật từ mô tả trong file dữ liệu. Hậu tố duy nhất nằm TRONG tổng độ dài. */
function resolveName(spec: NameSpec, uid: string, refs: Refs): string {
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

/** Yêu cầu ghi (POST / PUT / DELETE) tới /api/products. */
function isProductWrite(req: Request): boolean {
  const { pathname } = new URL(req.url());
  return /\/api\/products(\/[^/]+)?$/.test(pathname) && req.method() !== 'GET';
}

/** Sắp xếp để so hai bảng mà không phụ thuộc thứ tự dòng. */
function sorted(rows: TableRow[]): TableRow[] {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

// ---------- Ba bước của một test ----------

type Context = {
  c: Case;
  admin: AdminProductsPage;
  api: ProductsApi;
  uid: string;
  refs: Refs;
  categoryId: (label: string) => number;
  /** Sản phẩm tạo qua API cho case Sửa / Xóa. */
  setupProduct?: Product;
  /** Danh sách phía server ngay trước thao tác. */
  serverBefore: Product[];
  /** Bảng trên giao diện ngay trước thao tác. */
  tableBefore: TableRow[];
  /** Vị trí dòng của sản phẩm setup, ghi TRƯỚC khi thao tác. */
  targetIndex: number;
  /** Mọi yêu cầu ghi tới /api/products mà Playwright thấy từ đầu test. */
  writes: Request[];
};

type ActResult = {
  /** Dấu vết trong trang ngay sau thao tác. */
  probe: FormProbe;
  /** Phản hồi của yêu cầu ghi; null nếu giao diện không gửi yêu cầu nào. */
  response: Response | null;
};

/** ARRANGE: dựng dữ liệu qua API, đăng nhập, mở mục Sản phẩm, chụp trạng thái trước thao tác. */
async function arrange(c: Case, page: Page, api: ProductsApi, testInfo: TestInfo): Promise<Context> {
  const uid = `${testInfo.project.name.slice(0, 2)}${Date.now().toString(36)}`;

  const writes: Request[] = [];
  page.on('request', (req) => {
    if (isProductWrite(req)) writes.push(req);
  });

  const categories = await api.categories();
  const categoryId = (label: string) => {
    const found = categories.find((cat) => cat.name === label);
    if (!found) throw new Error(`Không có danh mục "${label}" trong SUT`);
    return found.id;
  };

  const refs: Refs = {};
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

  const serverBefore = await api.list();

  const admin = new AdminProductsPage(page);
  await admin.login(data.meta.admin.email, data.meta.admin.password);
  await admin.openProducts();
  await expect(admin.rows, 'bảng phải tải đủ sản phẩm trước khi thao tác').toHaveCount(serverBefore.length);
  const tableBefore = await admin.readTable();

  let targetIndex = -1;
  if (setupProduct) {
    targetIndex = tableBefore.findIndex((r) => r.name === refs.setup);
    expect(targetIndex, 'sản phẩm setup phải có trên bảng').toBeGreaterThanOrEqual(0);
  }

  return { c, admin, api, uid, refs, categoryId, setupProduct, serverBefore, tableBefore, targetIndex, writes };
}

/** ACT: thực hiện đúng một thao tác Thêm / Sửa / Xóa rồi chờ trang ổn định. */
async function act(ctx: Context): Promise<ActResult> {
  const { c, admin, refs, uid, targetIndex, writes } = ctx;
  const touched = { name: refs.input, price: c.input.price, category: c.input.category };

  if (c.op === 'add') {
    await expect(admin.addModeHeading, 'form phải ở chế độ Thêm').toBeVisible();
    await admin.fillForm(touched);
  }
  if (c.op === 'edit') {
    await admin.editButton(targetIndex).click();
    await expect(admin.editModeHeading, 'form phải chuyển sang chế độ Sửa').toBeVisible();
    if (c.expected.formPrefill) {
      const prefill = c.expected.formPrefill;
      await soft(admin.nameInput, 'form Sửa phải điền sẵn đúng Tên').toHaveValue(resolveName(prefill.name, uid, refs));
      await soft(admin.priceInput, 'form Sửa phải điền sẵn đúng Giá').toHaveValue(prefill.price);
      await soft(admin.categorySelect, `form Sửa phải điền sẵn Danh mục "${prefill.category}"`).toHaveValue(
        String(ctx.categoryId(prefill.category)),
      );
    }
    await admin.fillForm(touched);
  }

  // Case biên độ dài: ô Tên phải giữ đúng chuỗi đã sinh (không bị cắt bớt).
  if (c.input.name?.length !== undefined) {
    expect([...refs.input!].length, 'độ dài tên do script sinh ra').toBe(c.input.name.length);
    await expect(admin.nameInput, `ô Tên phải giữ đủ ${c.input.name.length} ký tự đã nhập`).toHaveValue(refs.input!);
  }

  await admin.resetProbe();
  if (c.op === 'delete') {
    await admin.deleteButton(targetIndex).click();
  } else {
    await admin.saveButton.click();
  }

  // Chờ trang xong việc với server (trả về ngay nếu không có yêu cầu nào). Không chờ dialog:
  // Thêm / Xóa thành công KHÔNG có alert.
  await admin.waitUntilSettled();
  const probe = await admin.readProbe();
  // Hai nguồn ghi nhận phải khớp nhau: trong trang (XHR) và phía Playwright (page.on('request')).
  await expect
    .poll(() => writes.length, { message: 'số yêu cầu ghi Playwright thấy phải khớp số trang đã gửi' })
    .toBe(probe.sent);
  const response = writes.length > 0 ? await writes[writes.length - 1].response() : null;

  return { probe, response };
}

/** ASSERT giao diện (soft, không tải lại trang): form, bảng, alert. */
async function assertUi(ctx: Context, result: ActResult) {
  const { c, admin, refs, uid, tableBefore, targetIndex } = ctx;

  // Form bị trình duyệt chặn: ô bắt buộc nhận sự kiện `invalid`, form không được submit, form giữ nguyên.
  if (c.expected.validation) {
    const blockedField = await admin.nameInput.getAttribute('placeholder');
    soft(result.probe.invalid, 'trình duyệt phải báo ô Tên bỏ trống là không hợp lệ').toEqual([blockedField]);
    soft(result.probe.submit, 'form không được submit khi ô bắt buộc bỏ trống').toBe(0);
    await soft(admin.nameInput, 'ô Tên vẫn rỗng sau khi bị chặn').toHaveValue('', UI_AFTER_SETTLED);
    await soft(admin.priceInput, 'ô Giá còn nguyên giá trị sau khi bị chặn').toHaveValue(
      c.input.price ?? String(c.setup!.price),
      UI_AFTER_SETTLED,
    );
    await soft(
      c.op === 'edit' ? admin.editModeHeading : admin.addModeHeading,
      'form vẫn ở nguyên chế độ sau khi bị chặn',
    ).toBeVisible(UI_AFTER_SETTLED);
  }

  // Bảng mong đợi = bảng trước thao tác + thay đổi mà đặc tả cho phép.
  const expectedTable: TableRow[] = tableBefore.map((r) => ({ ...r }));
  const uiRow = c.expected.ui.row;
  const rowName = uiRow ? resolveName(uiRow.name, uid, refs) : undefined;
  if (uiRow && c.op === 'add' && uiRow.present) expectedTable.push({ name: rowName!, price: uiRow.price! });
  if (uiRow && c.op === 'edit' && uiRow.present) expectedTable[targetIndex] = { name: rowName!, price: uiRow.price! };
  if (uiRow && c.op === 'delete' && !uiRow.present) expectedTable.splice(targetIndex, 1);

  const expectedCount = tableBefore.length + c.expected.ui.rowCountDelta;
  await soft(
    admin.rows,
    `bảng phải có ${expectedCount} dòng (trước thao tác ${tableBefore.length}, thay đổi ${c.expected.ui.rowCountDelta})`,
  ).toHaveCount(expectedCount, UI_AFTER_SETTLED);

  // So không phụ thuộc thứ tự: đặc tả không quy định sản phẩm mới nằm ở đâu trong bảng.
  await soft
    .poll(async () => sorted(await admin.readTable()), {
      ...UI_AFTER_SETTLED,
      message:
        'Tên và Giá của mọi dòng trên bảng (không xét thứ tự) phải đúng: ' +
        'dòng đích theo kết quả mong đợi, các dòng khác giữ nguyên',
    })
    .toEqual(sorted(expectedTable));

  if (uiRow?.present && rowName !== undefined) {
    await soft(admin.rowsNamed(rowName), `phải có đúng một dòng mang tên "${rowName.slice(0, 40)}"`).toHaveCount(
      1,
      UI_AFTER_SETTLED,
    );
  }
  if (uiRow?.noHtmlElementInName && rowName !== undefined) {
    await soft(
      admin.rowsNamed(rowName).locator(`td:nth-child(2) ${uiRow.noHtmlElementInName}`),
      `Tên phải hiển thị nguyên văn, không được sinh thẻ <${uiRow.noHtmlElementInName}>`,
    ).toHaveCount(0, UI_AFTER_SETTLED);
  }

  if (c.expected.alert.shown === true) {
    await soft
      .poll(() => admin.dialogs, { ...UI_AFTER_SETTLED, message: 'phải có đúng một alert với nguyên văn mong đợi' })
      .toEqual([c.expected.alert.text]);
  }
  if (c.expected.alert.shown === false) {
    soft(admin.dialogs, 'không được có alert nào').toEqual([]);
  }
}

/** ASSERT phía server (expect cứng cho dữ liệu): phản hồi của yêu cầu ghi và danh sách GET /api/products. */
async function assertServer(ctx: Context, result: ActResult) {
  const { c, api, refs, uid, serverBefore, setupProduct, categoryId } = ctx;
  const { response } = result;

  // 1. Yêu cầu ghi và phản hồi của nó
  if (c.expected.validation) {
    expect(response, 'không được gửi yêu cầu ghi khi ô bắt buộc bỏ trống').toBeNull();
  }
  if (c.expected.outcome === 'accept') {
    expect(response, 'giao diện phải gửi yêu cầu lưu / xóa').not.toBeNull();
    soft(response!.ok(), `yêu cầu hợp lệ phải được server chấp nhận (2xx), thực tế trả ${response!.status()}`).toBe(
      true,
    );
  }
  if (c.expected.outcome === 'reject' && response) {
    soft(
      response.status(),
      `SUT đã NHẬN dữ liệu sai: ${response.request().method()} /api/products trả ${response.status()}, ` +
        'theo đặc tả phải từ chối (4xx)',
    ).toBeGreaterThanOrEqual(400);
  }
  if (c.input.name?.length !== undefined && response) {
    const sent = response.request().postDataJSON() as { name: string };
    soft([...sent.name].length, 'độ dài tên thực gửi tới server').toBe(c.input.name.length);
  }

  // 2. Dữ liệu phía server: chụp lại toàn bộ danh sách và so sánh
  const serverAfter = await api.list();
  const idsBefore = new Set(serverBefore.map((p) => p.id));
  const created = serverAfter.filter((p) => !idsBefore.has(p.id));
  const targetId = setupProduct?.id;

  expect(serverAfter.length - serverBefore.length, 'số sản phẩm phía server thay đổi').toBe(
    c.expected.server.countDelta,
  );

  if (c.expected.server.othersUnchanged) {
    const others = (list: Product[]) => list.filter((p) => p.id !== targetId && idsBefore.has(p.id));
    expect(others(serverAfter), 'các sản phẩm khác phía server giữ nguyên').toEqual(others(serverBefore));
  }

  const expectedProduct = c.expected.server.product;
  if (expectedProduct) {
    const actual = c.op === 'add' ? created[0] : serverAfter.find((p) => p.id === targetId);
    expect(actual, 'sản phẩm đích phải tồn tại phía server').toBeDefined();
    expect(actual!.name, 'Tên lưu phía server').toBe(resolveName(expectedProduct.name, uid, refs));
    expect(actual!.price, 'Giá lưu phía server').toBe(expectedProduct.price);
    expect(Number(actual!.category_id), `Danh mục lưu phía server phải là "${expectedProduct.category}"`).toBe(
      categoryId(expectedProduct.category),
    );
    if (expectedProduct.nameLength !== undefined) {
      expect([...actual!.name].length, 'độ dài Tên lưu phía server').toBe(expectedProduct.nameLength);
    }
    if (expectedProduct.description !== undefined) {
      expect(actual!.description, 'Mô tả phía server giữ nguyên').toBe(expectedProduct.description);
    }
  }
  if (c.expected.server.productPresent === false) {
    expect(
      serverAfter.some((p) => p.id === targetId),
      'sản phẩm đã xóa không còn phía server',
    ).toBe(false);
  }
}

// ---------- 15 test sinh từ file dữ liệu ----------

test.describe('FR-15 Quản lý sản phẩm – Web Admin', () => {
  for (const c of data.cases) {
    test(`${c.id} – ${c.title}`, async ({ page, api }, testInfo) => {
      testInfo.annotations.push({ type: 'Run by', description: `${RUN_BY} · ${new Date().toISOString()}` });
      if (c.bug.length === 0) {
        testInfo.annotations.push({ type: 'Bug', description: 'không (kỳ vọng pass)' });
      }
      for (const bug of c.bug) {
        testInfo.annotations.push({ type: 'Bug', description: bug });
      }

      const ctx = await arrange(c, page, api, testInfo);
      const result = await act(ctx);

      // Bằng chứng: chụp riêng bảng sản phẩm ngay sau thao tác. Ảnh tự động lúc fail chỉ chụp khung nhìn,
      // trong khi dòng lỗi thường nằm cuối bảng, phải cuộn mới thấy.
      const tableShot = testInfo.outputPath('bang-san-pham-sau-thao-tac.png');
      await ctx.admin.table.screenshot({ path: tableShot });
      await testInfo.attach('Bảng sản phẩm sau thao tác', { path: tableShot, contentType: 'image/png' });
      await assertUi(ctx, result);
      await assertServer(ctx, result);
    });
  }
});
