import OpportunityAtlas from "@/components/OpportunityAtlas";
import { isHostedPreview } from "@/components/ResearchGate";
export default function Page() {
  return <OpportunityAtlas hosted={isHostedPreview()} />;
}
