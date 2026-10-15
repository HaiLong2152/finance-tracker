const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN");

export const formatMoney = (amount) => moneyFormatter.format(Number(amount));

export const formatDate = (value) => {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return dateFormatter.format(date);
};

export const formatDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const formatAccountType = (type) => {
  switch (type) {
    case "cash":
      return "Tiền mặt";
    case "bank":
      return "Ngân hàng";
    case "ewallet":
      return "Ví điện tử";
    default:
      return "Khác";
  }
};

export const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getCurrentMonth = (d = new Date()) => {
  return getLocalDateString(d).slice(0, 7);
};

