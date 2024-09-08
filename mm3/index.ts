import axios from "axios";

const BASE_URL = "http://localhost:3000";
const TOTAL_BIDS = 20;  // Increase the total number of bids
const TOTAL_ASK = 10;   // Decrease the total number of asks
const MARKET = "SOL_USD";
const USER_ID = "5";

async function main() {
    let price = 290 + Math.random() * 10;
    const openOrders = await axios.get(`${BASE_URL}/api/v1/order/open?userId=${USER_ID}&market=${MARKET}`);

    const totalBids = openOrders.data.filter((o: any) => o.side === "buy").length;
    const totalAsks = openOrders.data.filter((o: any) => o.side === "sell").length;

    let bidsToAdd = TOTAL_BIDS - totalBids;
    let asksToAdd = TOTAL_ASK - totalAsks;

    while (bidsToAdd > 0 || asksToAdd > 0) {
        if (asksToAdd > 0) {
            price = price - 5;
            await axios.post(`${BASE_URL}/api/v1/order`, {
                market: MARKET,
                price: (price + Math.random() * 2).toFixed(1).toString(),  // Asks placed at higher prices
                quantity: Math.floor(75 + Math.random() * 10).toString(),
                side: "sell",
                userId: USER_ID
            });
            asksToAdd--;
            if (bidsToAdd > 0) {
                price = price + 18;
                await axios.post(`${BASE_URL}/api/v1/order`, {
                    market: MARKET,
                    price: (price + Math.random() * 0.5).toFixed(1).toString(),  // Aggressive bid price closer to current price
                    quantity: Math.floor(95 + Math.random() * 10).toString(),
                    side: "buy",
                    userId: USER_ID
                });
                bidsToAdd--;
    
                // Adding delay to simulate human behavior
                await delay(500, 1500);
            }

            // Adding delay to simulate human behavior
            await delay(500, 1500);
        }
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
