


export function AgentTable({ agents }: { agents: any[] }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm">
      <h3 className="text-sm font-semibold mb-4">AI Agent Status</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-stone-400 border-b border-stone-100">
            <th className="text-left pb-2">Agent</th>
            <th className="text-left pb-2">Role</th>
            <th className="text-left pb-2">Status</th>
            <th className="text-left pb-2">Performance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50">
          {agents.map((agent) => (
            <tr key={agent.id} className="py-2">
              <td className="py-2">{agent.name}</td>
              <td className="py-2 text-stone-500">{agent.role}</td>
              <td className="py-2"><span className="px-2 py-1 rounded bg-stone-100 text-xs">{agent.status}</span></td>
              <td className="py-2">{agent.performance}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
