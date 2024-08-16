import { Router } from "express";
import { 
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
} from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";
const userRouter = Router();

userRouter.route("/register").post(
    //adding middleware - 'jaate samay milke jana'
    upload.fields([
        {
            name : 'avatar',
            maxCount : 1
        },
        {
            name : 'coverImage',
            maxCount : 1
        }]
    ),
    registerUser)

userRouter.route("/login").post(loginUser)

//secured routes

// next() usecase of middlewares can be seen here below where we are using two methods verifyJWT and logoutUser
// so we have to tell them apart using next()
// verifyJWT-> next() -> logoutUser
userRouter.route("/logout").post(verifyJWT,logoutUser);

userRouter.route("/refresh-token").post(refreshAccessToken);

userRouter.route("/change-password").post(verifyJWT,changeCurrentPassword);

userRouter.route("/current-user").get(verifyJWT, getCurrentUser);

userRouter.route("/update-account").patch(verifyJWT, updateAccountDetails); // we are using patch for update beacuse if we use post then all details will be unnecessary updated

userRouter.route("/avatar").patch(verifyJWT,upload.single("avatar"),updateUserAvatar); // first middleware is verifyJWT because we want only the logged-in users to upload files

userRouter.route("/cover-image").patch(verifyJWT,upload.single("coverImage"),updateUserCoverImage);

userRouter.route("/channel/:username").get(verifyJWT,getUserChannelProfile);

userRouter.route("/history").get(verifyJWT,getWatchHistory);

export default userRouter;