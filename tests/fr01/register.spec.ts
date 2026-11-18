import { test as base, expect, type Page, type Response, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RegisterPage, type RegisterField } from '../../pages/register.page';
import { cleanupNewRecords } from '../../support/api-client';
import { account, config } from '../../support/env';
import type { FormProbe } from '../../support/form-probe';
import { UsersApi, type NewAccount, type User } from '../../support/users-api';

// ---------- Dữ liệu test: toàn bộ nằm trong data/fr01.register.json ----------

/** Lý do từ chối: thuộc về một ô của form, hoặc vì email đã tồn tại. */
type Reason = 'name' | 'email' | 'password' | 'confirm' | 'duplicate';

type Case = {
  id: string;
  title: string;
  op: 'register';
  bug: string[];
  note?: string;
  addedInHW04?: boolean;
  variantOf?: string;
  setup: null | { account: NewAccount };
  input: { name: string; email: string | { ref: 'setup' }; password: string; confirm?: string };
  expected: {
    outcome: 'accept' | 'reject';
    spec: string[];
    ui: { page: 'login' | 'register'; confirmField?: boolean; rejection?: { field: Reason } };
    server: {
      newAccounts: number;
      account?: boolean;
      loginWithInput?: boolean;
      othersUnchanged: boolean;
      setupLoginStillWorks?: boolean;
    };
    validation?: { field: RegisterField; blockedBy: 'browser-required' };
  };
};

type Meta = {
  assumptions: { rejectionReason: { order: Reason[]; keywords: Record<Reason, string[]> } };
};

const data = JSON.parse(
  readFileSync(path.join(__dirname, '..', '..', 'data', 'fr01.register.json'), 'utf8'),
) as { meta: Meta; cases: Case[] };

// Giá trị riêng của dự án (mã người chạy, tài khoản) lấy từ automation.config.json.
const RUN_BY = config.runBy;
const ADMIN = account('admin');

/** GIẢ ĐỊNH (không phải đặc tả): bảng từ khóa xếp một thông báo lỗi vào ô gây ra nó. */
const REASONS = data.meta.assumptions.rejectionReason;

/**
 * Thời gian thử lại của assertion giao diện khi DOM đã ở trạng thái cuối, không cần chờ đủ 5 giây mặc định:
 * - trước thao tác: form đã vẽ xong (RegisterPage.open đã thấy tiêu đề và form là nội dung tĩnh);
 * - sau thao tác: trang đã xong việc với server và đã vẽ lại (RegisterPage.waitUntilSettled).
 * Lúc đó assertion nào sai thì chờ thêm cũng không đúng lên.
 */
const UI_SETTLED = { timeout: 1000 };

/**
 * Kiểm một lần, không chờ lại. Dùng cho assertion giao diện đứng SAU assertion URL đầu tiên khi URL đã sai:
 * assertion URL đã chờ trang đi tới trạng thái cuối, nên trang không còn đổi nữa và chờ thêm chỉ làm test fail chậm.
 * (Playwright vẫn kiểm ít nhất một lần dù timeout rất nhỏ.)
 */
const NO_RETRY = { timeout: 1 };

const soft = expect.configure({ soft: true });

// ---------- Fixture: API + dọn tài khoản theo id, chạy cả khi test fail ----------

const test = base.extend<{ api: UsersApi }>({
  api: async ({ request }, use) => {
    const api = new UsersApi(request);
    await api.login(ADMIN);
    const idsBefore = new Set((await api.list()).map((user) => user.id));

    await use(api);

    // Xóa mọi tài khoản có id mới sinh trong test: tài khoản setup, tài khoản đăng ký hợp lệ,
    // và tài khoản mà SUT nhận sai ở case negative.
    await cleanupNewRecords(
      idsBefore,
      () => api.list(),
      (id) => api.remove(id),
    );
  },
});

// ---------- Hàm hỗ trợ ----------

/** Xếp một thông báo lỗi vào nhóm lý do đầu tiên có từ khóa khớp, theo thứ tự trong file dữ liệu. */
function classifyMessage(message: string): Reason | 'unknown' {
  const lower = message.toLowerCase();
  for (const reason of REASONS.order) {
    if (REASONS.keywords[reason].some((keyword) => lower.includes(keyword))) return reason;
  }
  return 'unknown';
}

