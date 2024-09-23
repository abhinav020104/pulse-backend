import axios from "axios";

const BASE_URL = "https://pulse-api-server.codewithabhinav.online";
const TOTAL_BIDS = 20; // Increase total bids
const TOTAL_ASK = 10;  // Decrease total asks
const MARKET = "SOL_USD";
const USER_ID = "1";

async function main() {
    let price = 220 + Math.random() * 10;
    const openOrders = await axios.get(`${BASE_URL}/api/v1/order/open?userId=${USER_ID}&market=${MARKET}`);

    const totalBids = openOrders.data.filter((o: any) => o.side === "buy").length;
    const totalAsks = openOrders.data.filter((o: any) => o.side === "sell").length;

    let bidsToAdd = TOTAL_BIDS - totalBids;
    let asksToAdd = TOTAL_ASK - totalAsks;

    while (bidsToAdd > 0 || asksToAdd > 0) {
        if (asksToAdd > 0) {
            price = price + 15;
            await axios.post(`${BASE_URL}/api/v1/order`, {
                market: MARKET,
                price: (price + 2 + Math.random() * 1).toFixed(1).toString(), // Ask price slightly above market price
                quantity: Math.floor(50 + Math.random() * 10).toString(),  // Smaller ask quantities
                side: "sell",
                userId: USER_ID
            });
            asksToAdd--;
        }

        if (bidsToAdd > 0) {
            price = price  -  8;
            await axios.post(`${BASE_URL}/api/v1/order`, {
                market: MARKET,
                price: (price  + Math.random() * 1).toFixed(1).toString(), // Bid price closer to market price
                quantity: Math.floor(150 + Math.random() * 20).toString(), // Larger bid quantities
                side: "buy",
                userId: USER_ID
            });
            bidsToAdd--;
        }
        
        // Adding delay to simulate human behavior
        await delay(500, 1500); // Random delay between 500ms and 1500ms
        

        // Adding delay to simulate human behavior
        await delay(500, 1500); // Random delay between 500ms and 1500ms
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    main();
}

// Function to create a random delay between min and max milliseconds
function delay(min: number, max: number) {
    const timeout = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(resolve => setTimeout(resolve, timeout));
}

main();
