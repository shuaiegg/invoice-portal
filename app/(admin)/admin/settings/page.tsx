"use client";
import { useEffect, useState } from "react";

interface WebhookConfig {
  key: string;
  url: string;
  enabled: boolean;
  environment: string;
  lastTriggeredAt: string | null;
}

export default function AdminSettingsPage() {
  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    url: "",
    environment: "development",
    secret: "",
    internalSecret: "",
  });

  const fetchConfigs = async () => {
    try {
      const res = await fetch("/api/admin/settings/webhooks");
      const data = await res.json();
      setConfigs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch configs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleToggle = async (key: string, enabled: boolean) => {
    const originalConfigs = [...configs];
    setConfigs(configs.map((c) => (c.key === key ? { ...c, enabled } : c)));

    try {
      const config = configs.find((c) => c.key === key);
      const res = await fetch(`/api/admin/settings/webhooks/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, enabled }),
      });
      if (!res.ok) throw new Error();
    } catch (error) {
      setConfigs(originalConfigs);
      alert("Failed to update toggle");
    }
  };

  const startEditing = (config: WebhookConfig) => {
    setEditingKey(config.key);
    setEditForm({
      url: "", // Don't pre-fill masked URL
      environment: config.environment,
      secret: "",
      internalSecret: "",
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKey) return;

    try {
      const res = await fetch(`/api/admin/settings/webhooks/${editingKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          enabled: configs.find((c) => c.key === editingKey)?.enabled ?? true,
        }),
      });
      if (!res.ok) throw new Error();
      setEditingKey(null);
      fetchConfigs();
    } catch (error) {
      alert("Failed to save changes");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Admin Settings</h1>
      </div>

      <section className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">Webhook Configurations</h2>
          <p className="text-sm text-gray-500">
            Manage n8n webhook integration endpoints and secrets.
          </p>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading configurations...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    URL (Masked)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Env
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Enabled
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Triggered
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {configs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                      No webhooks configured. Add one below.
                    </td>
                  </tr>
                )}
                {configs.map((config) => (
                  <tr key={config.key}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {config.key}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {config.url}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {config.environment}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggle(config.key, !config.enabled)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          config.enabled ? "bg-blue-600" : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            config.enabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {config.lastTriggeredAt
                        ? new Date(config.lastTriggeredAt).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => startEditing(config)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit Form / Add Form */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">
          {editingKey ? `Edit ${editingKey}` : "Add New Webhook"}
        </h2>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!editingKey && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Event Key</label>
              <input
                type="text"
                placeholder="e.g., invoice.submitted"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                onChange={(e) => {
                  setEditingKey(e.target.value);
                  setEditForm({ ...editForm });
                }}
                required
              />
            </div>
          )}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Full Webhook URL</label>
            <input
              type="url"
              value={editForm.url}
              onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder="https://n8n.yourdomain.com/webhook/..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Environment</label>
            <select
              value={editForm.environment}
              onChange={(e) => setEditForm({ ...editForm, environment: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            >
              <option value="development">Development</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Webhook Secret (X-Webhook-Secret)
            </label>
            <input
              type="text"
              value={editForm.secret}
              onChange={(e) => setEditForm({ ...editForm, secret: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Internal Secret (for Callback)
            </label>
            <input
              type="text"
              value={editForm.internalSecret}
              onChange={(e) => setEditForm({ ...editForm, internalSecret: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder="Optional"
            />
          </div>
          <div className="md:col-span-2 flex justify-end space-x-3">
            {editingKey && (
              <button
                type="button"
                onClick={() => setEditingKey(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              {editingKey ? "Save Changes" : "Add Webhook"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
