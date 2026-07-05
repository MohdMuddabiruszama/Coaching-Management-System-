const admin = require("firebase-admin");
const { initializeApp, getApps, cert, applicationDefault } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

let isFirebaseInitialized = false;

const initFirebase = () => {
    try {
        if (getApps().length === 0) {
            // Option 1: Provided via Base64 ENV string (Best for platforms like Render/Vercel)
            if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
                const serviceAccountBuffer = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64');
                const serviceAccount = JSON.parse(serviceAccountBuffer.toString('utf8'));
                initializeApp({
                    credential: cert(serviceAccount)
                });
                isFirebaseInitialized = true;
                console.log("✅ Firebase Admin initialized via Base64 ENV.");
            } 
            // Option 1.5: Provided via JSON ENV string
            else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
                initializeApp({
                    credential: cert(serviceAccount)
                });
                isFirebaseInitialized = true;
                console.log("✅ Firebase Admin initialized via JSON ENV.");
            }
            // Option 2: Default application credentials (usually GOOGLE_APPLICATION_CREDENTIALS)
            else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                initializeApp({
                    credential: applicationDefault()
                });
                isFirebaseInitialized = true;
                console.log("✅ Firebase Admin initialized via Application Default Credentials.");
            } else {
                console.warn("⚠️ Firebase Admin not initialized: Missing FIREBASE_SERVICE_ACCOUNT_BASE64, FIREBASE_SERVICE_ACCOUNT_JSON, or GOOGLE_APPLICATION_CREDENTIALS.");
            }
        } else {
            isFirebaseInitialized = true;
        }
    } catch (error) {
        console.error("❌ Failed to initialize Firebase Admin:", error.message);
    }
};

initFirebase();

const sendPushNotification = async (tokens, payload) => {
    if (!isFirebaseInitialized) {
        console.warn("⚠️ FCM is disabled. Skipping push notification.");
        return { success: false, message: "FCM not configured" };
    }

    if (!tokens || tokens.length === 0) {
        return { success: false, message: "No tokens provided" };
    }

    const message = {
        notification: {
            title: payload.title,
            body: payload.body,
        },
        data: payload.data || {},
        tokens: tokens, // Multicast message
    };

    try {
        const response = await getMessaging().sendEachForMulticast(message);
        
        // Handle token cleanup for invalid/expired tokens
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                const errorCode = resp.error?.code;
                if (
                    errorCode === "messaging/invalid-registration-token" ||
                    errorCode === "messaging/registration-token-not-registered"
                ) {
                    failedTokens.push(tokens[idx]);
                }
            }
        });

        return {
            success: true,
            successCount: response.successCount,
            failureCount: response.failureCount,
            failedTokens,
        };
    } catch (error) {
        console.error("❌ FCM Send Error:", error);
        return { success: false, error: error.message };
    }
};

module.exports = { admin, sendPushNotification, isFirebaseInitialized };
