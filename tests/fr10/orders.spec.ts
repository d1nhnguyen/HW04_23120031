import { test as base, expect, type Page, type Response, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AdminOrdersPage } from '../../pages/admin-orders.page';
import type { OrderTable } from '../../pages/order-table';
import { ProfilePage } from '../../pages/profile.page';
import { account, config } from '../../support/env';
import type { FormProbe } from '../../support/form-probe';
import { AdminOrdersApi, CustomerOrdersApi, type Order } from '../../support/orders-api';

// ---------- Dữ liệu test: toàn bộ nằm trong data/fr10.orders.json ----------

type Role = 'admin' | 'user';

type Case = {
  id: string;
  title: string;
  op: 'admin-action' | 'user-cancel' | 'admin-view' | 'user-view';
  bug: string[];
  note?: string;
  addedInHW04?: boolean;
  setup: { orders: { state: string }[]; address: string };
  input: { order?: number; button?: string };
  expected: {
    outcome: 'accept' | 'reject' | 'view';
    spec: string[];
    ui: { status?: string; othersUnchanged?: boolean; noSuccessAlert?: boolean; buttonsFollowAllowed?: boolean };
    server: { status?: string; othersUnchanged: boolean };
  };
};

type Meta = {
  orderAmount: number;
  allowedTransitions: Record<Role, Record<string, string[]>>;
  setupChains: Record<string, string[]>;
  observed: {
    statusLabels: Record<string, string>;
    buttonLabels: Record<Role, Record<string, string>>;
    userCancelSuccessAlert: string;
  };
};

const data = JSON.parse(
  readFileSync(path.join(__dirname, '..', '..', 'data', 'fr10.orders.json'), 'utf8'),
) as { meta: Meta; cases: Case[] };
const META = data.meta;

// Giá trị riêng của dự án (mã người chạy, tài khoản) lấy từ automation.config.json.
const RUN_BY = config.runBy;
const ADMIN = account('admin');
const USER = account('user');

/**
 * Thời gian thử lại của assertion giao diện khi DOM đã ở trạng thái cuối:
 * sau thao tác, trang đã xong việc với server và đã vẽ lại (waitUntilSettled). Chờ thêm không làm assertion sai đúng lên.
 */
const UI_SETTLED = { timeout: 1000 };

/**
 * Kiểm một lần, không chờ lại. Dùng cho case xem bộ nút: không có thao tác nào, và arrange đã chờ mọi dòng
 * đơn setup hiển thị, nên nút trong dòng (vẽ cùng lúc với dòng) đã ở trạng thái cuối.
 */
const NO_RETRY = { timeout: 1 };

const soft = expect.configure({ soft: true });

function roleOf(c: Case): Role {
  return c.op.startsWith('admin') ? 'admin' : 'user';
}

function statusLabel(state: string): string {
  const label = META.observed.statusLabels[state];
  if (!label) throw new Error(`meta.observed.statusLabels không có "${state}"`);
  return label;
}

/**
 * Bằng chứng: chụp RIÊNG từng dòng đơn của test và đính vào report. Không chụp cả bảng: bảng nằm trong khung cuộn
 * và dài thêm qua mỗi test, ảnh cả bảng bị cắt mất phần ngoài khung nhìn. Chụp riêng một phần tử thì Playwright
 * cuộn phần tử đó vào khung nhìn trước.
 */
async function shootRows(table: OrderTable, ids: number[], testInfo: TestInfo, when: 'truoc' | 'sau') {
  const label = when === 'truoc' ? 'trước thao tác' : 'sau thao tác';
  for (const id of ids) {
    const file = testInfo.outputPath(`don-${id}-${when}-thao-tac.png`);
    await table.row(id).screenshot({ path: file });
    await testInfo.attach(`Dòng đơn #${id} ${label}`, { path: file, contentType: 'image/png' });
  }
}

// ---------- Fixture: API của admin và của khách hàng ----------

/**
 * SUT KHÔNG có API xóa đơn, nên fixture không dọn được đơn test tạo ra. Thay vào đó:
 * mọi assertion bám vào id đơn test tự tạo; "các đơn khác giữ nguyên" so với bản chụp ngay trước thao tác;
 * dữ liệu về seed ở lần reset đầu lượt (global-setup).
 */
const test = base.extend<{ api: { admin: AdminOrdersApi; customer: CustomerOrdersApi } }>({
  api: async ({ request }, use) => {
    const admin = new AdminOrdersApi(request);
    await admin.login(ADMIN);
    const customer = new CustomerOrdersApi(request);
    await customer.login(USER);
    await use({ admin, customer });
  },
});

// ---------- Các bước của một test ----------

type Ui = AdminOrdersPage | ProfilePage;

type Context = {
  c: Case;
  role: Role;
  ui: Ui;
  table: OrderTable;
  api: AdminOrdersApi;
  /** Id các đơn setup, cùng thứ tự với c.setup.orders. */
  ids: number[];
  /** Danh sách đơn phía server ngay trước thao tác. */
  ordersBefore: Order[];
  /** Nhãn trạng thái mọi dòng trên bảng ngay trước thao tác. */
  tableBefore: Record<string, string>;
  testInfo: TestInfo;
};

