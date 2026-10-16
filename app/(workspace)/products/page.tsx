import { getCatalog } from "@/lib/products/server";
import { ProductExplorer } from "@/components/product-explorer";
export default async function Products() {
  return <ProductExplorer products={await getCatalog()} />;
}
