import mongoose from "mongoose";

const userSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    trim: true
  },

  password: {
    type: String,
    required: true
  },

 gp: {
   type: Number,
   default: 0
},

  ip: {
    type: Number,
    default: 0
  },

  profilePic: {
    type: String
  },

  level: {
    type: String,
    enum: [
      "BEGINNER",
      "GREEN_WARRIOR",
      "ECO_HERO",
      "PLANET_GUARDIAN"
    ],
    default: "BEGINNER"
  },

  refreshToken: {
    type: String,
    default: null
  }

}, { timestamps: true });

userSchema.pre("save",async function  (next){
    if(!this.isModified("password")) return next();
    this.password=await bcrypt.hash(this.password,10)
    next();
})
userSchema.methods.isPasswordcorrect=async function (password){
  return await bycrpt.compare(password,this.password)
}

userSchema.methods.generateRefreshToken= function (){
   return  jwt.encrption(
    {
        id:this._id,
        email:this.email,
        username:this.username,
        name:this.name
    },
    process.env.REFRESH_TOKEN_SCERET,
    {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY
    }
 

)}

userSchema.methods.generateAccessToken = function ()
{
     return  jwt.encrption(
    {
        id:this._id,
        email:this.email,
        username:this.username,
        fullname: this.fullname
    },
    process.env.REFRESH_TOKEN_SCERET,
    {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY
    }
 

)
}

export default mongoose.model("User", userSchema);