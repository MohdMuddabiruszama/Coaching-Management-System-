# ZenithFlows Gateway Agent

The ZenithFlows Gateway Agent is a background service that connects to biometric attendance devices on your local network (LAN) and securely syncs punch data to the cloud in real-time.

## Installation Instructions

1. Ensure the PC running this agent is on the **same LAN** (same Wi-Fi or Ethernet network) as the biometric device.
2. Open `config.json` in Notepad.
3. Replace `"YOUR_DEVICE_TOKEN_HERE"` with the Device Token provided in the ZenithFlows Admin Panel (under Devices -> Manual Add -> TCP/IP LAN).
4. Run the Gateway Agent:
   - If using the `.exe` version, simply double-click `ZenithFlowsGateway-Installer.exe` (or run it from Command Prompt).
   - If using the Node.js version, run `npm install` and then `npm start`.

## Troubleshooting

- **Connection Timeout:** Ensure the IP address of the biometric device is correct and the device is powered on.
- **Invalid Token:** Ensure the device token exactly matches the one in the ZenithFlows Admin Panel.
- **Port Error:** Most devices use port 4370. If your device uses a different port, update it in the ZenithFlows Admin Panel.
