// Chụp trang GitHub issue của tracker (repo public, không cần đăng nhập) -> bugs/issue_shots/<BUG>_issue-<số>.jpg
// Dựa trên scripts/issue_shots.mjs của HW02. Không chờ theo thời gian cố định: chờ thân issue hiện ra,
// cuộn hết trang để ảnh lazy-load được tải, rồi chờ mọi <img> tải xong.
// JPEG chất lượng 65: chữ vẫn đọc rõ, 13 ảnh khoảng 2,3 MB (zip nộp bài giới hạn 20 MB).
// Dùng: node scripts/issue_shots.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'bugs', 'issue_shots');
const REPO = 'https://github.com/d1nhnguyen/eshop-sut/issues';
// [mã bug, số issue]: 13 issue mà bộ test HW04 làm lộ ra (bugs/Bug_Report.md mục 1)
const TARGETS = [
  ['BUG-15', 15], ['BUG-16', 16], ['BUG-18', 18], ['BUG-19', 19], ['BUG-20', 20], ['BUG-21', 21],
  ['BUG-24', 24], ['BUG-25', 25], ['BUG-26', 26], ['BUG-27', 27], ['BUG-41', 87],
  ['BUG-30', 30], ['BUG-31', 31],
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
for (const [bug, num] of TARGETS) {
  await page.goto(`${REPO}/${num}`, { waitUntil: 'load' });
  await page.locator('[data-testid="issue-body"], .js-comment-body').first().waitFor({ timeout: 20000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(() => r()));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => [...document.images].every((img) => img.complete), null, { timeout: 20000 });
  const title = (await page.title()).replace(/ · .*$/, '');
  const file = join(OUT, `${bug}_issue-${num}.jpg`);
  await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 65 });
  console.log(`${bug} #${num}: ${title}`);
}
await browser.close();
