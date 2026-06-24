import dotenv from "dotenv";
dotenv.config();
import ImageKit from '@imagekit/nodejs';
const client = new ImageKit({ privateKey: process.env.IMAGE_KIT_PRIVATE_KEY });
export const ImageStore = async (Imagefile) => {
    const response = await client.files.upload({
        file:Imagefile.buffer.toString("base64"),
        fileName:Imagefile.originalname,
    });
    console.log(response)
    return response?.url;
}


