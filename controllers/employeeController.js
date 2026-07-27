'use strict';
const Employee = require('../models/Employee');

const ok   = (res, data, code = 200) => res.status(code).json({ success: true,  data });
const fail = (res, msg,  code = 400) => res.status(code).json({ success: false, error: msg });

exports.list = (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    ok(res, Employee.findAll({ includeInactive }));
  } catch (e) { fail(res, e.message, 500); }
};

exports.getById = (req, res) => {
  const emp = Employee.findById(Number(req.params.id));
  if (!emp) return fail(res, 'Employee not found', 404);
  ok(res, emp);
};

exports.getOrgTree = (req, res) => {
  try {
    ok(res, Employee.getOrgTree());
  } catch (e) { fail(res, e.message, 500); }
};

exports.getDirectReports = (req, res) => {
  try {
    ok(res, Employee.findDirectReports(Number(req.params.id)));
  } catch (e) { fail(res, e.message, 500); }
};

exports.create = (req, res) => {
  const { name, email, role, department, manager_id, start_date, salary, employment_type } = req.body;
  const missing = ['name','email','role','department','start_date','salary','employment_type']
    .filter(f => !req.body[f]);
  if (missing.length) return fail(res, `Missing required fields: ${missing.join(', ')}`);

  if (!['full-time','part-time','contract'].includes(employment_type))
    return fail(res, 'employment_type must be full-time | part-time | contract');

  try {
    const emp = Employee.create({
      name: name.trim(), email: email.trim().toLowerCase(),
      role: role.trim(), department: department.trim(),
      manager_id: manager_id || null, start_date, salary: Number(salary),
      employment_type
    });
    ok(res, emp, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return fail(res, 'Email already registered');
    fail(res, e.message, 500);
  }
};

exports.update = (req, res) => {
  const id  = Number(req.params.id);
  const emp = Employee.findById(id);
  if (!emp) return fail(res, 'Employee not found', 404);

  // Whitelist updateable fields
  const allowed = ['name','email','role','department','manager_id','salary','employment_type'];
  const updates = {};
  for (const f of allowed) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (!Object.keys(updates).length) return fail(res, 'No updateable fields provided');

  try {
    ok(res, Employee.update(id, updates));
  } catch (e) { fail(res, e.message, 500); }
};

exports.deactivate = (req, res) => {
  const id = Number(req.params.id);
  if (!Employee.findById(id)) return fail(res, 'Employee not found', 404);
  try {
    ok(res, Employee.deactivate(id));
  } catch (e) { fail(res, e.message, 500); }
};

exports.reactivate = (req, res) => {
  const id = Number(req.params.id);
  if (!Employee.findById(id)) return fail(res, 'Employee not found', 404);
  try {
    ok(res, Employee.reactivate(id));
  } catch (e) { fail(res, e.message, 500); }
};
