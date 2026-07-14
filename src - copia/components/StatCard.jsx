import React from "react";
import { Card } from "@/components/ui/card";

const colorMap = {
  primary: "text-primary bg-primary/10",
  green: "text-chart-2 bg-chart-2/10",
  red: "text-destructive bg-destructive/10",
  blue: "text-chart-4 bg-chart-4/10",
};

export default function StatCard({ icon: Icon, label, value, accent = "primary" }) {
  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold font-heading text-foreground">{value}</p>
    </Card>
  );
}