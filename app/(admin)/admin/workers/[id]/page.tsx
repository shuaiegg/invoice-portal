export default async function AdminWorkerDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Worker Details</h1>
      <p className="text-gray-600">Viewing worker: {id}</p>
    </div>
  );
}
