import { expect, type APIRequestContext } from '@playwright/test';

export const API_URL = process.env.API_URL ?? 'http://localhost:3000/api';

export type Product = {
  id: number;
  name: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
  category_id: number;
};

export type Category = { id: number; name: string };

export type NewProduct = Omit<Product, 'id'>;

/** Gọi API của SUT để dựng, chụp và dọn dữ liệu sản phẩm. */
export class ProductsApi {
  private token = '';

  constructor(private readonly request: APIRequestContext) {}

  async login(email: string, password: string) {
    const res = await this.request.post(`${API_URL}/login`, { data: { email, password } });
    expect(res.ok(), `đăng nhập API bằng ${email}`).toBeTruthy();
    this.token = (await res.json()).token;
  }

  private auth() {
    return { Authorization: `Bearer ${this.token}` };
  }

  async list(): Promise<Product[]> {
    const res = await this.request.get(`${API_URL}/products`);
    expect(res.ok(), 'GET /products').toBeTruthy();
    return res.json();
  }

  async categories(): Promise<Category[]> {
    const res = await this.request.get(`${API_URL}/categories`);
    expect(res.ok(), 'GET /categories').toBeTruthy();
    return res.json();
  }

  async create(product: NewProduct): Promise<Product> {
    const res = await this.request.post(`${API_URL}/products`, { headers: this.auth(), data: product });
    expect(res.ok(), 'POST /products (setup)').toBeTruthy();
    const { id } = await res.json();
    return { id, ...product };
  }

  async remove(id: number) {
    await this.request.delete(`${API_URL}/products/${id}`, { headers: this.auth() });
  }
}
