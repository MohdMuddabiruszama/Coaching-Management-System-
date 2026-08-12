const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/iclock.controller");

// Device initial connection / handshake
router.get("/cdata", ctrl.handshake);
router.get("/cdata.aspx", ctrl.handshake); // some firmwares use this

// Device pushes attendance logs
router.post("/cdata", ctrl.receiveData);
router.post("/cdata.aspx", ctrl.receiveData);

// Device polling for commands
router.get("/getrequest", ctrl.getRequest);
router.get("/getrequest.aspx", ctrl.getRequest);

// Device returns command execution results
router.post("/devicecmd", ctrl.deviceCmd);
router.post("/devicecmd.aspx", ctrl.deviceCmd);

module.exports = router;
