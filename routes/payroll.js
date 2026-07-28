'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/payrollController');

router.get('/',                       ctrl.listRuns);
router.get('/:id',                    ctrl.getRunById);
router.get('/:id/payslips',           ctrl.getSlipsByRun);
router.get('/employee/:employeeId',   ctrl.getSlipsByEmployee);
router.post('/generate',              ctrl.generateRun);
router.patch('/:id/finalize',         ctrl.finalizeRun);
router.delete('/:id',                 ctrl.deleteRun);

module.exports = router;
