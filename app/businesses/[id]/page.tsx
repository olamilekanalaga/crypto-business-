import NetworkExplorer from "@/components/network/NetworkExplorer";
import ResearchGate from "@/components/ResearchGate";
import Terminal from "@/components/Terminal";
export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return <NetworkExplorer initialFocus={id} />;
  return (
    <ResearchGate>
      <Terminal entityId={id} />
    </ResearchGate>
  );
}
