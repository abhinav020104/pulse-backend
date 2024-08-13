import { Client } from "pg";
import { createClient } from "redis";
import { DbMessage } from "./types";

// PostgreSQL client setup
const pgClient = new Client({
    user: "your_user",
    host: "localhost",
    database: "my_database",
    password: "your_password",
    port: 5432,
});

// Connect to PostgreSQL
pgClient.connect();

// Function to create materialized views
async function createMaterializedViews() {
    const createViewsQueries = `
        CREATE MATERIALIZED VIEW IF NOT EXISTS sol_1m AS
        SELECT
            time_bucket('1 minute', time) AS bucket,
            ARRAY_AGG(price) AS prices,
            AVG(price) AS avg_price,
            MAX(price) AS max_price,
            MIN(price) AS min_price,
            SUM(price) AS total_volume
        FROM SOL_USD
        GROUP BY bucket;

        CREATE MATERIALIZED VIEW IF NOT EXISTS sol_1h AS
        SELECT
            time_bucket('1 hour', time) AS bucket,
            ARRAY_AGG(price) AS prices,
            AVG(price) AS avg_price,
            MAX(price) AS max_price,
            MIN(price) AS min_price,
            SUM(price) AS total_volume
        FROM SOL_USD
        GROUP BY bucket;

        CREATE MATERIALIZED VIEW IF NOT EXISTS sol_1w AS
        SELECT
            time_bucket('1 week', time) AS bucket,
            ARRAY_AGG(price) AS prices,
            AVG(price) AS avg_price,
            MAX(price) AS max_price,
            MIN(price) AS min_price,
            SUM(price) AS total_volume
        FROM SOL_USD
        GROUP BY bucket;
    `;

    try {
        await pgClient.query(createViewsQueries);
        console.log("Materialized views created or already exist.");
    } catch (error) {
        console.error("Error creating materialized views:", error);
    }
}

// Function to refresh materialized views
async function refreshMaterializedViews() {
    try {
        await pgClient.query("REFRESH MATERIALIZED VIEW sol_1m");
        await pgClient.query("REFRESH MATERIALIZED VIEW sol_1h");
        await pgClient.query("REFRESH MATERIALIZED VIEW sol_1w");
        console.log("Materialized views refreshed successfully.");
    } catch (error) {
        console.error("Error refreshing materialized views:", error);
    }
}

// Main function to process Redis messages and insert data
async function main() {
    const redisClient = createClient();
    await redisClient.connect();
    console.log("Connection with Redis successful");

    // Create materialized views once (or ensure they're created)
    await createMaterializedViews();

    while (true) {
        const response = await redisClient.rPop("db_processor" as string);
        if (!response) {
            // No new messages; could add sleep or wait time here
            continue;
        }

        const data: DbMessage = JSON.parse(response);
        if (data.type === "TRADE_ADDED") {
            console.log("Adding data");
            console.log(data);

            const tableName = data.data.market;
            const price = data.data.price;

            // Convert timestamp from milliseconds to a valid Date object
            const timestamp = new Date(Number(data.data.timestamp));
            console.log(`Timestamp: ${timestamp}`);

            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS ${tableName} (
                    id SERIAL PRIMARY KEY,
                    time TIMESTAMP NOT NULL,
                    price NUMERIC NOT NULL
                )
            `;

            try {
                await pgClient.query(createTableQuery);
                console.log(`Table ${tableName} created or already exists`);
            } catch (error) {
                console.error("Error creating table:", error);
            }

            const insertQuery = `INSERT INTO ${tableName} (time, price) VALUES ($1, $2)`;
            const values = [timestamp, price];

            try {
                await pgClient.query(insertQuery, values);
                console.log(`Data inserted into table ${tableName}`);
            } catch (error) {
                console.error("Error inserting data:", error);
            }

            // Optionally refresh materialized views after inserting data
            // This could be done periodically or based on a different trigger
            // await refreshMaterializedViews();
        }
    }
}

// Start the main function
main().catch(console.error);

// Optional: Periodically refresh materialized views
setInterval(refreshMaterializedViews, 10000); // Adjust the interval as needed
