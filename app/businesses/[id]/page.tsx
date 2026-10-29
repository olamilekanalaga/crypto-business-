import ResearchGate from "@/components/ResearchGate";
import Terminal from "@/components/Terminal";
export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ResearchGate>
      <Terminal entityId={id} />
    </ResearchGate>
  );
}
