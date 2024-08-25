import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary, deleteFromCloudinary, getPublicIdFromUrl} from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortType = 'desc', username } = req.query;

    let userId;
    if(username){
        const user = await User.findOne({username});
        if(!user){
            throw new ApiError(404, "User not found");
        }
        userId = user._id;
    }

    const pipeline = [
        ...(userId ? [{ $match: {owner:userId} }]:[]),  // Apply userId filtering if provided
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "details",
                pipeline: [
                    {
                        $project: {
                            fullname: 1,
                            avatar: 1,
                            username: 1,
                        },
                    },
                ],
            },
        },
        {
            $addFields: {
                details: {
                    $first: "$details",
                },
            },
        },
        {
            $sort: {
                [sortBy]: sortType === 'desc' ? -1 : 1
            }
        }
    ];

    try {
        const result = await Video.aggregatePaginate(pipeline, { page : parseInt(page,10), limit : parseInt(limit,10) });
    
        if (result.docs.length === 0) {
            return res.status(200).json(new ApiResponse(200, [], "No Video Found"));
        }
    
        return res
            .status(200)
            .json(
                new ApiResponse(200, result.docs, "Videos fetched Successfully!")
            );
    } catch (error) {
        throw new ApiError(500, "Something went wrong while fetching videos!");
    }
});


export { getAllVideos };