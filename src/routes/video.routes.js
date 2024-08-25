import { Router } from 'express';
import {
    deleteVideo,
    getAllVideos,
    getVideoById,
    publishAVideo,
    togglePublishStatus,
    updateVideo,
} from "../controllers/video.controller.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"
import {upload} from "../middlewares/multer.middleware.js"

const videoRouter = Router();
videoRouter.use(verifyJWT);

videoRouter.route("/").get(getAllVideos).post(upload.fields([
    {name:'videoFile',maxCount:1},{name:'thumbnail',maxCount:1}
]),publishAVideo);

videoRouter.route("/:id").get(getVideoById).delete(deleteVideo).patch(upload.single('thumbnail'),updateVideo);

videoRouter.route("/toggle/publish/:id").patch(togglePublishStatus)