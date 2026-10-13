const reportRepository = require('../repositories/reportRepository');
const AppError = require('../utils/AppError');

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const getCurrentMonth = () => {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit'
    }).format(new Date()).slice(0, 7);
};

const getPreviousMonth = (month) => {
    const [year, m] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, m - 2, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const validateMonth = (month) => {
    if (!month || typeof month !== 'string' || !MONTH_REGEX.test(month)) {
        throw new AppError('Định dạng tháng không hợp lệ (yêu cầu định dạng YYYY-MM, ví dụ: 2026-10).', 400);
    }
    return month;
};

const getSummary = async (monthQuery) => {
    const month = monthQuery ? validateMonth(monthQuery) : getCurrentMonth();
    const prevMonth = getPreviousMonth(month);

    const [current, previous] = await Promise.all([
        reportRepository.getMonthlySummary(month),
        reportRepository.getMonthlySummary(prevMonth)
    ]);

    const incomeChange = current.income - previous.income;
    const expenseChange = current.expense - previous.expense;
    const incomePctChange = previous.income > 0 
        ? Math.round(((current.income - previous.income) / previous.income) * 100) 
        : null;
    const expensePctChange = previous.expense > 0 
        ? Math.round(((current.expense - previous.expense) / previous.expense) * 100) 
        : null;

    return {
        month,
        current,
        previous: {
            month: prevMonth,
            ...previous
        },
        comparison: {
            income_change: incomeChange,
            expense_change: expenseChange,
            income_pct_change: incomePctChange,
            expense_pct_change: expensePctChange
        }
    };
};

const getByCategory = async (monthQuery) => {
    const month = monthQuery ? validateMonth(monthQuery) : getCurrentMonth();
    const items = await reportRepository.getCategoryBreakdown(month);
    const totalExpense = items.reduce((sum, item) => sum + item.total_amount, 0);

    return {
        month,
        total_expense: totalExpense,
        items
    };
};

const getTrend = async (monthsCountQuery) => {
    let count = 6;
    if (monthsCountQuery !== undefined && monthsCountQuery !== null && monthsCountQuery !== '') {
        const parsed = Number(monthsCountQuery);
        if (!Number.isSafeInteger(parsed) || parsed < 2 || parsed > 12) {
            throw new AppError('Số tháng cần xem xu hướng phải từ 2 đến 12 tháng.', 400);
        }
        count = parsed;
    }

    const currentMonth = getCurrentMonth();
    const [currYear, currM] = currentMonth.split('-').map(Number);

    // Tạo danh sách N tháng gần nhất
    const monthsList = [];
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(currYear, currM - 1 - i, 1));
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        monthsList.push(`${y}-${m}`);
    }

    const startMonth = monthsList[0];
    const endMonth = monthsList[monthsList.length - 1];

    const rawData = await reportRepository.getTrendData(startMonth, endMonth);
    const rawMap = new Map(rawData.map(r => [r.month, r]));

    const data = monthsList.map(m => {
        const record = rawMap.get(m);
        const income = record ? record.income : 0;
        const expense = record ? record.expense : 0;
        const net = income - expense;
        const [yStr, mStr] = m.split('-');
        const label = `T${Number(mStr)}/${yStr.slice(2)}`;
        const savingsRate = income > 0 ? Math.max(0, Math.round((net / income) * 100)) : 0;

        return {
            month: m,
            label,
            income,
            expense,
            net,
            savings_rate: savingsRate
        };
    });

    return {
        months_count: count,
        start_month: startMonth,
        end_month: endMonth,
        data
    };
};

module.exports = {
    getSummary,
    getByCategory,
    getTrend
};

