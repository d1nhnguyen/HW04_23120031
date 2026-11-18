/** Thoát các ký tự đặc biệt để dùng một chuỗi chữ làm một phần của RegExp (khớp đúng nguyên văn). */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
