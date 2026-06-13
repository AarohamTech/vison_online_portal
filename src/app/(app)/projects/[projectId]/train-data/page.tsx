import { SectionBrowser } from "@/components/section-browser";

export default async function TrainDataPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ path?: string }>;
}) {
  const { projectId } = await params;
  const { path } = await searchParams;
  return (
    <SectionBrowser projectId={projectId} section="train_data" rawPath={path ?? ""} />
  );
}
