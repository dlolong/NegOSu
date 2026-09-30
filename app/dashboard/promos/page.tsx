import { CommerceCatalogPage, type CommerceCatalogQuery } from "@/components/commerce-catalog-page";
export default async function Page({ searchParams }: { searchParams: Promise<CommerceCatalogQuery> }) {
  return <CommerceCatalogPage kind="promos" query={await searchParams}/>;
}
