import { Line } from "@ant-design/charts";

export type DashboardTrendPoint = {
  month: string;
  value: number;
};

const demoTrendData: DashboardTrendPoint[] = [
  { month: "1月", value: 128 },
  { month: "2月", value: 156 },
  { month: "3月", value: 142 },
  { month: "4月", value: 188 },
  { month: "5月", value: 216 },
  { month: "6月", value: 238 },
  { month: "7月", value: 262 },
  { month: "8月", value: 284 },
  { month: "9月", value: 251 },
  { month: "10月", value: 306 },
  { month: "11月", value: 342 },
  { month: "12月", value: 368 },
];

export function DashboardCharts({ data = demoTrendData }: { data?: DashboardTrendPoint[] }) {
  return (
    <Line
      data={data}
      xField="month"
      yField="value"
      height={260}
      point={{ size: 4, shapeField: "circle" }}
      axis={{
        x: { title: "月份" },
        y: { title: "订单量" },
      }}
      tooltip={{ title: "month" }}
    />
  );
}
