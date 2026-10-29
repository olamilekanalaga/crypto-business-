import ResearchGate, { isHostedPreview } from "@/components/ResearchGate";
import BrowserDiscovery from "@/components/BrowserDiscovery";
import Terminal from "@/components/Terminal";

export default function ResearchPage() {
  if (isHostedPreview()) return <BrowserDiscovery />;
  return (
    <ResearchGate>
      <Terminal />
    </ResearchGate>
  );
}
