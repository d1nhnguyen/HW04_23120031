import type { Page, Request } from '@playwright/test';
import { installFormProbe, readProbe, resetProbe, waitUntilSettled, type FormProbe } from '../support/form-probe';

/**
 * Phần dùng chung của mọi Page Object có form gửi dữ liệu lên server (Web Admin lẫn Web khách hàng):
 * ghi lại hộp thoại, cài bộ ghi dấu vết trong trang, ghi lại các yêu cầu ghi mà Playwright thấy.
 */
export class ProbedPage {
  /** Nguyên văn mọi alert / confirm đã bật, theo thứ tự. */
  readonly dialogs: string[] = [];
  /** Mọi yêu cầu ghi (không phải GET) tới URL khớp `writePattern` mà Playwright thấy, theo thứ tự. */
  readonly writes: Request[] = [];

  private probeInstalled = false;

  /**
   * @param writePattern mẫu regex của URL mà trang này ghi dữ liệu, ví dụ '/api/products(/|$)'.
   */
  constructor(
    readonly page: Page,
    private readonly writePattern: string,
  ) {
    // Đăng ký trước mọi thao tác: SUT có thể báo kết quả bằng alert(), không xử lý thì trang treo.
    page.on('dialog', async (dialog) => {
      this.dialogs.push(dialog.message());
      await dialog.accept();
    });
    const isWrite = new RegExp(writePattern);
    page.on('request', (request) => {
      if (request.method() !== 'GET' && isWrite.test(request.url())) this.writes.push(request);
    });
  }

  /** Cài bộ ghi dấu vết vào trang. Phải xong TRƯỚC khi mở trang, nên được await ở đầu bước mở trang. */
  protected async installProbe() {
    if (this.probeInstalled) return;
    await installFormProbe(this.page, this.writePattern);
    this.probeInstalled = true;
  }

  resetProbe(): Promise<void> {
    return resetProbe(this.page);
  }

  readProbe(): Promise<FormProbe> {
    return readProbe(this.page);
  }

  waitUntilSettled(): Promise<void> {
    return waitUntilSettled(this.page);
  }
}
