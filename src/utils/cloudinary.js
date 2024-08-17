import {v2 as cloudinary} from "cloudinary"
import fs from "fs"
import { ApiError } from "./ApiError.js";

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async(localFilePath)=>{
    try{
        if(!localFilePath)  return null
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })
        //file has been uploaded successfully
        console.log('File is uploaded on cloudinary',
            response.url
        )
        return response;
    } catch(error){
        fs.unlinkSync(localFilePath);
        return null;
    }
}

const deleteFromCloudinary = async(publicId)=>{
    try{
        const result = await cloudinary.api.delete_resources([publicId], {
            type: 'upload',
            resource_type: 'image'
        });
        console.log('Cloudinary Delete Result:', result);
        return result;
    }
    catch(err){
        throw new ApiError(504,`Failed to old image from cloudinary: ${error.message}`);
    }
}

const getPublicIdFromUrl = (url) => {
    if (!url) return '';
    // Extract the public ID from the URL
    const matches = url.match(/\/v\d+\/(.+)\./);
    return matches ? matches[1] : '';
}

export {uploadOnCloudinary, deleteFromCloudinary, getPublicIdFromUrl}