type ActResult = {
  probe: FormProbe | null;
  /** Phản hồi của yêu cầu đổi trạng thái / hủy đơn; null nếu không gửi yêu cầu nào. */
  response: Response | null;
  /** false khi case reject nhưng giao diện không có nút để bấm (không gửi được chuyển không hợp lệ). */
  clicked: boolean;
};

/** ARRANGE: tạo đơn và đưa tới trạng thái cần qua API, đăng nhập, mở bảng, chụp trạng thái trước thao tác. */
async function arrange(
  c: Case,
  page: Page,
  api: { admin: AdminOrdersApi; customer: CustomerOrdersApi },
  testInfo: TestInfo,
): Promise<Context> {
  const uid = `${testInfo.project.name.slice(0, 2)}${Date.now().toString(36)}`;
  const address = c.setup.address.replace('{uid}', uid);

  const ids: number[] = [];
  for (const order of c.setup.orders) {
    const id = await api.customer.checkout(META.orderAmount, address);
    for (const status of META.setupChains[order.state]) await api.admin.setStatus(id, status);
    expect((await api.admin.get(id)).status, `đơn setup #${id} phải ở trạng thái cần`).toBe(order.state);
    ids.push(id);
  }
  testInfo.annotations.push({ type: 'Đơn test', description: ids.map((id) => `#${id}`).join(', ') });

  const ordersBefore = await api.admin.list();

  const role = roleOf(c);
  let ui: Ui;
  if (role === 'admin') {
    const admin = new AdminOrdersPage(page);
    await admin.login(ADMIN);
    await admin.openOrders();
    ui = admin;
  } else {
    const profile = new ProfilePage(page);
    await profile.login(USER);
    await profile.open();
    ui = profile;
  }
  const table = ui.orders;
  for (const id of ids) {
    await expect(table.row(id), `dòng của đơn #${id} phải hiển thị trước khi thao tác`).toBeVisible();
  }
  const tableBefore = await table.readStatuses();
  await shootRows(table, ids, testInfo, 'truoc');

  return { c, role, ui, table, api: api.admin, ids, ordersBefore, tableBefore, testInfo };
}

/** ACT: bấm đúng một nút trên dòng của đơn đích rồi chờ trang ổn định. Case xem bộ nút không bấm gì. */
async function act(ctx: Context): Promise<ActResult> {
  const { c, ui, table, ids } = ctx;
  if (c.expected.outcome === 'view') return { probe: null, response: null, clicked: false };

  const id = ids[c.input.order!];
  const button = table.button(id, c.input.button!);
  // Không bấm vào phần tử không tồn tại. Case accept: thiếu nút là lỗi. Case reject: thiếu nút là hành vi đúng
  // (giao diện không cho gửi chuyển không hợp lệ), nên ghi lại và không bấm.
  if ((await button.count()) === 0) {
    if (c.expected.outcome === 'accept') {
      // Dòng đã hiển thị từ arrange và nút vẽ cùng dòng, nên kiểm một lần trên trạng thái cuối.
      await soft(button, `dòng của đơn #${id} phải có nút "${c.input.button}" cho chuyển hợp lệ`).toHaveCount(
        1,
        NO_RETRY,
      );
    } else {
      ctx.testInfo.annotations.push({ type: 'Ghi chú', description: `Không có nút "${c.input.button}", không bấm.` });
    }
    return { probe: null, response: null, clicked: false };
  }

  const writesBefore = ui.writes.length;
  await ui.resetProbe();
  await button.click();
  await ui.waitUntilSettled();
  const probe = await ui.readProbe();
  // Hai nguồn ghi nhận phải khớp nhau: trong trang (XHR) và phía Playwright (page.on('request')).
  await expect
    .poll(() => ui.writes.length - writesBefore, { message: 'số yêu cầu ghi Playwright thấy phải khớp số trang đã gửi' })
    .toBe(probe.sent);
  const lastWrite = ui.writes.length > writesBefore ? ui.writes[ui.writes.length - 1] : null;
  const response = lastWrite ? await lastWrite.response() : null;
  return { probe, response, clicked: true };
}

