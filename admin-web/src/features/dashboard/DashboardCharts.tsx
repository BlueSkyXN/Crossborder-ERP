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

const chartWidth = 720;
const chartHeight = 260;
const padding = { top: 18, right: 24, bottom: 34, left: 48 };

function buildChartModel(data: DashboardTrendPoint[]) {
  const values = data.map((item) => item.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = Math.max(maxValue - minValue, 1);
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const points = data.map((item, index) => {
    const x = padding.left + (innerWidth * index) / Math.max(data.length - 1, 1);
    const y = padding.top + innerHeight - ((item.value - minValue) / valueRange) * innerHeight;
    return { ...item, x, y };
  });
  const ticks = Array.from({ length: 4 }, (_, index) => {
    const value = minValue + (valueRange * index) / 3;
    const y = padding.top + innerHeight - ((value - minValue) / valueRange) * innerHeight;
    return { value: Math.round(value), y };
  });

  return {
    points,
    ticks,
    linePoints: points.map((point) => `${point.x},${point.y}`).join(" "),
    areaPoints: [
      `${padding.left},${padding.top + innerHeight}`,
      ...points.map((point) => `${point.x},${point.y}`),
      `${padding.left + innerWidth},${padding.top + innerHeight}`,
    ].join(" "),
  };
}

export function DashboardCharts({ data = demoTrendData }: { data?: DashboardTrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div style={{ height: chartHeight, display: "grid", placeItems: "center", color: "#6b7280" }}>
        暂无趋势数据
      </div>
    );
  }

  const chart = buildChartModel(data);

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg
        aria-label="月度订单趋势"
        role="img"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        style={{ display: "block", width: "100%", minWidth: 520, height: chartHeight }}
      >
        <defs>
          <linearGradient id="dashboard-trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1677ff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#1677ff" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#fff" />
        {chart.ticks.map((tick) => (
          <g key={tick.value}>
            <line x1={padding.left} x2={chartWidth - padding.right} y1={tick.y} y2={tick.y} stroke="#e5e7eb" />
            <text x={padding.left - 10} y={tick.y + 4} textAnchor="end" fontSize="12" fill="#6b7280">
              {tick.value}
            </text>
          </g>
        ))}
        <polyline points={chart.areaPoints} fill="url(#dashboard-trend-fill)" stroke="none" />
        <polyline
          points={chart.linePoints}
          fill="none"
          stroke="#1677ff"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {chart.points.map((point, index) => (
          <g key={point.month}>
            <circle cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#1677ff" strokeWidth="2">
              <title>{`${point.month}: ${point.value}`}</title>
            </circle>
            {index % 2 === 0 || index === chart.points.length - 1 ? (
              <text x={point.x} y={chartHeight - 10} textAnchor="middle" fontSize="12" fill="#6b7280">
                {point.month}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}
