const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const expenseController = require("../controllers/expense.controller");
const validate = require("../middlewares/validate.middleware"); // ✅ Phase 7
const expenseValidator = require("../validators/expense.validator"); // ✅ Phase 7

// All routes require auth
router.use(verifyToken);

// Helper: check if manager has expense permission
const requireExpensePerm = (action) => (req, res, next) => {
    const { role, permissions } = req.user;
    if (role === "admin" || role === "super_admin") return next();
    if (role === "manager") {
        const hasPerm = permissions && (
            permissions.includes("expenses") ||
            permissions.includes(`expenses.${action}`)
        );
        if (hasPerm) return next();
    }
    return res.status(403).json({ success: false, message: "Access denied" });
};

// GET all expenses — admin, super_admin, manager with expenses.read
router.get("/", requireExpensePerm("read"), validate(expenseValidator.getExpenses), expenseController.getExpenses);

// GET expense stats — admin, super_admin, manager with expenses.read
router.get("/stats", requireExpensePerm("read"), expenseController.getExpenseStats);

// POST add expense — admin, super_admin, manager with expenses.create
router.post("/", requireExpensePerm("create"), validate(expenseValidator.addExpense), expenseController.addExpense);

// DELETE expense — admin, super_admin, manager with expenses.delete
router.delete("/:id", requireExpensePerm("delete"), validate(expenseValidator.deleteExpense), expenseController.deleteExpense);

module.exports = router;
