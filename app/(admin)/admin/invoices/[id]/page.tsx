export default async function AdminInvoiceDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Invoice Review</h1>
      <p className="text-gray-600">Reviewing invoice: {id}</p>
    </div>
  );
}
