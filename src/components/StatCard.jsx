import { ArrowUpRight } from "lucide-react";

export default function StatCard({
  icon: Icon,
  label,
  value,
  accent = "primary",
}) {
  const colors = {
    primary: "text-primary bg-primary/10",
    green: "text-green-500 bg-green-500/10",
    red: "text-red-500 bg-red-500/10",
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <div className="flex items-center justify-between mb-5">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[accent]}`}
        >
          {Icon && <Icon className="w-6 h-6" />}
        </div>

        <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
      </div>

      <p className="text-sm text-muted-foreground">
        {label}
      </p>

      <h2 className="text-3xl font-bold text-foreground mt-1">
        {value}
      </h2>
    </div>
  );
}