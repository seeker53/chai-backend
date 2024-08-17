import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary, deleteFromCloudinary, getPublicIdFromUrl} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

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
            $unset: {
                refreshToken : "" // deleting refereshToken
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

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {currentPassword, newPassword} = req.body;
    if(!currentPassword || !newPassword){
        throw new ApiError(400,"Old or new password field cannot be empty");
    }
    if(currentPassword === newPassword){
        throw new ApiError(400,"Old and new password cannot be same");
    }
    // we will be using auth middleware before sending request to changeCurrentPassword controller 
    // so middleware will already be performing the task of token verifications etc.
    // and due to middleware we get user details in req.user
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(currentPassword)
    if(!isPasswordCorrect){
        throw new ApiError(401,"Invalid old password");
    }
    user.password = newPassword;
    // pre hook of mongodb will be triggered automatically to hash the password before save
    await user.save({validateBeforeSave:false});

    return res
    .status(200)
    .json(
        new ApiResponse(200,{},"Password changed successfully")
    )
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            req.user,
            "User fetched successfully"
        )
    )
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const{fullName, email} = req.body;
    if(!fullName || !email){
        throw new ApiError(400,"All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName : fullName,
                email : email
            }
        },
        {
            new : true  // this returns new updated detail of user which gets saved in 'user' variable
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Account details updated successfully")
    )
})   

const updateUserAvatar = asyncHandler(async(req,res)=>{
    // we get req.file because of multer middleware functionality that we add in route
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(500,"Error while uploading avatar on cloudinary")
    }

    const user = await User.findById(req.user?._id);
    const previousAvatarUrl = user?.avatar;
    const previousAvatarPublicId = getPublicIdFromUrl(previousAvatarUrl);
    console.log('Previous Avatar Public ID:', previousAvatarPublicId);
    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar : avatar.url
            }
        },
        {new:true}
    ).select("-password -refreshToken")

    if (previousAvatarPublicId) {
        await deleteFromCloudinary(previousAvatarPublicId);
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedUser, "Avatar updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    // we get req.file because of multer middleware functionality that we add in route
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover Image is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new ApiError(500,"Error while uploading coverImage on cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage : coverImage.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover Image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {username} = req.params;
    if(!username?.trim()){
        throw new ApiError(400,"username is missing");
    }   
    const channel = await User.aggregate([
    {
        $match : {
            usermame : username?.toLowerCase()
        }
    },
    {
        $lookup:{
            from : "subscriptions", // model is Subscription but gets converted to subscriptions in mongodb
            localField : "_id",
            foreignField : "channel",
            as:"subscribers"
        }
    },
    {
        $lookup:{
            from : "subscriptions", // model is Subscription but gets converted to subscriptions in mongodb
            localField : "_id",
            foreignField : "subscriber",
            as:"subscribedTo"
        }
    },
    {
        $addFields:{
            subscribersCount : {
                $size : "$subscribers" // $ is used since subscribers is a field returned as a result of lookup
            },
            channelsSubscribedToCount:{
                $size : "$subscribedTo"
            },
            isSubscribed : {
                $condition : {
                    if: { $in:[req.user?._id,"$subscribers.subscriber"]},
                    then: true,
                    else: false
                }
            }
        }
    },
    {
        $project:{
            username : 1,
            fullName : 1,
            email : 1,
            avatar : 1,
            coverImage : 1,
            subscribersCount : 1,
            channelsSubscribedToCount : 1,
            isSubscribed : 1,
            createdAt : 1
        }
    }
])
    // since aggregation returns array we are checking channel array length
    if(!channel?.length){
        throw new ApiError(400,"channel does not exist");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req,res)=>{
    const user = await User.aggregate([
        {
            $match :{
                _id : mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup :{
                from : "videos",
                localField : "watchHistory",
                foreignField : "_id",
                as : "watchHistory",
                // adding sub-pipeline for getting video owner details
                pipeline:[  
                    {
                        $lookup:{
                            from : "users",
                            localField : "owner",
                            foreignField : "_id",
                            as : "owner",
                            pipeline:[
                                {
                                    // this projection goes under the owner field
                                    $project:{
                                        fullName : 1,
                                        username : 1,
                                        avatar : 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        // this pipeline for overwriting owner field to structure it for frontend use
                        // the data of importance is in the first value of returned array in owner field
                        $addFields:{
                            owner : {
                                $first : "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])
    return res
    .status(200)
    .json(
        new ApiResponse(200,user[0].watchHistory,"Watch History fetched successfully")
    )
})

export {
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccountDetails, 
    updateUserAvatar, 
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}