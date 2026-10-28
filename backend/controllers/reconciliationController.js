const reconciliationService = require('../services/reconciliationService');

const previewReconciliation = async (req, res, next) => {
    try {
        const data = await reconciliationService.previewReconciliation(req.body);
        res.json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

const confirmReconciliation = async (req, res, next) => {
    try {
        const result = await reconciliationService.confirmReconciliation(req.body);
        res.status(201).json({
            success: true,
            message: result.message,
            data: result.reconciliation
        });
    } catch (error) {
        next(error);
    }
};

const getReconciliations = async (req, res, next) => {
    try {
        const data = await reconciliationService.getReconciliations(req.query);
        res.json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

const getReconciliationById = async (req, res, next) => {
    try {
        const data = await reconciliationService.getReconciliationById(req.params.id);
        res.json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    previewReconciliation,
    confirmReconciliation,
    getReconciliations,
    getReconciliationById
};

