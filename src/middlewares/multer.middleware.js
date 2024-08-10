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
  })

function checkFileType(file,cb){
    const filetypes = /jpeg|jpg|png|gif/;
    // JS test() can be used to iterate over multiple matches in a string of text (with capture groups).
    // The path.extname() method returns the extension of the path, from the last occurrence of the . (period) character 
    // to end of string in the last portion of the path. 
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // The MIME type is a string that indicates the nature and format of a file.
    // e.g. Text Files: text/plain
    // e.g. Image Files: image/jpeg
    const mimetype = filetypes.test(file.mimetype);

    if(mimetype && extname){
      return cb(null,true);
    }
    else{
      throw new ApiError(404,"File type not supported");
    }
}  
  
export const upload = multer({ 
    storage : storage,
    limits : {fileSize: 5000000},
    fileFilter : function(req,file,cb){
      checkFileType(file,cb);
    }
})