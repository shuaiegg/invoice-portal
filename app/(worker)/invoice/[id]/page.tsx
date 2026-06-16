export default async function InvoiceDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Invoice Details</h1>
      <p className="text-gray-600">Viewing invoice: {id}</p>
    </div>
  );
}