/** ASSERT giao diện (soft, không tải lại trang): nhãn trạng thái, các dòng khác, thông báo, bộ nút. */
async function assertUi(ctx: Context) {
  const { c, role, ui, table, ids, tableBefore } = ctx;
  const { ui: expected } = c.expected;

  if (expected.status) {
    const id = ids[c.input.order!];
    await soft(await table.statusCell(id), `nhãn trạng thái của đơn #${id} sau thao tác`).toHaveText(
      statusLabel(expected.status),
      UI_SETTLED,
    );
  }

  if (expected.othersUnchanged) {
    const target = c.input.order === undefined ? undefined : `#${ids[c.input.order]}`;
    const after = await table.readStatuses();
    const others = (statuses: Record<string, string>) =>
      Object.fromEntries(Object.entries(statuses).filter(([id]) => id !== target && id in tableBefore));
    soft(others(after), 'nhãn trạng thái của mọi dòng khác giữ nguyên').toEqual(others(tableBefore));
  }

  if (expected.noSuccessAlert) {
    soft(ui.dialogs, 'chuyển không hợp lệ không được báo thành công (S4)').not.toContain(
      META.observed.userCancelSuccessAlert,
    );
  }

  if (expected.buttonsFollowAllowed) {
    for (const [i, order] of c.setup.orders.entries()) {
      const id = ids[i];
      const labels = META.allowedTransitions[role][order.state].map((target) => {
        const label = META.observed.buttonLabels[role][target];
        if (!label) throw new Error(`meta.observed.buttonLabels.${role} không có nhãn cho "${target}"`);
        return label;
      });
      await soft(await table.statusCell(id), `đơn #${id} phải đang hiển thị nhãn của trạng thái setup`).toHaveText(
        statusLabel(order.state),
        NO_RETRY,
      );
      // Dòng đã hiển thị (arrange chờ rồi), nên đếm số nút là đếm trên trạng thái cuối.
      await soft(
        table.buttons(id),
        `đơn #${id} (${statusLabel(order.state)}) phải có đúng ${labels.length} nút: [${labels.join(', ')}]`,
      ).toHaveCount(labels.length, NO_RETRY);
      // Đặc tả không quy định thứ tự nút, nên so sau khi sắp xếp.
      soft(
        (await table.buttons(id).allTextContents()).map((t) => t.trim()).sort(),
        `nhãn các nút của đơn #${id}`,
      ).toEqual([...labels].sort());
    }
  }
}

/** ASSERT phía server (expect cứng cho dữ liệu): phản hồi, trạng thái đơn đích, các đơn khác. */
async function assertServer(ctx: Context, result: ActResult) {
  const { c, api, ids, ordersBefore, testInfo } = ctx;
  const { response } = result;

  // 1. Phản hồi của yêu cầu đổi trạng thái / hủy đơn
  if (c.expected.outcome === 'accept') {
    soft(response, 'giao diện phải gửi yêu cầu đổi trạng thái').not.toBeNull();
    if (response) {
      soft(response.ok(), `chuyển hợp lệ phải được server chấp nhận (2xx), thực tế trả ${response.status()}`).toBe(true);
    }
  }
  if (c.expected.outcome === 'reject' && response) {
    soft(
      response.status(),
      `SUT đã NHẬN chuyển không hợp lệ: ${response.request().method()} trả ${response.status()}, theo đặc tả phải báo lỗi (4xx)`,
    ).toBeGreaterThanOrEqual(400);
  }

  // 2. Dữ liệu phía server
  const ordersAfter = await api.list();
  const mine = ordersAfter.filter((order) => ids.includes(order.id));
  await testInfo.attach('Đơn test phía server sau thao tác', {
    body: JSON.stringify(mine, null, 2),
    contentType: 'application/json',
  });

  if (c.expected.server.status) {
    const id = ids[c.input.order!];
    expect((await api.get(id)).status, `trạng thái phía server của đơn #${id}`).toBe(c.expected.server.status);
  }
  if (c.expected.outcome === 'view') {
    for (const [i, order] of c.setup.orders.entries()) {
      expect((await api.get(ids[i])).status, `đơn #${ids[i]} không được đổi khi chỉ xem`).toBe(order.state);
    }
  }
  if (c.expected.server.othersUnchanged) {
    const target = c.input.order === undefined ? undefined : ids[c.input.order];
    const before = new Set(ordersBefore.map((order) => order.id));
    const others = (list: Order[]) => list.filter((order) => order.id !== target && before.has(order.id));
    expect(others(ordersAfter), 'các đơn khác phía server giữ nguyên').toEqual(others(ordersBefore));
  }
}

// ---------- Test sinh từ file dữ liệu ----------

test.describe('FR-10 Trạng thái đơn hàng – Web Admin và trang Hồ sơ', () => {
  for (const c of data.cases) {
    test(`${c.id} – ${c.title}`, async ({ page, api }, testInfo) => {
      testInfo.annotations.push({ type: 'Run by', description: `${RUN_BY} · ${new Date().toISOString()}` });
      testInfo.annotations.push({ type: 'Đặc tả', description: c.expected.spec.join(', ') });
      if (c.bug.length === 0) testInfo.annotations.push({ type: 'Bug', description: 'không (kỳ vọng pass)' });
      for (const bug of c.bug) testInfo.annotations.push({ type: 'Bug', description: bug });
      if (c.note) testInfo.annotations.push({ type: 'Ghi chú', description: c.note });

      const ctx = await arrange(c, page, api, testInfo);
      const result = await act(ctx);

      await shootRows(ctx.table, ctx.ids, testInfo, 'sau');

      await assertUi(ctx);
      await assertServer(ctx, result);
    });
  }
});
