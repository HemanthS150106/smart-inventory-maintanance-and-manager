import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
)

const PRIMARY = '#1E3A8A'
const ACCENT = '#F59E0B'
const COMPARE_COLORS = ['#ea5545', '#f46a9b', '#ef9b20', '#edbf33', '#ede15b', '#bdcf32', '#87bc45', '#27aeef', '#b33dc6']

export default function ForecastLineChart({ 
  labels, 
  forecast, 
  lower, 
  upper, 
  compareData, // Array of { name, data }
  reorderPoint,
  depletionData // array identical to labels length
}) {
  const isCompare = compareData && compareData.length > 0;

  let datasets = [];

  if (isCompare) {
      datasets = compareData.map((prod, i) => ({
          label: prod.name,
          data: prod.data,
          borderColor: COMPARE_COLORS[i % COMPARE_COLORS.length],
          backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length],
          pointRadius: 0,
          pointHoverRadius: 5,
          borderWidth: 2.5,
          tension: 0.25,
          fill: false,
      }));
  } else {
      datasets = [
        {
          label: 'Likely Bound',
          data: upper,
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          pointRadius: 0,
          tension: 0.25,
          fill: false,
        },
        {
          label: 'Likely Range',
          data: lower,
          borderColor: 'transparent',
          backgroundColor: `${PRIMARY}14`,
          pointRadius: 0,
          tension: 0.25,
          fill: '-1',
        },
        {
          label: 'Expected Daily Sales',
          data: forecast,
          borderColor: PRIMARY,
          backgroundColor: PRIMARY,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: ACCENT,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          borderWidth: 2.5,
          tension: 0.25,
          fill: false,
        }
      ]
      if (depletionData) {
         datasets.push({
            label: 'Stock Depletion',
            data: depletionData,
            borderColor: '#ef4444',
            backgroundColor: '#ef4444',
            borderDash: [5, 5],
            pointRadius: 0,
            borderWidth: 2,
            fill: false
         });
      }
  }

  // Draw horizontal lines
  const horizontalLinesPlugin = {
    id: 'horizontalLines',
    beforeDraw: (chart) => {
      const { ctx, chartArea: { left, right, top, bottom }, scales: { x, y } } = chart;
      if (isCompare) return;

      const drawLine = (val, color, label) => {
        if (val === undefined || val === null) return;
        const yPos = y.getPixelForValue(val);
        if (yPos > bottom || yPos < top) return;
        ctx.save(); ctx.beginPath(); ctx.setLineDash([5, 5]);
        ctx.moveTo(left, yPos); ctx.lineTo(right, yPos);
        ctx.lineWidth = 1.5; ctx.strokeStyle = color; ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(left + 5, yPos - 18, ctx.measureText(label).width + 10, 16);
        ctx.fillStyle = color; ctx.font = '10px sans-serif';
        ctx.fillText(label, left + 10, yPos - 6); ctx.restore();
      };
      
      drawLine(reorderPoint, '#f59e0b', `Reorder Point (${reorderPoint})`);

      // Find crossover (stockout)
      if (depletionData && forecast) {
          let stockoutIdx = depletionData.findIndex(d => d <= 0);
          if (stockoutIdx !== -1) {
              const stockoutX = x.getPixelForValue(labels[stockoutIdx]);
              ctx.save(); ctx.beginPath();
              ctx.moveTo(stockoutX, top); ctx.lineTo(stockoutX, bottom);
              ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'; ctx.stroke();
              ctx.fillStyle = 'rgba(239, 68, 68, 0.9)'; ctx.font = 'bold 10px sans-serif';
              ctx.fillText(' STOCKOUT', stockoutX + 5, top + 15);
              ctx.restore();
          }
      }
    }
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8, filter: (item) => item.text !== 'Likely Bound' } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed.y;
            if (v == null) return `${ctx.dataset.label}: —`;
            return `${ctx.dataset.label}: ${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
          },
        },
      },
      horizontalLines: {} 
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: 12, color: '#64748b', font: { size: 11 } }, border: { display: false } },
      y: { beginAtZero: true, title: { display: true, text: 'Units', color: '#64748b', font: { size: 11 } }, grid: { color: '#e2e8f0' }, ticks: { color: '#64748b', font: { size: 11 }, callback: (value) => typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value }, border: { display: false } },
    },
  }

  return (
    <div className="h-[min(420px,55vh)] w-full min-h-[280px]">
      <Line data={{ labels, datasets }} options={options} plugins={[horizontalLinesPlugin]} />
    </div>
  )
}
