import { Client } from "pg";
const client = new Client({
    user : "your_user",
    host:"localhost",
    database:"my_database",
    password:"your_password",
    port:5432
});

client.connect()


async function refreshViews(){
    await client.query("REFRESH MATERIALIZED VIEW sol_1m");
    await client.query("REFRESH MATERIALIZED VIEW sol_1h");
    await client.query("REFRESH MATERIALIZED VIEW sol_1w");

    console.log("Materialized Views refreshed Successfully");
}


refreshViews().catch(console.error);

setInterval(()=>{

    refreshViews();
} , 10000 )