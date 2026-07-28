'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/leaveController');

router.get('/',                       ctrl.list);
router.get('/pending',                ctrl.getPending);
router.get('/who-is-out',             ctrl.whoIsOut);
router.get('/escalate',               ctrl.escalate);
router.get('/balances/:employeeId',   ctrl.getBalances);
router.get('/:id',                    ctrl.getById);
router.post('/',                      ctrl.submit);
router.patch('/:id/approve',          ctrl.approve);
router.patch('/:id/reject',           ctrl.reject);
router.patch('/:id/cancel',           ctrl.cancel);

module.exports = router;
 