import { Client } from "pg";
import { createClient } from "redis";
import { DbMessage } from "./types";

const pgClient = new Client({
    user: "your_user",
    host: "13.60.167.37",
    database: "my_database",
    password: "your_password",
    port: 5432,
});

pgClient.connect();

async function createMaterializedViews(baseAsset:any) {
    const createViewsQueries = `
        CREATE MATERIALIZED VIEW IF NOT EXISTS ${baseAsset}_1m AS
        WITH ordered_data AS (
            SELECT
                time_bucket('1 minute', time) AS bucket,
                time,
                price,
                ROW_NUMBER() OVER (PARTITION BY time_bucket('1 minute', time) ORDER BY time ASC) AS rn_asc,
                ROW_NUMBER() OVER (PARTITION BY time_bucket('1 minute', time) ORDER BY time DESC) AS rn_desc
            FROM SOL_USD
        )
        SELECT
            bucket AS end,
            ARRAY_AGG(price ORDER BY time) AS prices,
            MAX(CASE WHEN rn_asc = 1 THEN price END) AS open,
            MAX(CASE WHEN rn_desc = 1 THEN price END) AS close,
            MAX(price) AS high,
            MIN(price) AS low,
            SUM(price) AS volume,
            COUNT(*) AS trades
        FROM ordered_data
        GROUP BY bucket;

        CREATE MATERIALIZED VIEW IF NOT EXISTS ${baseAsset}_1h AS
        WITH ordered_data AS (
            SELECT
                time_bucket('1 hour', time) AS bucket,
                time,
                price,
                ROW_NUMBER() OVER (PARTITION BY time_bucket('1 hour', time) ORDER BY time ASC) AS rn_asc,
                ROW_NUMBER() OVER (PARTITION BY time_bucket('1 hour', time) ORDER BY time DESC) AS rn_desc
            FROM SOL_USD
        )
        SELECT
            bucket AS end,
            ARRAY_AGG(price ORDER BY time) AS prices,
            MAX(CASE WHEN rn_asc = 1 THEN price END) AS open,
            MAX(CASE WHEN rn_desc = 1 THEN price END) AS close,
            MAX(price) AS high,
            MIN(price) AS low,
            SUM(price) AS volume,
            COUNT(*) AS trades
        FROM ordered_data
        GROUP BY bucket;

        CREATE MATERIALIZED VIEW IF NOT EXISTS ${baseAsset}_1w AS
        WITH ordered_data AS (
            SELECT
                time_bucket('1 week', time) AS bucket,
                time,
                price,
                ROW_NUMBER() OVER (PARTITION BY time_bucket('1 week', time) ORDER BY time ASC) AS rn_asc,
                ROW_NUMBER() OVER (PARTITION BY time_bucket('1 week', time) ORDER BY time DESC) AS rn_desc
            FROM SOL_USD
        )
        SELECT
            bucket AS end,
            ARRAY_AGG(price ORDER BY time) AS prices,
            MAX(CASE WHEN rn_asc = 1 THEN price END) AS open,
            MAX(CASE WHEN rn_desc = 1 THEN price END) AS close,
            MAX(price) AS high,
            MIN(price) AS low,
            SUM(price) AS volume,
            COUNT(*) AS trades
        FROM ordered_data
        GROUP BY bucket;
    `;

    try {
        await pgClient.query(createViewsQueries);
        console.log("Materialized views created successfully.");
    } catch (error) {
        console.error("Error creating materialized views:", error);
    }
}

async function refreshMaterializedViews(baseAsset:any) {
    try {
        await pgClient.query(`REFRESH MATERIALIZED VIEW ${baseAsset}_1m`);
        await pgClient.query(`REFRESH MATERIALIZED VIEW ${baseAsset}_1h`);
        await pgClient.query(`REFRESH MATERIALIZED VIEW ${baseAsset}_1w`);
        console.log("Materialized views refreshed successfully.");
    } catch (error) {
        console.error("Error refreshing materialized views:", error);
    }
}

async function main() {
    const redisClient = createClient();
    await redisClient.connect();
    console.log("Connection with Redis successful");
    
    
    while (true) {
        const response = await redisClient.rPop("db_processor" as string);
        if (!response) {
            continue;
        }
        const data: DbMessage = JSON.parse(response);
        
        if (data.type === "TRADE_ADDED") {
            console.log("Adding data");
            console.log(data);
            
            const tableName = data.data.market;
            const price = data.data.price;
            let Tempmarket = data.data.market.toLowerCase();
            const baseAsset = Tempmarket.split("_")[0];
        
            await createMaterializedViews(baseAsset);
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
        }
    }
}

main().catch(console.error);

setInterval(refreshMaterializedViews, 10000);
