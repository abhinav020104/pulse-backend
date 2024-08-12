import { createClient, } from "redis";
import { Engine } from "./trade/Engine";


async function main() {
    const engine = new Engine(); 
    console.log("engine-created")
    const redisClient = createClient();
    await redisClient.connect();
    console.log("connected to redis");

    while (true) {
        const response = await redisClient.rPop("messages" as string)
        if (!response) {
            
        }  else {
            console.log(JSON.parse(response));
            engine.process(JSON.parse(response));
        }        
    }

}

main();