import Terminal from "@/components/Terminal";
export default async function AssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Terminal entityId={id} />;
}
