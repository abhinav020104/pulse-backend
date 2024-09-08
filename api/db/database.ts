import mongoose from "mongoose";
const dbConnect = ()=>{
    mongoose.connect("mongodb+srv://abhinavarora:Waheguru789@cluster0.oo8ass9.mongodb.net/Pulse").then(()=>{
        console.log("Connection With Database Successfull !!");
    }).catch(()=>{
        console.log("Failed to establish Connection with database !!"); 
    })
}

export default dbConnect