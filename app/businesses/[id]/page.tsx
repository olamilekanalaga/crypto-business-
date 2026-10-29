import Terminal from "@/components/Terminal";
export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Terminal entityId={id} />;
}
