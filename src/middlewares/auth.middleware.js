// at first need for this middleware arises for logout functionality
// middlewares are mostly used in routes
// they do not explicitly return anything instead they pass control using next()
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";

// verifyJWT middleware is used to verify the access token
// it checks if the token is present in the request
// if the token is present, it verifies the token using the secret key
// it then checks if the user exists in the database with the decoded token id
// if the user exists, it adds the user object to the request object
// if the user does not exist, it throws an error
// if the token is not present, it throws an error
export const verifyJWT = asyncHandler(async(req,_,next)=>{
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","");
    
        if(!token){
            throw new ApiError(401,"Unauthorized access");
        }
        const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
    
        if(!user)   throw new ApiError(401,"Invalid Access Token");
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid Access Token");
    }
})
