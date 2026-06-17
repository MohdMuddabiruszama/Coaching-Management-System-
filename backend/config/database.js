const { Sequelize } = require("sequelize");
require("dotenv").config();

const dbUrl = process.env.DATABASE_URL;
const readDbUrl = process.env.DATABASE_READ_URL || process.env.DB_REPLICA_URL || "";

if (!dbUrl) {
    console.error("DATABASE_URL is missing in environment variables.");
    process.exit(1);
}

const isLocal = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");
const hasReadReplica = Boolean(readDbUrl);

console.log("Connecting to DB via PostgreSQL...");
console.log(`SSL: ${isLocal ? "disabled (localhost)" : "enabled"}`);
if (hasReadReplica) console.log("Read replica: enabled");

const commonOptions = {
    dialect: "postgres",
    logging: process.env.NODE_ENV === "development"
        ? (sql, timing) => {
            if (timing && timing > 500) {
                console.warn(`SLOW QUERY (${timing}ms):`, sql.substring(0, 200));
            }
        }
        : false,
    benchmark: process.env.NODE_ENV === "development",
    pool: {
        max: 5,
        min: 0,
        acquire: 60000,
        idle: 20000,
        evict: 15000,
    },
    retry: {
        match: [
            /ENOTFOUND/,
            /EAI_AGAIN/,
            /ECONNRESET/,
            /ECONNREFUSED/,
            /ETIMEDOUT/,
            /SequelizeConnection/,
            /SequelizeHost/,
            /TimeoutError/,
        ],
        name: "query",
        max: 5,
        backoffBase: 1000,
        backoffExponent: 1.5,
    },
    dialectOptions: {
        connectTimeout: 60000,
        keepAlive: true,
        statement_timeout: 60000,
        idle_in_transaction_session_timeout: 60000,
        ...(isLocal ? {} : {
            ssl: {
                require: true,
                rejectUnauthorized: true,
            },
        }),
    },
    define: {
        timestamps: true,
        underscored: true,
        paranoid: false,
    },
};

const parseConnectionUrl = (url) => {
    const parsed = new URL(url);
    return {
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : 5432,
        username: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: parsed.pathname.replace(/^\//, ""),
    };
};

const createSequelize = () => {
    if (!hasReadReplica) {
        return new Sequelize(dbUrl, commonOptions);
    }

    const write = parseConnectionUrl(dbUrl);
    const read = parseConnectionUrl(readDbUrl);

    return new Sequelize(write.database, write.username, write.password, {
        ...commonOptions,
        host: write.host,
        port: write.port,
        replication: {
            read: [{
                host: read.host,
                port: read.port,
                username: read.username,
                password: read.password,
                database: read.database,
            }],
            write: {
                host: write.host,
                port: write.port,
                username: write.username,
                password: write.password,
                database: write.database,
            },
        },
    });
};

const sequelize = createSequelize();

sequelize.authenticate()
    .then(() => console.log("PostgreSQL DB Pool Ready"))
    .catch((err) => console.error("DB Pool Failed:", err.message));

module.exports = sequelize;
