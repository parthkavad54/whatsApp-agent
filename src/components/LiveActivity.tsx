
export function LiveActivity({ activities }: { activities: any[] }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm">
      <h3 className="text-sm font-semibold mb-4">Live Activity</h3>
      <div className="space-y-4">
        {activities.map((act, i) => (
          <div key={i} className="flex gap-3 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1" />
            <div>
              <p className="font-medium text-stone-900">{act.text}</p>
              <p className="text-stone-400">{act.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
