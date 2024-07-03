// const asyncHandler = (requestHandler)=>{
//     Promise.resolve(requestHandler(req,res,next))
//     .catch((err)=>next(err))
// }

const asyncHandler = (requestHandler) =>(req,res,next) =>{
    new Promise((resolve, reject)=>{
        requestHandler(req,res,next).then(resolve).catch(reject);
    })
    .catch((err)=> next(err))
}

// const asyncHandler = (fn) => async (req,res,next)=>{
//     try{
//         await fn(req,res,next)
//     } catch(error){
//         res.status(error.code || 500).json({
//             success:false,
//             message:error.message
//         })
//     }
// }

export {asyncHandler}