// professinal way to write connecttin code 
import mongoose from  "mongoose"
import dotenv from "dotenv"


dotenv.config()


const connectDB = async() =>{
    try {
         const connection_instance = await  mongoose.connect(`${process.env.MONGO_URI}`)
        //  console.log(connection_instance)
    } catch (error) {
        console.log(`ERROR `)
        throw error;
    }
}

export  default connectDB ;