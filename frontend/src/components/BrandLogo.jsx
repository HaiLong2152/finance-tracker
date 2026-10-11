import { useId } from "react";

export default function BrandLogo({ size = 34, className = "" }) {
  const uid = useId().replace(/:/g, "_");
  const bgGradId = `bgGrad_${uid}`;
  const walletGradId = `walletGrad_${uid}`;
  const walletFlapId = `walletFlap_${uid}`;
  const moneyGrad1Id = `moneyGrad1_${uid}`;
  const moneyGrad2Id = `moneyGrad2_${uid}`;
  const piggyGradId = `piggyGrad_${uid}`;
  const goldGradId = `goldGrad_${uid}`;
  const softShadowId = `softShadow_${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`brand-logo-svg ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* Nền gradient chuyển sắc Cam sang Xanh dương */}
        <linearGradient id={bgGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>

        {/* Gradient màu ví da nâu cam */}
        <linearGradient id={walletGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c2410c" />
          <stop offset="100%" stopColor="#9a3412" />
        </linearGradient>

        <linearGradient id={walletFlapId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#c2410c" />
        </linearGradient>

        {/* Gradient tiền giấy xanh */}
        <linearGradient id={moneyGrad1Id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id={moneyGrad2Id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>

        {/* Gradient heo đất hồng */}
        <linearGradient id={piggyGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>

        {/* Gradient đồng xu vàng */}
        <linearGradient id={goldGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="60%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>

        {/* Đổ bóng nhẹ các lớp */}
        <filter id={softShadowId} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* 1. NỀN ICON BO GÓC SQUIRCLE */}
      <rect width="120" height="120" rx="30" fill={`url(#${bgGradId})`} />

      {/* 2. BIỂU ĐỒ TĂNG TRƯỞNG & MŨI TÊN (Phía sau bên trái) */}
      <g opacity="0.95" filter={`url(#${softShadowId})`}>
        {/* Cột 1 */}
        <rect x="18" y="70" width="10" height="18" rx="3" fill="#60a5fa" />
        {/* Cột 2 */}
        <rect x="31" y="56" width="10" height="32" rx="3" fill="#34d399" />
        {/* Cột 3 */}
        <rect x="44" y="42" width="10" height="46" rx="3" fill="#10b981" />

        {/* Mũi tên tăng trưởng xanh bay lên */}
        <path
          d="M 16 68 Q 30 52 42 38 T 66 18"
          fill="none"
          stroke="#22c55e"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Đầu mũi tên */}
        <polygon points="62,13 72,16 66,25" fill="#22c55e" />
      </g>

      {/* 3. TỜ TIỀN GIẤY XANH NHÔ RA TỪ VÍ */}
      <g filter={`url(#${softShadowId})`}>
        {/* Tờ tiền sau (nghiêng nhẹ) */}
        <rect
          x="30"
          y="34"
          width="32"
          height="22"
          rx="3"
          fill={`url(#${moneyGrad1Id})`}
          transform="rotate(-10 46 45)"
        />
        <circle cx="45" cy="44" r="4" fill="#a7f3d0" opacity="0.7" />

        {/* Tờ tiền trước */}
        <rect
          x="38"
          y="38"
          width="34"
          height="24"
          rx="3"
          fill={`url(#${moneyGrad2Id})`}
          transform="rotate(6 55 50)"
        />
        <circle cx="56" cy="49" r="4.5" fill="#ecfdf5" opacity="0.8" />
      </g>

      {/* 4. CHÚ HEO ĐẤT TIẾT KIỆM (Phía phải) */}
      <g filter={`url(#${softShadowId})`}>
        {/* Thân heo tròn */}
        <ellipse cx="84" cy="68" rx="19" ry="17" fill={`url(#${piggyGradId})`} />
        {/* Tai heo */}
        <polygon points="76,53 82,46 84,54" fill="#fb7185" />
        {/* Mõm heo */}
        <ellipse cx="98" cy="69" rx="6" ry="5" fill="#fda4af" />
        <circle cx="96" cy="69" r="1.2" fill="#be123c" />
        <circle cx="99.5" cy="69" r="1.2" fill="#be123c" />
        {/* Mắt heo */}
        <circle cx="89" cy="63" r="2.2" fill="#1e293b" />
        <circle cx="90" cy="62.2" r="0.8" fill="#ffffff" />
        {/* Chân heo */}
        <rect x="73" y="82" width="6" height="6" rx="2" fill="#e11d48" />
        <rect x="87" y="82" width="6" height="6" rx="2" fill="#e11d48" />
      </g>

      {/* 5. CHIẾC VÍ DA NÂU CAM Ở TRUNG TÂM */}
      <g filter={`url(#${softShadowId})`}>
        {/* Thân ví da */}
        <rect x="22" y="52" width="46" height="40" rx="8" fill={`url(#${walletGradId})`} />
        {/* Nắp viền gập của ví */}
        <path
          d="M 22 60 C 22 55.6 25.6 52 30 52 L 60 52 C 64.4 52 68 55.6 68 60 L 68 66 C 68 70.4 64.4 74 60 74 L 30 74 C 25.6 74 22 70.4 22 66 Z"
          fill={`url(#${walletFlapId})`}
        />
        {/* Đai khóa ví */}
        <rect x="52" y="66" width="18" height="12" rx="4" fill="#ea580c" />
        {/* Nút bấm khóa kim loại vàng */}
        <circle cx="63" cy="72" r="3.2" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
      </g>

      {/* 6. CHỒNG ĐỒNG XU VÀNG Ở GÓC DƯỚI */}
      <g filter={`url(#${softShadowId})`}>
        {/* Xu 1 (đáy) */}
        <ellipse cx="80" cy="95" rx="14" ry="6" fill="#b45309" />
        <ellipse cx="80" cy="92" rx="14" ry="6" fill={`url(#${goldGradId})`} />
        {/* Xu 2 (giữa) */}
        <ellipse cx="80" cy="88" rx="14" ry="6" fill="#b45309" />
        <ellipse cx="80" cy="85" rx="14" ry="6" fill={`url(#${goldGradId})`} />
        {/* Xu 3 (trên đỉnh) */}
        <ellipse cx="80" cy="81" rx="14" ry="6" fill="#b45309" />
        <ellipse cx="80" cy="78" rx="14" ry="6" fill={`url(#${goldGradId})`} />
        {/* Ký hiệu đồng xu trên đỉnh */}
        <text
          x="80"
          y="81.5"
          fontSize="8"
          fontWeight="900"
          fill="#78350f"
          textAnchor="middle"
          fontFamily="system-ui"
        >
          ₫
        </text>

        {/* Xu rơi lẻ phía trước */}
        <ellipse cx="98" cy="93" rx="10" ry="5" fill="#b45309" />
        <ellipse cx="98" cy="90" rx="10" ry="5" fill={`url(#${goldGradId})`} />
        <text
          x="98"
          y="93"
          fontSize="6.5"
          fontWeight="900"
          fill="#78350f"
          textAnchor="middle"
          fontFamily="system-ui"
        >
          ₫
        </text>
      </g>

      {/* 7. TIA LẤP LÁNH (Sparkle ✨) */}
      <path
        d="M 102 24 Q 102 30 96 30 Q 102 30 102 36 Q 102 30 108 30 Q 102 30 102 24 Z"
        fill="#ffffff"
        opacity="0.9"
      />
      <circle cx="24" cy="22" r="1.5" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}
