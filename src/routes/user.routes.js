import { Router } from "express";
import { registerUser, loginUser, logoutUser, refreshAccessToken } from "../controllers/user.controller.js";
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

export default userRouter;