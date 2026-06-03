import mongoose from  "mongoose"
import dotenv from "dotenv"


dotenv.config()


const connectDB = async() =>{
    try {
         const connection_instance = await  mongoose.connect(`${process.env.MONGO_URI}`)
    } catch (error) {
        console.log(`ERROR `)
        throw error;
    }
}

export  default connectDB ;