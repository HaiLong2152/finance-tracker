import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatMoney } from "../../utils/formatters";

const formatShortAmount = (num) => {
  if (!num || num === 0) return "0";
  if (Math.abs(num) >= 1000000) {
    const val = (num / 1000000).toFixed(1).replace(/\.0$/, "");
    return `${val}tr`;
  }
  if (Math.abs(num) >= 1000) {
    const val = (num / 1000).toFixed(0);
    return `${val}k`;
  }
  return String(num);
};

const CustomTrendTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const income = payload.find((p) => p.dataKey === "income")?.value || 0;
    const expense = payload.find((p) => p.dataKey === "expense")?.value || 0;
    const net = income - expense;

    return (
      <div className="chart-tooltip">
        <strong className="tooltip-title">Tháng {label}</strong>
        <div className="tooltip-row text-success">
          <span>Thu nhập:</span>
          <strong>+{formatMoney(income)}</strong>
        </div>
        <div className="tooltip-row text-danger">
          <span>Chi tiêu:</span>
          <strong>-{formatMoney(expense)}</strong>
        </div>
        <div className="tooltip-row tooltip-net">
          <span>Chênh lệch:</span>
          <strong className={net >= 0 ? "positive" : "negative"}>
            {net >= 0 ? "+" : ""}{formatMoney(net)}
          </strong>
        </div>
      </div>
    );
  }
  return null;
};

function TrendBarChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty-state">
        <p>Chưa có dữ liệu xu hướng thu chi.</p>
      </div>
    );
  }

  return (
    <div className="trend-chart-wrapper">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
          barGap={6}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#f1f5f3"
          />
          <XAxis
            dataKey="label"
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            tickFormatter={formatShortAmount}
            stroke="#6b7280"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTrendTooltip />} />
          <Legend
            iconType="circle"
            wrapperStyle={{ paddingTop: 10, fontSize: 13 }}
          />
          <Bar
            dataKey="income"
            name="Thu nhập"
            fill="#25815e"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="expense"
            name="Chi tiêu"
            fill="#ef4444"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TrendBarChart;

