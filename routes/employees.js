'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/employeeController');

router.get('/',                  ctrl.list);
router.get('/org-tree',          ctrl.getOrgTree);
router.get('/:id',               ctrl.getById);
router.get('/:id/reports',       ctrl.getDirectReports);
router.post('/',                 ctrl.create);
router.patch('/:id',             ctrl.update);
router.patch('/:id/deactivate',  ctrl.deactivate);
router.patch('/:id/reactivate',  ctrl.reactivate);

module.exports = router;
