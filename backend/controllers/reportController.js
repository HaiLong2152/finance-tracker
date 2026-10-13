const reportService = require('../services/reportService');

const getSummary = async (req, res, next) => {
    try {
        const data = await reportService.getSummary(req.query.month);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const getByCategory = async (req, res, next) => {
    try {
        const data = await reportService.getByCategory(req.query.month);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const getTrend = async (req, res, next) => {
    try {
        const data = await reportService.getTrend(req.query.months);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSummary,
    getByCategory,
    getTrend
};

