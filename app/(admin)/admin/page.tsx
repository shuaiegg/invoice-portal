export default function AdminDashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-lg shadow border border-gray-200">
          <h2 className="text-sm font-medium text-gray-500">Total Workers</h2>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow border border-gray-200">
          <h2 className="text-sm font-medium text-gray-500">Pending Invoices</h2>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow border border-gray-200">
          <h2 className="text-sm font-medium text-gray-500">Approved This Month</h2>
          <p className="text-2xl font-bold">0</p>
        </div>
      </div>
    </div>
  );
}
