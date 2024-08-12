import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshToken = async (userId)=>{
    try{
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();
        // updating or adding refresh token in mongodb
        user.refreshToken = refreshToken;
        // using save method of mongodb with no validation to avoid errors 
        // that would arise due to absence of required fields such as password, avatr, etc.
        await user.save({validateBeforeSave:false});
        return {accessToken,refreshToken};
    }
    catch(err){
        throw new ApiError(500,"Something went wrong while generating access and refresh token");
    }
}

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
    // handling it with classical if conditions because optional check gives 'cannot read properties of undefined' error in case of missing coverImage
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

const loginUser = asyncHandler(async(req,res)=>{
    // login karne ke steps:

    // get user details from frontend or req.body se data
    const {email,username,password} = req.body

    // check if all details are there and valid
    if(!email && !username){
        throw new ApiError(400,"Email or username is required")
    }

    // check if user exists
    const user = await User.findOne({
        //using $or (or) logical query operator in mongodb
        $or : [
            {username},
            {email}
        ]
    })
    if(!user){
        throw new ApiError(404,"User not found");
    }

    // password validating
    // remeber using 'user' and not 'User'
    const isPasswordCorrect = await user.isPasswordCorrect(password);
    if(!isPasswordCorrect){
        throw new ApiError(401,"Incorrect password");
    }

    // generate tokens
    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id);
    
    // fetching logged in user details
    // option 1 : remove sensitive fields like password and refreshToken directly from the existing user variable
    // option 2 :loggedInUser is a filtered version of 'user' designed to ensure that sensitive information is not exposed to the client.    
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    // send cookie
    const options = {
        httpOnly : true,
        secure : true
    }
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser,accessToken,refreshToken // data field of ApiResponse util
            },
            "User Logged in successfully"
        )
    )
});

const logoutUser = asyncHandler(async(req,res)=>{
    // logout karne ke steps:
    // due to verifyJWT middleware, req.user is available in the request now

    // remove refreshToken from db
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken : undefined // deleting refereshToken
            }
        },
        {
            new : true // update the res to have new value, that is to get value with deleted refreshToken
        }
    )
    
    // remove cookies

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(200,{},"User logged out")
    )
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    if(!incomingRefreshToken){
        throw new ApiError(400,"Refresh token is required");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id);
        if(!user){
            throw new ApiError(401,"Invalid refresh token");
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used");
        }
    
        const options = {
            httpOnly : true,
            secure : true
        }
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id);
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken,refreshToken : newRefreshToken},
                "Access token refreshed successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }

})

export {registerUser, loginUser, logoutUser, refreshAccessToken}