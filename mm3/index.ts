import axios from "axios";

const BASE_URL = "http://13.60.167.37:3000";
const TOTAL_BIDS = 20;  // Increase the total number of bids
const TOTAL_ASK = 10;   // Decrease the total number of asks
const MARKET = "SOL_USD";
const USERS = ["1", "2", "3", "5"];  // Array of userIds

async function main() {
    let price = 100 + Math.random() * 10;
    const openOrders = await axios.get(`${BASE_URL}/api/v1/order/open?userId=5&market=${MARKET}`);

    const totalBids = openOrders.data.filter((o: any) => o.side === "buy").length;
    const totalAsks = openOrders.data.filter((o: any) => o.side === "sell").length;

    let bidsToAdd = TOTAL_BIDS - totalBids;
    let asksToAdd = TOTAL_ASK - totalAsks;

    while (bidsToAdd > 0 || asksToAdd > 0) {
        // Bullish price logic: Top goes higher, bottom goes higher
        if (asksToAdd > 0) {
            price = price + 3;  // Increasing ask price to simulate bullish trend (higher top)
            await axios.post(`${BASE_URL}/api/v1/order`, {
                market: MARKET,
                price: (price + Math.random() * 2).toFixed(1).toString(),  // Asks placed at slightly higher prices
                quantity: Math.floor(15 + Math.random() * 10).toString(),
                side: "sell",
                userId: USERS[Math.floor(Math.random() * USERS.length)]  // Random user from the array
            });
            asksToAdd--;

            if (bidsToAdd > 0) {
                price = price - 2;  // Higher bottom, but slightly lower than current price to simulate bid price
                await axios.post(`${BASE_URL}/api/v1/order`, {
                    market: MARKET,
                    price: (price + Math.random() * 1.5).toFixed(1).toString(),  // Aggressive bid price, slightly lower than current price
                    quantity: Math.floor(25 + Math.random() * 10).toString(),
                    side: "buy",
                    userId: USERS[Math.floor(Math.random() * USERS.length)]  // Random user from the array
                });
                bidsToAdd--;

                // Adding delay to simulate human behavior
                await delay(500, 1500);
            }

            // Adding delay to simulate human behavior
            await delay(500, 1500);
        }
    }

    // Adding a new round of orders to continue the pattern
    await new Promise(resolve => setTimeout(resolve, 3600000));  // Wait for 1 hour before the next round

    main();  // Restart after 1 hour to simulate ongoing trend
}

// Function to create a random delay between min and max milliseconds
function delay(min: number, max: number) {
    const timeout = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(resolve => setTimeout(resolve, timeout));
}

main();
