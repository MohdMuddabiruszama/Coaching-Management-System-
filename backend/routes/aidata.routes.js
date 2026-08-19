/**
 * Biomax AI Push Protocol Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles all paths that Biomax N-series devices use when configured
 * with "Push Settings" → Server IP set to your domain.
 *
 * Known device paths (all return plain text, no JWT required):
 *   GET  /AIData.aspx       — Device handshake on boot
 *   POST /AIData.aspx       — Attendance data push (ATTLOG)
 *   GET  /getrequest.aspx   — Device polls for pending commands
 *   POST /devicecmd.aspx    — Device returns command execution result
 *
 * Note: Some firmware variants omit the .aspx extension — both forms are handled.
 */

const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/aidata.controller");

// ── Handshake (device boot / reconnect) ─────────────────────────────────────
router.get("/AIData.aspx",    ctrl.handshake);
router.get("/AIData",         ctrl.handshake); // firmware variant without .aspx

// ── Attendance push ──────────────────────────────────────────────────────────
router.post("/AIData.aspx",   ctrl.receiveData);
router.post("/AIData",        ctrl.receiveData);

// ── Command poll (device asking for pending commands) ────────────────────────
router.get("/getrequest.aspx", ctrl.getRequest);
router.get("/getrequest",      ctrl.getRequest);

// ── Command result (device reporting back after executing a command) ─────────
router.post("/devicecmd.aspx", ctrl.deviceCmd);
router.post("/devicecmd",      ctrl.deviceCmd);

module.exports = router;
