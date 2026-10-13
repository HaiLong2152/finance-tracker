import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { formatMoney } from "../../utils/formatters";

const CHART_COLORS = [
  "#25815e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
  "#64748b",
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="chart-tooltip">
        <strong className="tooltip-title">{data.name}</strong>
        <p className="tooltip-amount">{formatMoney(data.value)}</p>
        <span className="tooltip-percent">{data.percentage}% tổng chi</span>
      </div>
    );
  }
  return null;
};

function CategoryPieChart({ data = [] }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const chartData = useMemo(() => {
    return data
      .filter((item) => Number(item.total_amount || item.amount || 0) > 0)
      .map((item, index) => ({
        name: item.category_name || item.name,
        value: Number(item.total_amount || item.amount || 0),
        percentage: item.percentage || 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
  }, [data]);

  const totalExpense = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="chart-empty-state">
        <p>Chưa có dữ liệu chi tiêu để vẽ biểu đồ tròn.</p>
      </div>
    );
  }

  return (
    <div className="pie-chart-wrapper">
      <div className="pie-chart-container">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              paddingAngle={3}
              dataKey="value"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="#ffffff"
                  strokeWidth={index === activeIndex ? 3 : 1}
                  style={{
                    filter: index === activeIndex ? "drop-shadow(0 2px 8px rgba(0,0,0,0.2))" : "none",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Tổng tiền ở giữa vòng tròn Donut */}
        <div className="pie-center-label">
          <span className="center-caption">Tổng chi</span>
          <strong className="center-amount">{formatMoney(totalExpense)}</strong>
        </div>
      </div>

      {/* Chú thích danh mục dạng lưới sinh động */}
      <div className="chart-legend-grid">
        {chartData.map((entry, index) => (
          <div
            key={entry.name}
            className={`legend-item ${index === activeIndex ? "legend-active" : ""}`}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <span
              className="legend-color-dot"
              style={{ backgroundColor: entry.color }}
            />
            <span className="legend-name" title={entry.name}>
              {entry.name}
            </span>
            <span className="legend-value">{entry.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CategoryPieChart;