// ---------- Các bước của một test ----------

type Context = {
  c: Case;
  reg: RegisterPage;
  api: UsersApi;
  /** Giá trị thực gõ vào form (đã thay {uid} và tham chiếu setup). */
  input: { name: string; email: string; password: string };
  /** Tài khoản tạo qua API ở setup, nếu case có. */
  setupAccount?: NewAccount;
  /** Danh sách tài khoản phía server ngay trước thao tác (sau setup). */
  usersBefore: User[];
  /** Để đính bằng chứng vào report. */
  testInfo: TestInfo;
};

type ActResult = {
  /** Dấu vết trong trang ngay sau thao tác. */
  probe: FormProbe;
  /** Phản hồi của POST /api/register; null nếu giao diện không gửi yêu cầu nào. */
  response: Response | null;
};

/** ARRANGE: dựng dữ liệu qua API, chụp danh sách tài khoản, mở trang Đăng ký. */
async function arrange(c: Case, page: Page, api: UsersApi, testInfo: TestInfo): Promise<Context> {
  const uid = `${testInfo.project.name.slice(0, 2)}${Date.now().toString(36)}`;
  const withUid = (template: string) => template.replace('{uid}', uid);

  let setupAccount: NewAccount | undefined;
  if (c.setup) {
    setupAccount = { ...c.setup.account, email: withUid(c.setup.account.email) };
    await api.register(setupAccount);
  }

  let email: string;
  if (typeof c.input.email === 'string') {
    email = withUid(c.input.email);
  } else {
    if (!setupAccount) throw new Error(`${c.id}: email tham chiếu setup nhưng case không có setup`);
    email = setupAccount.email;
  }

  const usersBefore = await api.list();

  const reg = new RegisterPage(page);
  await reg.open();

  return {
    c,
    reg,
    api,
    input: { name: c.input.name, email, password: c.input.password },
    setupAccount,
    usersBefore,
    testInfo,
  };
}

/** ACT: điền form, bấm Đăng Ký một lần, chờ trang ổn định. */
async function act(ctx: Context): Promise<ActResult> {
  const { c, reg } = ctx;

  await reg.fillForm(ctx.input);

  // Chỉ điền khi ô có thật: fill trên ô không tồn tại sẽ chờ hết thời gian của test.
  // Đây là đếm để quyết định thao tác, không phải assertion; việc form phải có ô này được assert trong assertUi.
  if (c.input.confirm !== undefined && (await reg.confirmInput.count()) === 1) {
    await reg.confirmInput.fill(c.input.confirm);
  }

  // Bằng chứng: form đúng như lúc bấm (dữ liệu đã nhập, ô nào có / không có). Sau khi bấm, trang có thể
  // chuyển sang Đăng nhập và mất dấu dữ liệu đã nhập.
  const formShot = ctx.testInfo.outputPath('form-truoc-khi-bam.png');
  await reg.main.screenshot({ path: formShot });
  await ctx.testInfo.attach('Form trước khi bấm Đăng Ký', { path: formShot, contentType: 'image/png' });

  const writesBefore = reg.writes.length;
  await reg.resetProbe();
  await reg.submitButton.click();

  // Chờ trang xong việc với server (trả về ngay nếu trình duyệt hoặc trang chặn form, không gửi yêu cầu nào).
  await reg.waitUntilSettled();
  const probe = await reg.readProbe();
  // Hai nguồn ghi nhận phải khớp nhau: trong trang (XHR) và phía Playwright (page.on('request')).
  await expect
    .poll(() => reg.writes.length - writesBefore, {
      message: 'số yêu cầu đăng ký Playwright thấy phải khớp số trang đã gửi',
    })
    .toBe(probe.sent);
  const lastWrite = reg.writes.length > writesBefore ? reg.writes[reg.writes.length - 1] : null;
  const response = lastWrite ? await lastWrite.response() : null;

  return { probe, response };
}

