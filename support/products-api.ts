import { expect } from '@playwright/test';
import { ApiClient } from './api-client';

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

/** Gọi API của SUT để dựng, chụp và dọn dữ liệu sản phẩm (riêng của FR-15). */
export class ProductsApi extends ApiClient {
  async list(): Promise<Product[]> {
    const res = await this.request.get(`${this.baseUrl}/products`);
    expect(res.ok(), 'GET /products').toBeTruthy();
    return res.json();
  }

  async categories(): Promise<Category[]> {
    const res = await this.request.get(`${this.baseUrl}/categories`);
    expect(res.ok(), 'GET /categories').toBeTruthy();
    return res.json();
  }

  async create(product: NewProduct): Promise<Product> {
    const res = await this.request.post(`${this.baseUrl}/products`, { headers: this.auth(), data: product });
    expect(res.ok(), 'POST /products (setup)').toBeTruthy();
    const { id } = await res.json();
    return { id, ...product };
  }

  async remove(id: number) {
    await this.request.delete(`${this.baseUrl}/products/${id}`, { headers: this.auth() });
  }
}
