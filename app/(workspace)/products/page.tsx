import { getCatalog } from "@/lib/products/server";
import { productSearchConfigured } from "@/lib/ai/product-search";
import { ProductExplorer } from "@/components/product-explorer";
export default async function Products() {
  return <ProductExplorer products={await getCatalog()} aiSearchAvailable={productSearchConfigured()} />;
}
