import multer from "multer";
import { ApiError } from "../utils/ApiError.js";
import path from "path";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/temp')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
});

function checkFileType(file, cb) {
    let filetypes;
    
    // Determine which file types to allow based on the file field name
    if (file.fieldname === 'avatar' || file.fieldname === 'coverImage' || file.fieldname === 'thumbnail') {
        filetypes = /jpeg|jpg|png|gif/;
    } else if (file.fieldname === 'video') {
        filetypes = /mp4|avi|mkv/;
    }

    // Check file extension and MIME type
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        throw new ApiError(404, "File type not supported");
    }
}

export const upload = multer({
    storage: storage,
    limits: { fileSize: 5000000 }, // Adjust size limit for videos if necessary
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
});
