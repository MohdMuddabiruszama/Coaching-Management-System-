/**
 * Static Biometric Device Catalog
 * ─────────────────────────────────────────────────────────────────
 * The single source of truth for every supported brand + model.
 * ✅ Zero DB queries — this is a pure in-memory config file.
 * ✅ Adding a new device = add one entry here. No migration needed.
 * ✅ Not user-editable — changes are deployed with the codebase.
 *
 * connection_type values:
 *   lan_push          — device pushes to our server via ADMS/WDMS protocol
 *   cloud_gateway     — device connects via a cloud API (Suprema BioStar 2, etc.)
 *   usb_enrollment_only — USB scanner only (Mantra MFS100) — excluded from this picker
 *
 * warranty_warning: true → shows ⚠ "Buy from authorized dealer" tooltip on picker card
 */

const DEVICE_CATALOG = [
    // ─────────────────────────────────────────────
    // ZKTeco — LAN Push (ADMS) — Reference brand
    // ─────────────────────────────────────────────
    {
        id: "zkteco_k40pro",
        brand: "zkteco",
        brand_label: "ZKTeco",
        model: "K40 Pro",
        connection_type: "lan_push",
        protocol: "ADMS",
        device_types: ["fingerprint"],
        badge: "Most Popular",
        badge_color: "#6366f1",
        color_accent: "#6366f1",
        description: "Entry-level fingerprint terminal. Connect once via the device menu and it pushes attendance logs automatically.",
        warranty_warning: false,
        setup_instructions: {
            summary: "Enter your server address in the device's Cloud settings menu. That's it — the device does the rest.",
            steps: [
                "Power on the device and connect it to your local network via Ethernet",
                "On the device: press Menu → COMM → Cloud Server Setting",
                "Set 'Server Address' to your server IP/domain",
                "Set 'Server Port' to 80 (or 443 for HTTPS)",
                "Enable 'Cloud Push' and press OK",
                "Wait up to 60 seconds — device will connect and send a test ping"
            ],
            field_hints: {
                ip_address: "The device's local IP (from the device menu under COMM → Ethernet)",
                device_serial: "Found on the device back label or under Menu → System Info"
            }
        }
    },
    {
        id: "zkteco_iface402",
        brand: "zkteco",
        brand_label: "ZKTeco",
        model: "iFace402",
        connection_type: "lan_push",
        protocol: "ADMS",
        device_types: ["face", "fingerprint"],
        badge: "Face + Fingerprint",
        badge_color: "#8b5cf6",
        color_accent: "#6366f1",
        description: "Dual-mode face and fingerprint recognition. Same ADMS push setup as K40 Pro.",
        warranty_warning: false,
        setup_instructions: {
            summary: "Same ADMS Cloud Server setup as the K40 Pro.",
            steps: [
                "Power on and connect to your LAN via Ethernet",
                "Menu → COMM → Cloud Server Setting",
                "Enter your server address and port",
                "Enable Cloud Push and save",
                "Device connects within 60 seconds"
            ],
            field_hints: {
                ip_address: "Device local IP (Menu → COMM → Ethernet → IP Address)",
                device_serial: "Back label or Menu → System Info"
            }
        }
    },
    {
        id: "zkteco_minita",
        brand: "zkteco",
        brand_label: "ZKTeco",
        model: "MINITA",
        connection_type: "lan_push",
        protocol: "ADMS",
        device_types: ["fingerprint"],
        badge: "Compact",
        badge_color: "#64748b",
        color_accent: "#6366f1",
        description: "Compact wall-mount fingerprint terminal, ideal for classroom doorways.",
        warranty_warning: false,
        setup_instructions: {
            summary: "ADMS push setup — same as all ZKTeco devices.",
            steps: [
                "Connect device to LAN",
                "Menu → COMM → Cloud Server",
                "Enter server address and port",
                "Save and wait 60 seconds"
            ],
            field_hints: {
                ip_address: "Find in Menu → COMM → Ethernet",
                device_serial: "Back label or Menu → About"
            }
        }
    },

    // ─────────────────────────────────────────────
    // eSSL — LAN Push (ADMS/WDMS)
    // ─────────────────────────────────────────────
    {
        id: "essl_x990",
        brand: "essl",
        brand_label: "eSSL",
        model: "X990",
        connection_type: "lan_push",
        protocol: "ADMS/WDMS",
        device_types: ["fingerprint"],
        badge: "Easy Setup",
        badge_color: "#059669",
        color_accent: "#059669",
        description: "Popular Indian market terminal. Uses ADMS push — 90–98% success rate across firmware versions.",
        warranty_warning: true,
        setup_instructions: {
            summary: "Navigate to the server settings on the device and enter your push server address.",
            steps: [
                "Connect device to LAN and power on",
                "Press Menu → COMM → Cloud / Server Settings",
                "Set Server IP/Domain to your push server address",
                "Set Port to 80 (or 443)",
                "Enable 'Enable Cloud' / 'Push' option",
                "Save and exit — device will connect within 2 minutes"
            ],
            field_hints: {
                ip_address: "Device IP from Menu → COMM → Network Settings",
                device_serial: "Label on device body or Menu → System"
            }
        }
    },
    {
        id: "essl_x990plus",
        brand: "essl",
        brand_label: "eSSL",
        model: "X990+ID",
        connection_type: "lan_push",
        protocol: "ADMS/WDMS",
        device_types: ["fingerprint", "rfid"],
        badge: "Fingerprint + RFID",
        badge_color: "#0891b2",
        color_accent: "#059669",
        description: "X990 with RFID card support. Same ADMS push setup.",
        warranty_warning: true,
        setup_instructions: {
            summary: "Same setup as X990 — enter push server address in the device COMM menu.",
            steps: [
                "Connect to LAN and power on",
                "Menu → COMM → Server / Cloud Settings",
                "Enter server address and port 80",
                "Enable push and save"
            ],
            field_hints: {
                ip_address: "Device IP under Menu → COMM → Network",
                device_serial: "Device body label or Menu → System Info"
            }
        }
    },

    // ─────────────────────────────────────────────
    // Biomax — LAN Push (REST API / ADMS-compatible)
    // ─────────────────────────────────────────────
    {
        id: "biomax_k30",
        brand: "biomax",
        brand_label: "Biomax",
        model: "K30",
        connection_type: "lan_push",
        protocol: "ADMS",
        device_types: ["fingerprint"],
        badge: "Easy Setup",
        badge_color: "#059669",
        color_accent: "#d97706",
        description: "Standard fingerprint terminal with ADMS push support.",
        warranty_warning: true,
        setup_instructions: {
            summary: "Configure the push server address in the device network menu.",
            steps: [
                "Power on and connect to LAN",
                "Navigate to Menu → Network / COMM → Server Settings",
                "Enter your server IP and port",
                "Enable push and confirm"
            ],
            field_hints: {
                ip_address: "Device IP in Menu → Network Settings",
                device_serial: "Printed on device back"
            }
        }
    },
    {
        id: "biomax_ne90pro",
        brand: "biomax",
        brand_label: "Biomax",
        model: "N-E90 Pro",
        connection_type: "lan_push",
        protocol: "ADMS",
        device_types: ["face", "fingerprint"],
        badge: "Face + Fingerprint",
        badge_color: "#8b5cf6",
        color_accent: "#d97706",
        description: "Multi-modal biometric terminal (face + fingerprint). ADMS-compatible push protocol.",
        warranty_warning: true,
        setup_instructions: {
            summary: "Standard ADMS server setup — same as other LAN push devices.",
            steps: [
                "Connect to network and power on",
                "Menu → COMM → Server Configuration",
                "Enter server address + port",
                "Enable cloud push and save"
            ],
            field_hints: {
                ip_address: "Under Menu → COMM → LAN Settings",
                device_serial: "Back label of device"
            }
        }
    },

    // ─────────────────────────────────────────────
    // Realtime / Startek — LAN Push (ADMS-family)
    // ─────────────────────────────────────────────
    {
        id: "realtime_t502",
        brand: "realtime",
        brand_label: "Realtime",
        model: "T502 L-1",
        connection_type: "lan_push",
        protocol: "ADMS",
        device_types: ["fingerprint"],
        badge: "ADMS Compatible",
        badge_color: "#475569",
        color_accent: "#475569",
        description: "ADMS push-compatible fingerprint terminal, same protocol family as ZKTeco.",
        warranty_warning: false,
        setup_instructions: {
            summary: "Same ADMS server setup as ZKTeco devices.",
            steps: [
                "Connect to LAN and power on",
                "Menu → COMM → Cloud / Server Setting",
                "Set server address and port",
                "Enable push and save"
            ],
            field_hints: {
                ip_address: "Menu → COMM → Network → IP Address",
                device_serial: "Device back label or Menu → System Info"
            }
        }
    },
    {
        id: "realtime_t304f",
        brand: "realtime",
        brand_label: "Realtime",
        model: "T304F",
        connection_type: "lan_push",
        protocol: "ADMS",
        device_types: ["face"],
        badge: "Face Recognition",
        badge_color: "#7c3aed",
        color_accent: "#475569",
        description: "Face recognition terminal with ADMS push — no fingerprint enrollment needed.",
        warranty_warning: false,
        setup_instructions: {
            summary: "Standard ADMS server configuration.",
            steps: [
                "Connect to LAN",
                "Menu → COMM → Server Settings",
                "Enter push server address and port",
                "Save and test"
            ],
            field_hints: {
                ip_address: "Menu → Network Settings",
                device_serial: "Back label"
            }
        }
    },

    // ─────────────────────────────────────────────
    // Suprema — Cloud Gateway (BioStar 2 REST API)
    // ─────────────────────────────────────────────
    {
        id: "suprema_biostation2",
        brand: "suprema",
        brand_label: "Suprema",
        model: "BioStation 2",
        connection_type: "cloud_gateway",
        protocol: "BioStar 2 API",
        device_types: ["fingerprint", "face"],
        badge: "Cloud Gateway",
        badge_color: "#0891b2",
        color_accent: "#0891b2",
        description: "Enterprise-grade device. Uses Suprema BioStar 2 cloud API — no physical device menu configuration needed.",
        warranty_warning: false,
        setup_instructions: {
            summary: "Register your device in the Suprema BioStar 2 gateway. It will push events to us automatically.",
            steps: [
                "Log into your Suprema BioStar 2 account",
                "Add this device to your BioStar 2 gateway (if not already done)",
                "In BioStar 2: Settings → Event Push → Add Push URL",
                "Enter the webhook URL shown below",
                "Save — events will start flowing within minutes"
            ],
            field_hints: {
                device_serial: "Found in BioStar 2 dashboard → Devices → Device ID"
            }
        }
    },
    {
        id: "suprema_biostationl2",
        brand: "suprema",
        brand_label: "Suprema",
        model: "BioStation L2",
        connection_type: "cloud_gateway",
        protocol: "BioStar 2 API",
        device_types: ["fingerprint"],
        badge: "Cloud Gateway",
        badge_color: "#0891b2",
        color_accent: "#0891b2",
        description: "Fingerprint-only BioStation model via BioStar 2 cloud gateway.",
        warranty_warning: false,
        setup_instructions: {
            summary: "Same BioStar 2 gateway setup as BioStation 2.",
            steps: [
                "Log into Suprema BioStar 2",
                "Add device to gateway",
                "Configure Event Push with the webhook URL below",
                "Save and verify"
            ],
            field_hints: {
                device_serial: "BioStar 2 dashboard → Devices"
            }
        }
    },

    // ─────────────────────────────────────────────
    // Virtual / Simulator (Test Mode)
    // ─────────────────────────────────────────────
    {
        id: "simulator",
        brand: "simulator",
        brand_label: "Simulator",
        model: "Virtual Device",
        connection_type: "lan_push",
        protocol: "internal",
        device_types: ["fingerprint"],
        badge: "Test Mode",
        badge_color: "#f59e0b",
        color_accent: "#f59e0b",
        description: "No physical device needed. Use the built-in simulator to test your entire attendance pipeline from the browser.",
        warranty_warning: false,
        is_simulator: true,
        setup_instructions: {
            summary: "No physical device needed — punches are sent from the browser.",
            steps: [
                "No hardware setup required",
                "After registration, use the Simulator panel in the Live Attendance tab",
                "Pick a user and click 'Send Test Punch' to verify your setup"
            ],
            field_hints: {
                device_serial: "Auto-generated — you can use any value"
            }
        }
    }
];

/**
 * Get full catalog (all brands)
 * @returns {Array}
 */
function getCatalog() {
    return DEVICE_CATALOG;
}

/**
 * Find a single catalog entry by id
 * @param {string} catalogId
 * @returns {object|null}
 */
function findById(catalogId) {
    return DEVICE_CATALOG.find(d => d.id === catalogId) || null;
}

/**
 * Get brands grouped (for picker UI)
 */
function getGroupedByBrand() {
    const grouped = {};
    for (const device of DEVICE_CATALOG) {
        if (!grouped[device.brand]) {
            grouped[device.brand] = {
                brand: device.brand,
                brand_label: device.brand_label,
                color_accent: device.color_accent,
                models: []
            };
        }
        grouped[device.brand].models.push(device);
    }
    return Object.values(grouped);
}

module.exports = { getCatalog, findById, getGroupedByBrand, DEVICE_CATALOG };
