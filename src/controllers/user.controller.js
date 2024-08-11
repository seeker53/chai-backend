import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async(req,res)=>{
    // user register karne ke steps:
    
    // get user details from frontend
    const{fullName, email, username, password} = req.body
    console.log('email: ',email)


    // validate if all details are there and of correct type and format
    if([fullName,email,username,password].some((field)=> field?.trim()==="")){
        throw new ApiError(400,"All fields are required")
    }


    // check if user already exists
    const existedUser = await User.findOne({
        //using $or (or) logical query operator in mongodb
        $or : [
            {username},
            {email}
        ]
    })
    if(existedUser){
        throw new ApiError(409,"User already exists");
    }


    // check for images and avatar

    // most of the times middleware adds fields in req object
    // files fields actually has many properties such as png, jpeg, size, etc.
    // first property of this files.avatar field if present can provide us with the path of image uploaded by multer in diskStorage
    console.log(req.files)
    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath = req.files.coverImage[0].path
    }
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is required");
    }


    // upload avatar to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if(!avatar){
        throw new ApiError(400,"Avatar is required");
    }


    // create  user object - create entry in db

    // since the below op can take longer time hence await
    // also the operation can fail or give error so that aysncHandler.js can handle it
    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email:email.toLowerCase(),
        username:username.toLowerCase(),
        password
    })


    // remove password and refresh token field from response

    // verify if user has been created using mongodb '_id' field
    // weird syntax of mongoose .select("-password -refreshToken") wherein we are removing password and refresh token fields from response
    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    
    
    // check for user creation
    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user, Please try again");
    }


    // return response

    // it's better to keep res.status(code) instead of depending of ApiResponse status code,
    // because certain tools like Postman expect res.status to show the status code
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )
})

export {registerUser}