import Terminal from "@/components/Terminal";
export default async function AssetAnatomyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Terminal entityId={id} dedicatedAnatomy />;
}
