import Terminal from "@/components/Terminal";
import Directory from "@/components/usdc/Directory";
import ResearchGate from "@/components/ResearchGate";

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
  return <Directory />;
}
