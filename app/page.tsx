import Terminal from "@/components/Terminal";
import OpportunityAtlas from "@/components/OpportunityAtlas";
import ResearchGate, { isHostedPreview } from "@/components/ResearchGate";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  if (view)
    return (
      <ResearchGate>
        <Terminal />
      </ResearchGate>
    );
  return <OpportunityAtlas hosted={isHostedPreview()} />;
}