/** ASSERT giao diện (soft, không tải lại trang): trang đang đứng, ô xác nhận, lý do từ chối. */
async function assertUi(ctx: Context, result: ActResult) {
  const { c, reg } = ctx;
  const { ui } = c.expected;

  // Chỉ assertion URL đầu tiên được chờ. Các assertion giao diện sau nó:
  // - URL đúng: vẫn cho thời gian vẽ lại (React có thể vẽ trang mới sau khi URL đổi một nhịp), và đúng ngay lần đầu;
  // - URL sai: trang đã ở trạng thái cuối, kiểm một lần rồi thôi (NO_RETRY), không chờ lại cho từng assertion.
  const expectedUrl = ui.page === 'login' ? reg.loginUrl : reg.registerUrl;
  if (ui.page === 'login') {
    await soft(reg.page, 'sau khi đăng ký thành công phải được chuyển tới trang Đăng nhập (S5)').toHaveURL(
      expectedUrl,
      UI_SETTLED,
    );
  } else {
    await soft(reg.page, 'đăng ký bị từ chối thì phải ở lại trang Đăng ký, không chuyển tới trang Đăng nhập').toHaveURL(
      expectedUrl,
      UI_SETTLED,
    );
  }
  const after = expectedUrl.test(reg.page.url()) ? UI_SETTLED : NO_RETRY;
  if (ui.page === 'login') {
    await soft(reg.loginSubmitButton, 'trang Đăng nhập phải hiện nút đăng nhập').toBeVisible(after);
    await soft(reg.forgotPasswordLink, 'trang Đăng nhập phải hiện link Quên mật khẩu').toBeVisible(after);
  } else {
    await soft(reg.heading, 'form Đăng ký vẫn đang hiển thị').toBeVisible(after);
  }

  // S4: form phải có ô Xác nhận mật khẩu. Ô nằm trong form tĩnh, nên kiểm sau thao tác cũng đúng như trước.
  if (ui.confirmField) {
    await soft(reg.confirmInput, 'form phải có ô Xác nhận mật khẩu (S4)').toHaveCount(1, after);
  }

  // Form bị trình duyệt chặn: đúng ô bắt buộc nhận sự kiện `invalid` và form không được submit.
  // `invalid` và `submit` là sự kiện xảy ra do cú bấm, không phải trạng thái có sẵn của ô rỗng.
  if (c.expected.validation) {
    soft(reg.blockedFields(result.probe), 'trình duyệt phải báo đúng ô bỏ trống là không hợp lệ').toEqual([
      c.expected.validation.field,
    ]);
    soft(result.probe.submit, 'form không được bắn sự kiện submit khi ô bắt buộc bỏ trống').toBe(0);
  }

  if (ui.rejection) {
    // Lý do từ chối đọc từ hai nguồn xảy ra SAU cú bấm: ô bị trình duyệt chặn (sự kiện invalid)
    // và thông báo lỗi của trang (trước thao tác không có thông báo nào, xem RegisterPage.open).
    const blocked = reg.blockedFields(result.probe);
    const messages = await reg.errorMessages();
    const reasons = [...new Set<string>([...blocked, ...messages.map(classifyMessage)])];
    soft(
      reasons,
      `lý do từ chối phải thuộc về đúng "${ui.rejection.field}" (cách nhận diện là giả định). ` +
        `Thực tế: ô bị trình duyệt chặn = [${blocked.join(', ')}]; thông báo trên trang = [${messages.join(' | ')}]`,
    ).toEqual([ui.rejection.field]);
  }
}

