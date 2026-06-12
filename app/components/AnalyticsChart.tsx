import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface AnalyticsChartProps {
  data: Array<{ date: string; revenue: number }>;
}

function formatDate(date: string): string {
  const parsed = new Date(date);
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AnalyticsChart({ data }: AnalyticsChartProps) {
  if (data.length === 0) {
    return (
      <s-box
        padding="large"
        borderWidth="base"
        borderRadius="base"
        background="subdued"
      >
        <s-paragraph>No revenue data yet. Activate a bundle to start tracking.</s-paragraph>
      </s-box>
    );
  }

  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="subdued"
    >
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e1e3e5" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 12, fill: "#6d7175" }}
              axisLine={{ stroke: "#e1e3e5" }}
            />
            <YAxis
              tickFormatter={(v) => formatCurrency(Number(v))}
              tick={{ fontSize: 12, fill: "#6d7175" }}
              axisLine={{ stroke: "#e1e3e5" }}
              width={72}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
              labelFormatter={(label) => formatDate(String(label))}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#008060"
              strokeWidth={2}
              dot={{ fill: "#008060", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </s-box>
  );
}
