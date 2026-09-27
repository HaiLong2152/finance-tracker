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
