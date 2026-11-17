import type { Page } from '@playwright/test';

/** Dấu vết ghi trong trang: trình duyệt có chặn form hay form đã được submit. */
export type FormProbe = {
  /** placeholder của các ô bị trình duyệt báo không hợp lệ (sự kiện `invalid`). */
  invalid: string[];
  /**
   * Chữ của nhãn đứng với từng ô bị báo không hợp lệ, cùng thứ tự với `invalid`.
   * Dùng cho form mà ô nhập không có placeholder (trang Đăng ký). Chuỗi rỗng nếu ô không có nhãn.
   */
  invalidLabels: string[];
  /** số lần form thực sự được submit (sự kiện `submit`). */
  submit: number;
  /** số yêu cầu ghi (không phải GET) tới URL khớp mẫu mà trang đã gửi. */
  sent: number;
  /** số XHR đang chờ phản hồi; 0 nghĩa là trang không còn chờ server. */
  pending: number;
};

type ProbeWindow = { __formProbe: FormProbe };

/**
 * Chạy TRONG trang trước mọi script của SUT. Ghi lại:
 * - sự kiện `invalid` và `submit` (đã kiểm trên Chromium, Firefox, WebKit ở B6: khi ô bắt buộc bỏ trống,
 *   trình duyệt bắn `invalid` vào ô đó và KHÔNG bắn `submit`);
 * - số yêu cầu ghi tới URL khớp `writePattern` và số XHR còn đang chờ.
 */
function probeScript(writePattern: string) {
  const isWrite = new RegExp(writePattern);
  const probe = { invalid: [] as string[], invalidLabels: [] as string[], submit: 0, sent: 0, pending: 0 };
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
    if (this.__method !== 'GET' && isWrite.test(this.__url ?? '')) probe.sent++;
    this.addEventListener('loadend', () => probe.pending--);
    return send.call(this, body);
  };
  document.addEventListener(
    'invalid',
    (event) => {
      const input = event.target as HTMLInputElement;
      probe.invalid.push(input.placeholder);
      // Nhãn gắn bằng for / id nếu có; nếu không thì lấy <label> đứng ngay trước ô.
      const previous = input.previousElementSibling;
      const label = input.labels?.[0] ?? (previous instanceof HTMLLabelElement ? previous : null);
      probe.invalidLabels.push(label?.textContent?.trim() ?? '');
    },
    true,
  );
  document.addEventListener('submit', () => probe.submit++, true);
}

/**
 * Cài bộ ghi dấu vết vào trang. Phải được await TRƯỚC `page.goto`.
 * @param writePattern mẫu regex (dạng chuỗi) của URL được coi là yêu cầu ghi, ví dụ '/api/products(/|$)'.
 */
export async function installFormProbe(page: Page, writePattern: string) {
  await page.addInitScript(probeScript, writePattern);
}

/** Xóa dấu vết cũ (ví dụ lần submit của form đăng nhập) ngay trước thao tác cần kiểm. */
export async function resetProbe(page: Page) {
  await page.evaluate(() => {
    const probe = (window as unknown as ProbeWindow).__formProbe;
    probe.invalid = [];
    probe.invalidLabels = [];
    probe.submit = 0;
    probe.sent = 0;
  });
}

export async function readProbe(page: Page): Promise<FormProbe> {
  return page.evaluate(() => {
    const probe = (window as unknown as ProbeWindow).__formProbe;
    return {
      invalid: [...probe.invalid],
      invalidLabels: [...probe.invalidLabels],
      submit: probe.submit,
      sent: probe.sent,
      pending: probe.pending,
    };
  });
}

/**
 * Chờ trang nói chuyện xong với server rồi vẽ lại. Không dùng thời gian cố định:
 * - Yêu cầu lưu / xóa được gửi ngay trong lượt xử lý cú click, nên sau click `pending` đã > 0 nếu có gửi.
 * - Các lệnh tải lại danh sách nối tiếp nhau trong cùng chuỗi promise, nên `pending` chỉ về 0 khi xong hết.
 * - Nếu trình duyệt chặn form thì `pending` vẫn là 0 và hàm trả về ngay.
 */
export async function waitUntilSettled(page: Page) {
  await page.waitForFunction(() => (window as unknown as ProbeWindow).__formProbe.pending === 0);
  await page.evaluate(
    () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );
}