/** ASSERT phía server (expect cứng cho dữ liệu): phản hồi của yêu cầu đăng ký và danh sách tài khoản. */
async function assertServer(ctx: Context, result: ActResult) {
  const { c, api, input, setupAccount, usersBefore } = ctx;
  const { response } = result;
  const { server } = c.expected;

  // 1. Yêu cầu đăng ký và phản hồi của nó
  if (c.expected.validation) {
    soft(response, 'không được gửi yêu cầu đăng ký khi ô bắt buộc bỏ trống').toBeNull();
  }
  if (c.expected.outcome === 'accept') {
    soft(response, 'giao diện phải gửi yêu cầu đăng ký khi dữ liệu hợp lệ').not.toBeNull();
    if (response) {
      soft(response.ok(), `yêu cầu hợp lệ phải được server chấp nhận (2xx), thực tế trả ${response.status()}`).toBe(
        true,
      );
    }
  }
  if (c.expected.outcome === 'reject' && response) {
    soft(
      response.status(),
      `SUT đã NHẬN dữ liệu sai: POST /api/register trả ${response.status()}, theo đặc tả phải từ chối (4xx)`,
    ).toBeGreaterThanOrEqual(400);
  }

  // 2. Chụp danh sách tài khoản TRƯỚC khi thử đăng nhập: các lần đăng nhập ở bước 3 có thể đổi login_attempts.
  const usersAfter = await api.list();
  const idsBefore = new Set(usersBefore.map((user) => user.id));
  const created = usersAfter.filter((user) => !idsBefore.has(user.id));

  // Bằng chứng phía server, đính TRƯỚC các expect cứng để report vẫn có khi test dừng giữa chừng.
  // Ảnh trang Đăng nhập không cho thấy SUT đã tạo tài khoản gì; danh sách này thì có.
  await ctx.testInfo.attach('Tài khoản mới phía server sau thao tác', {
    body: JSON.stringify(created, null, 2),
    contentType: 'application/json',
  });

  expect(
    created.map((user) => `${user.name} <${user.email}>`),
    `số tài khoản mới phía server phải là ${server.newAccounts}`,
  ).toHaveLength(server.newAccounts);

  if (server.othersUnchanged) {
    expect(
      usersAfter.filter((user) => idsBefore.has(user.id)),
      'các tài khoản có từ trước thao tác phải giữ nguyên',
    ).toEqual(usersBefore);
  }

  if (server.account) {
    expect(created[0].name, 'Họ Tên lưu phía server').toBe(input.name);
    expect(created[0].email, 'Email lưu phía server').toBe(input.email);
  }

  // 3. Thử đăng nhập, sau khi đã chụp xong danh sách
  if (server.loginWithInput) {
    expect(
      await api.canLogin({ email: input.email, password: input.password }),
      'phải đăng nhập được bằng email + mật khẩu vừa đăng ký',
    ).toBe(true);
  }
  if (server.setupLoginStillWorks) {
    if (!setupAccount) throw new Error(`${c.id}: kiểm tài khoản setup nhưng case không có setup`);
    expect(
      await api.canLogin(setupAccount),
      'tài khoản có sẵn (tạo ở setup) phải vẫn đăng nhập được bằng mật khẩu của nó',
    ).toBe(true);
  }
}

// ---------- Test sinh từ file dữ liệu ----------

test.describe('FR-01 Đăng ký tài khoản – Web khách hàng', () => {
  for (const c of data.cases) {
    test(`${c.id} – ${c.title}`, async ({ page, api }, testInfo) => {
      testInfo.annotations.push({ type: 'Run by', description: `${RUN_BY} · ${new Date().toISOString()}` });
      testInfo.annotations.push({ type: 'Đặc tả', description: c.expected.spec.join(', ') });
      if (c.bug.length === 0) {
        testInfo.annotations.push({ type: 'Bug', description: 'không (kỳ vọng pass)' });
      }
      for (const bug of c.bug) {
        testInfo.annotations.push({ type: 'Bug', description: bug });
      }
      if (c.note) {
        testInfo.annotations.push({ type: 'Ghi chú', description: c.note });
      }

      const ctx = await arrange(c, page, api, testInfo);
      const result = await act(ctx);

      // Bằng chứng: chụp riêng vùng nội dung của trang ngay sau thao tác (thông báo lỗi + form, hoặc trang Đăng nhập).
      const shot = testInfo.outputPath('trang-sau-thao-tac.png');
      await ctx.reg.main.screenshot({ path: shot });
      await testInfo.attach('Trang sau thao tác', { path: shot, contentType: 'image/png' });

      await assertUi(ctx, result);
      await assertServer(ctx, result);
    });
  }
});
