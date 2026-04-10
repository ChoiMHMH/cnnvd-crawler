/**
 * AliExpress 상품 데이터 정규화 스키마.
 * 확장프로그램(content script)과 로컬 수신 서버가 공유한다.
 */

export interface AliExpressProduct {
  productId: string;
  title: string;
  price: string;
  originalPrice?: string;
  discount?: string;
  currency: string;
  imageUrls: string[];
  attributes: ProductAttribute[];
  optionGroups: OptionGroup[];
  stockKeepingUnits: StockKeepingUnit[];
  description: string;
  seller: SellerInfo;
  ratings: RatingInfo;
  shipping: string;
  category: string[];
  sourceUrl: string;
  scrapedAt: string;
}

export interface ProductAttribute {
  name: string;
  value: string;
}

export interface OptionGroup {
  name: string;
  options: OptionItem[];
}

export interface OptionItem {
  name: string;
  imageUrl?: string;
  priceAdjust?: string;
}

export interface StockKeepingUnit {
  skuId: string;
  options: Record<string, string>;
  price: string;
  stock: number;
}

export interface SellerInfo {
  name: string;
  storeUrl: string;
  rating?: string;
  followers?: string;
}

export interface RatingInfo {
  average: string;
  totalReviews: string;
  totalOrders?: string;
}

/** content script → background → offscreen 메시지 타입 */
export interface ScrapMessage {
  type: "SCRAP_PRODUCT";
  payload: AliExpressProduct;
}

export interface ScrapResponse {
  type: "SCRAP_RESULT";
  success: boolean;
  error?: string;
}
