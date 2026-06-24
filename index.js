import dotenv from "dotenv";
dotenv.config();
import Stripe from "stripe";
const stripe = new Stripe(process.env.Stripe_API_Key);
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import express from "express";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import http from "http";
import { Server } from "socket.io";
import { upload } from "./Multer/multer.js";
import { ImageStore } from "./ImageHost/Imagekit.io.js";

const app = express();
const port = process.env.PORT || 4500;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://doctorproject-a4e4f.web.app'
  ],
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://doctorproject-a4e4f.web.app'
    ],
    credentials: true
  }
});

app.use(express.json())
app.use(cookieParser());

const varifyToken = (req, res, next) => {
  const Token = req.cookies?.token;
  if (!Token) {
    return res.status(401).send({ message: 'Unauthorized access' })
  }
  jwt.verify(Token, process.env.JWT_Secret_Key, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized access' })
    }
    req.decoded = decoded
    // console.log("token decoded email:::",decoded)
    next()
  })
}

const uri = `mongodb+srv://${process.env.user_Name}:${process.env.password}@cluster0.u87dt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// console.log('uri:-',uri)
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    const database = client.db("doctorBooking");
    const doctors = database.collection('doctorCollection');
    const userCollection = database.collection('userlist');
    const CategoryColletion = database.collection('categoris');
    const degreeColletion = database.collection('degreeCollection');
    const Payment_Details = database.collection('payment_details')
    const doctor_apply_list = database.collection('doctor_apply_request');
    const news_collection = database.collection('news_collection');
    const Report_Details = database.collection('Report_collection');
    const comment_collection = database.collection('comment_collection');
    // --------------------------------------------------------------------------//
    /// verifyAdmin ///
    const verifyAdmin = async (req, res, next) => {
      const email = req?.decoded?.email;
      const query = { email: email }
      const admin = await userCollection.findOne(query);
      if (admin?.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next()
    }
    //-------- Both verify user like doctor and admin-----------//
    const verifyboth = async (req, res, next) => {
      const email = req?.decoded?.email;
      // console.log('doctor token email::',email)
      const query = { email: email };
      const both_user = await userCollection.findOne(query);
      if (both_user?.role !== 'doctor' || both_user?.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next()
    }

    /// doctor verify ///
    const verifyDoctor = async (req, res, next) => {
      const email = req?.decoded?.email;
      const query = { email: email };
      const Doctor = await userCollection.findOne(query);
      if (Doctor?.role !== 'doctor') {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next()
    }

    /// member verify ///
    const verifyMember = async (req, res, next) => {
      const email = req?.decoded?.email;
      // console.log('member token email::',email)
      // console.log('member token req::',req?.decoded?.email)
      const query = { email: email };
      const Member = await userCollection.findOne(query);
      if (Member?.role !== 'member') {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next()
    }
    //---------------------------------------------------------------------//

    /// json web token create related api here ///
    app.get('/jwt/:email', async (req, res) => {
      // const userEmail = req.body;
      // console.log('token params::',req.params?.email)
      const userEmail = { email: req.params?.email }
      // console.log("userEmail",userEmail)
      // console.log('jwt email',Email)
      const token = await jwt.sign(userEmail, process.env.JWT_Secret_Key, {
        expiresIn: '1d'
      })
      // console.log('token',token)
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ token })
    })
    app.post('/logout', (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      }).send({ removeCookies: true })

    })
    //----------------------------------------------------------------------------//

    // add user ///
    app.post('/addUser/:email', upload.single('image'), async (req, res) => {
      const data = req.body;
      const email = req.params?.email;
      const Imgfile = req.file;
      // console.log('imagefile',Imgfile);
      // console.log('data::',data);
      const query = { email: email }
      const check = await userCollection.findOne(query);
      if (check) {
        return res.send({ message: 'you already user' });
      }
      if (!Imgfile) {
        return res.status(505).send({ messge: 'Image not found!' })
      }
      let ImageUrl = data.image;
      if (Imgfile?.originalname) {
        ImageUrl = await ImageStore(Imgfile);
      }
      console.log('getImageUrl', ImageUrl);
      const UserData = { ...data, profle: ImageUrl };
      // console.log('userData',UserData)
      const result = await userCollection.insertOne(UserData);
      console.log('result::', result)
      res.status(201).send({
        insertedId: result.insertedId,
        profile:ImageUrl,
        name:data?.name
      });
    })

    //----------------- Update profile --------------------------------//
    app.put('/user_profile_update_to_DB/:email', varifyToken, async (req, res) => {
      const email = req.params?.email;
      const query = { email: email }
      const information = req.body;
      const updateData = {
        $set: {
          name: information?.name,
          phone: information?.phone,
          bio: information?.bio,
          photoURL: information?.photoURL
        }
      }
      const updateDoctorCollection = {
        $set: {
          name: information?.name,
          image: information?.photoURL,
        }
      }
      const updateNewsCollection = {
        $set: {
          name: information?.name,
          user_profile: information?.photoURL
        }
      }
      const optional = { upsert: true }
      //------ user_profile update related ------------------//
      const user_up = await userCollection.updateOne(query, updateData, optional);

      //-------------doctor profile update related-----------------//
      const doctor_up = await doctors.updateOne(query, updateDoctorCollection, optional);
      // console.log('doctor_up', doctor_up)

      //------------------ news poster profile update related --------------//
      const news_up = await news_collection.updateOne(query, updateNewsCollection, optional)

      // console.log('news_up', news_up)

      //----------------------------------------------------------------//
      // console.log('result', user_up)
      res.send(user_up);
    })

    //-----------------------verify user checking--------------------------//
    app.get('/verify_user/:email', async (req, res) => {
      const email = req.params?.email;
      const query = { email: email };
      const user_Type = await userCollection.findOne(query);
      // console.log("user_Type",user_Type)
      const role = user_Type?.role;
      console.log('user role 218::', role)
      res.send({ role })
    })
    //add doctor related api
    app.post('/doctor/addDoctor', varifyToken, async (req, res) => {
      const data = req.body;
      // console.log('add doctor data', data)
      const query = { email: data?.email }
      const check = await doctor_apply_list.findOne(query)
      if (check) {
        return res.send({ message: 'you already send request' })
      }

      const result = await doctor_apply_list.insertOne(data)
      res.send(result)
    })

    //---------------------------category searching related api ----------------------------//
    app.get('/categroy/query', async (req, res) => {
      const category = req.query?.name;
      // console.log("category line:: 174",category)
      const query = { Category: category }
      const result = await doctors.find(query).toArray();
      // console.log('category result::',result)
      res.send(result);
    })


    //---------------------some doctors get related api-------------------------------------//

    app.get('/doctorlist', async (req, res) => {
      const query = { role: 'doctor' }
      const result = await doctors.find(query).limit(4).toArray();
      res.send(result)
    })

    /// all doctor related api //
    app.get('/doctor/alldoctor', async (req, res) => {
      const query = { role: 'doctor' }
      const result = await doctors.find(query).toArray();
      res.send(result)
    })


    //--------------------show all post---------------------------------------------//
    app.get('/post_preview', async (req, res) => {
      const result = await news_collection.find().toArray()
      // console.log('reuslsdfsdfds', result)
      res.send(result);
    })

    ///doctors details related api 
    app.get('/doctor/details/:id', async (req, res) => {
      const Id = req?.params?.id;
      const query = { _id: new ObjectId(Id) }
      const result = await doctors.findOne(query);
      res.send(result);
    })

    // ---------------------------------------------------------------//

    /// admin dashboard related api ///

    /// applid list related api ///
    app.get('/applidlist', varifyToken, verifyAdmin, async (req, res) => {
      const result = await doctor_apply_list.find().toArray();
      res.send(result)
    })

    // applid update //
    app.patch('/status/Update/:applid_id', varifyToken, verifyAdmin, async (req, res) => {
      const data = req.body;
      const id = req.params?.applid_id;
      const query = { _id: new ObjectId(id) }

      // console.log('data', data.status)
      // ---------------- Status Inprogres or Panding ------------------------------//
      if (data?.status == 'Inprogres' || data?.status == 'panding') {
        const updateStatus = {
          $set: {
            status: data?.status,
          }
        }
        const optional = { upsert: true }
        const result = await doctor_apply_list.updateOne(query, updateStatus, optional);
        return res.send(result)
      }
      // ---------------------------- Status Done ------------------------------//
      const updateStatus = {
        $set: {
          status: data?.status,
          role: 'doctor'
        }
      }
      const optional = { upsert: true }

      const result = await doctor_apply_list.updateOne(query, updateStatus, optional);

      if (!result && !userColl) {
        return res.send({ message: 'Unsuccessful' })
      }
      const findInfo = await doctor_apply_list.findOne(query);
      const userColl = await userCollection.updateOne({ email: findInfo?.email }, updateStatus, optional);
      // console.log('findInfo::',findInfo)
      const convertTodoctor = await doctors.insertOne(findInfo)
      res.send(convertTodoctor)
    })


    /// add category from admin ///
    app.post('/addCategory', varifyToken, verifyboth, async (req, res) => {
      const categoryValue = req.body;

      const result = await CategoryColletion.insertOne(categoryValue);

      res.send(result)

    })
    /// add degree form admin //
    app.post('/addDegree', async (req, res) => {
      const degreelist = req.body;

      const result = await degreeColletion.insertOne(degreelist);

      res.send(result)
    })

    // get category //
    app.get('/category', async (req, res) => {
      const result = await CategoryColletion.find().toArray();
      res.send(result);
    })

    // get degree //
    app.get('/degreelist', async (req, res) => {
      const result = await degreeColletion.find().toArray();
      res.send(result)
    })

    ///--------------------------------- Payment------------------------- ///

    app.post('/create-checkout-session', varifyToken, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: [
          'card'
        ]
      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })

    });

    // payment history //
    app.post('/paymentHistory/:id', varifyToken, async (req, res) => {
      const id = req.params?.id;
      console.log('paymentId', id);
      const Payment_data = req?.body;
      // console.log('payment data_:',Payment_data);

      const query = { _id: new ObjectId(id) };
      const verify_Doctor = await doctors.findOne(query);
      if (verify_Doctor) {
        const Update = {
          $inc: { pasents: 1 }
        }
        const options = { upsert: true };
        const result = await doctors.updateOne(query, Update, options);
        const storePayment_Details = await Payment_Details.insertOne(Payment_data);
        console.log('storePayment_Details', storePayment_Details);
        return res.send(result)
      }
      // console.log('payment data', Payment_data)

      const result = await Payment_Details.insertOne(Payment_data);
      // console.log('paymentResult',result);
      if (!result) {
        return res.status(401).send({ message: 'your payment in not store in Database' })
      }
      const Update = {
        $inc: { pasents: 1 }
      }
      const options = { upsert: true };
      const result2 = await Payment_Details.updateOne(query, Update, options);
      // console.log(result)
      if (!result2) {
        return res.status(404).send({ message: 'somethink is wrong !' })
      }
      res.send(result);
    })

    ///-------------------------------- Doctor------------------------------------ ///

    //-----------------------Doctor_information--------------------------------//
    app.get('/doctor/information/:email', varifyToken, verifyDoctor, async (req, res) => {
      const email = req.params?.email;
      const query = { email: email };
      const result = await doctors.findOne(query);
      // console.log(result)
      res.send(result);
    })

    //------------------Get pasent list by doctor email----------------------- //
    app.get('/listfopasent/:email', varifyToken, verifyDoctor, async (req, res) => {
      const email = req.params?.email;
      const result = await doctors.aggregate([
        {
          $match: { email: email }
        },
        {
          $lookup: {
            from: 'payment_details',
            let: { docId: '$_id' },
            pipeline: [
              {
                $addFields: {
                  convertedDoctorId: { $toObjectId: "$doctor_id" }
                }
              },
              {
                $match: {
                  $expr: { $eq: ["$$docId", "$convertedDoctorId"] }
                }
              }
            ],
            as: "pasentList"
          }
        },

        {
          $unwind: "$pasentList"
        }
      ]).toArray()
      // console.log('pasentlist:', result)
      res.send(result)
    })
    /// --- doctor details balance --- ///
    app.get('/detailsBalance/:email', varifyToken, verifyDoctor, async (req, res) => {
      const email = req.params?.email;
      const result = await doctors.aggregate([
        {
          $match: { email: email }
        },
        {
          $lookup: {
            from: 'payment_details',
            let: { docId: '$_id' },
            pipeline: [
              {
                $addFields: {
                  convertedDoctorId: { $toObjectId: "$doctor_id" }
                }
              },
              {
                $match: {
                  $expr: { $eq: ["$$docId", "$convertedDoctorId"] }
                }
              }
            ],
            as: "pasentList"
          }
        },
        {
          $project: {
            pasentList: 1
          }
        },
        {
          $unwind: "$pasentList"
        }
      ]).toArray();
      // console.log('balance details',result)
      res.send(result)
    })

    //----------------------doctor appoinment list----------------------------------//
    app.get('/doctor/appointment_List/:email', verifyDoctor, varifyToken, async (req, res) => {
      const m_email = req.params?.email;

      const result = await Payment_Details.aggregate([
        {
          $match: { appliedEmail: m_email }
        },
        {
          $addFields: {
            doctorObjectId: { $toObjectId: "$doctor_id" } // doctor_id convert to ObjectId 
          }
        },
        {
          $lookup: {
            from: 'doctorCollection', // doctor 
            localField: 'doctorObjectId',
            foreignField: "_id",  // doctor's _id field
            as: 'Doctor_info'
          }
        },
        {
          $unwind: "$Doctor_info"
        }
      ]).toArray()

      console.log('doctor appoinment"""', result)
      res.send(result)
    })

    //---------------------------- Member -----------------------//
    //-----------------------Member Dashborad related API---------------------------//
    app.get('/mybookingInfo/:email', varifyToken, verifyMember, async (req, res) => {
      const email = req.params?.email;
      const query = { appliedEmail: email };
      const result = await Payment_Details.find(query).toArray()
      res.send(result);
    })
    //Get appointment list for member ///
    app.get('/appointmentlist/:email', varifyToken, verifyMember, async (req, res) => {
      const m_email = req.params?.email;
      console.log(m_email)
      const result = await Payment_Details.aggregate([
        {
          $match: { appliedEmail: m_email }
        },
        {
          $addFields: {
            doctorObjectId: { $toObjectId: "$doctor_id" } // doctor_id convert to ObjectId 
          }
        },
        {
          $lookup: {
            from: 'doctorCollection', // doctor 
            localField: 'doctorObjectId',
            foreignField: "_id",  // doctor's _id field
            as: 'Doctor_info'
          }
        },
        {
          $unwind: "$Doctor_info"
        }
      ]).toArray()

      console.log(result)
      res.send(result)
    })

    /// member-payment-list related api ---
    app.get('/member_payment_list/:email', varifyToken, verifyMember, async (req, res) => {
      const email = req?.params?.email;
      const result = await Payment_Details.aggregate([
        {
          $match: { appliedEmail: email }
        },
        {
          $addFields: {
            doctorObjectId: { $toObjectId: "$doctor_id" } // doctor_id convert to  ObjectId 
          }
        },
        {
          $lookup: {
            from: 'doctorCollection', // doctor collection name
            localField: 'doctorObjectId',
            foreignField: "_id",  // doctor's _id field
            as: 'Doctor_info'
          }
        },
        {
          $unwind: "$Doctor_info"
        }
      ]).toArray()

      // console.log('payment list', result)
      res.send(result)
    })

    //------------------------------AI-Powered Health Checkup-----------------------------//
    app.post('/health/summary/', varifyToken, verifyMember, async (req, res) => {
      const language = req.query?.language;
      const healthInfo = req.body;
      console.log('language::', language, "healthInfo::", healthInfo)
      const AI = new GoogleGenAI({
        apiKey: process.env.Gemini_API_Key
      })
      const response = await AI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `
Patient's Health Data:
- Height: ${healthInfo.height} cm
- Weight: ${healthInfo.weight} kg
- Blood Pressure: ${healthInfo.bloodPressure}
- Pulse: ${healthInfo.pulse}
- Temperature: ${healthInfo.temperature}
- Sugar: ${healthInfo.sugar}
- Oxygen: ${healthInfo.oxygen}
- Known Condition: ${healthInfo.health_Conditions || "None"}

Please analyze this and act as a virtual doctor.
Return plain text only, no Markdown formatting.
Keep your answer around 200 words.
Analyze patient condition, predict future risks, and give 3/5 practical health tips.Text language is${language || 'English'}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction: `If user type like that question is Who are you or what's your name or who is your creator then your answer (You are HealthBot, a virtual health assistant created by Durjoy Chando.) this type , else is " " focus next 
You behave like a real doctor — always helpful, informative, and friendly.
Do not use Markdown. Keep responses clear, concise, and calm like a caring doctor. And You will check all the user's health inputs and tell the patient how their overall health condition is — such as whether it is Normal, Needs Attention, or Dangerous 
Limit your reply to about 200 words.
        `.trim()
        },
      });
      console.log(response.text);
      res.send(response.text)
    })

    //---------------------------------- save report to database----------------------------//
    app.post('/save_report/:email', varifyToken, verifyMember, async (req, res) => {
      const email = req.params?.email
      const data = req.body;
      const information = { ...data, email, date: new Date().toLocaleDateString() }
      // console.log('data::',data);
      // console.log('information::',information)
      const result = await Report_Details.insertOne(information)
      res.send(result)
    })

    //--------------------------view report--------------------------------//
    app.get('/view_report/:email', varifyToken, verifyMember, async (req, res) => {
      const email = req.params?.email;
      const query = { email: email };
      const result = await Report_Details.find(query).toArray();
      // console.log(result);
      res.send(result)
    })
    //----------------------------Report Details for Single users---------------------------------//
    app.get('/report_Details/:id', varifyToken, verifyMember, async (req, res) => {
      const id = req.params?.id;
      // console.log('id::',id);
      const query = { _id: new ObjectId(id) };
      const result = await Report_Details.findOne(query);
      res.send(result);
    })


    //---------------------------------Admin home----------------------------------//

    //-------------- total payment for admin home---------------------//
    app.get('/totalPayment/totalDoctor/:email', varifyToken, verifyAdmin, async (req, res) => {
      const Email = req.params?.email;
      // console.log('Email address', Email)
      const totalPay = await Payment_Details.aggregate([
        {
          $group: {
            _id: null,
            totalPayment: { $sum: { $toInt: "$amount" } }
          }
        },
        {
          $project: {
            _id: 0,
            totalPayment: 1
          }
        }
      ]).toArray()
      const Doctor_list = await doctors.find().toArray()
      const totaldoctor = Doctor_list.length;
      const totalUser = await userCollection.find().toArray();
      const user = totalUser.length;
      // console.log("user", user)
      // console.log('totalpayment:', totalPay, totaldoctor)
      res.json([totalPay[0], totaldoctor, user, Doctor_list])
    })
    //------------------------Top 10 doctor per balance------------------------------------------//
    app.get('/per_doctor/balancelis/:email', varifyToken, verifyAdmin, async (req, res) => {
      const Email = req.params?.email;
      const query = { email: { $ne: Email } };
      const result = await Payment_Details.find(query).limit(10).toArray();
      // console.log('doctor payment per:::',result)
      res.send(result);
    })

    app.get('/doctor/pacentDetails/:id', varifyToken, verifyAdmin, async (req, res) => {
      const id = req.params?.id;
      const query = { _id: new ObjectId(id) };
      const result = await doctors.findOne(query);
      // console.log("result", result);
      res.send(result);
    })

    //------------------------Doctor dashboard -------------------------------------------------//
    app.get('/pasent_details_info/:email', varifyToken, verifyDoctor, async (req, res) => {
      const email = req.params?.email;
      const query = { email: email };
      const Doctor_check = await doctors.findOne(query);
      if (!Doctor_check) {
        return res.status(404).send({ message: 'Sorry bro!Doctor is not find' })
      }
      const id = Doctor_check?._id.toString();
      const find_id = { doctor_id: id };
      const find_doctor = await Payment_Details.find(find_id).toArray();
      // console.log("find_doctor::", find_doctor)
      res.send(find_doctor)
    })
    //-----------------------------single Doctor amount---------------------------//
    app.get('/single_doctor_amount/:email', varifyToken, verifyDoctor, async (req, res) => {
      const email = req.params?.email;
      console.log(email)
      const query = { email: email };
      const result = await doctors.findOne(query);
      const fee = parseInt(result?.fee);
      const pasent = result?.pasents;
      const totalBalance = fee * pasent;
      // console.log(totalBalance)
      res.send({ totalAmount: totalBalance });

    });

    //---------------------------news post by admin and doctor--------------------------//
    app.post('/newspost/:email', varifyToken, verifyboth, async (req, res) => {
      const email = req.params?.email;
      // console.log('newspost email',email)
      const data = req.body;
      const query = { email: email }
      const check_user = await userCollection.findOne(query)
      // console.log('check_user',check_user)
      const role = check_user?.role;
      const name = check_user?.name;
      const user_profile = check_user?.photoURL
      if (!user_profile) {
        //  console.log('user_profile problem')
        return res.send({ message: 'user_profile problem' })
      }
      const dataInfo = { ...data, email, name, user_profile, role };
      const result = await news_collection.insertOne(dataInfo);

      res.send(result);
    })

    //------------------Blog liked_Functionality-----------------------------//
    app.post('/blog_liked/:id/:email', varifyToken, async (req, res) => {
      const post_id = req.params?.id;
      const user_email = req.params?.email;
      const check = await news_collection.findOne({ _id: new ObjectId(post_id) })

      const filters = check?.likeId?.filter((item) => {

        return item.post_id === post_id && item?.user_email == user_email
      })

      if (filters?.length > 0) {
        const query = { _id: new ObjectId(post_id), like: { $gte: 1 } }
        const update = {
          $pull: { likeId: { post_id, user_email } },
          $inc: { like: -1 }
        };
        const likeDecriment = await news_collection.updateOne(query, update);

        return res.send({ message: 'unlike' })
      }
      const update = {
        $push: { likeId: { post_id, user_email } },
        $inc: { like: 1 }
      }
      const optional = { upsert: true }
      const storeLike = await news_collection.updateOne({ _id: new ObjectId(post_id) }, update, optional)
      res.send({ message: 'liked' })
    })

    //---------Post Comment functionality----------------------//
    app.get('/allCommentlist/:id', async (req, res) => {
      const { id } = req.params;
      const join_to_userList = await comment_collection.aggregate([
        {
          $match: { post_id: id }
        },
        {
          $sort: { createdAt: -1 }
        },
        {
          $lookup: {
            from: "userlist",
            localField: "user_email",
            foreignField: "email",
            as: "userInfo"
          }
        },
        {
          $unwind: "$userInfo"
        }
      ]).toArray()
      // console.log('join to userlist::', join_to_userList)
      res.send(join_to_userList)
    })


    app.post('/post/comment/:id/:email', varifyToken, async (req, res) => {
      const { id, email } = req.params;
      const { comment } = req.body;
      console.log(id, email, comment)
      const Data = {
        post_id: id,
        user_email: email,
        comment,
        date: new Date()
      };
      const post_Comment = await comment_collection.insertOne(Data);
      res.send(post_Comment)
      // console.log('post_comment::', post_Comment);
    })

    app.patch('/comment/edit/:id', async (req, res) => {
      const { id } = req.params;
      const { comment } = req.body;
      console.log('comment body::', comment);
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: { comment }
      }
      const optional = { upsert: true }
      const result = await comment_collection.updateOne(query, update, optional);
      console.log('comment::', result)
      res.send(result);
    })

    // comment delete related api //
    app.delete('/comment/delete/:id', async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const delete_Comment = await comment_collection.deleteOne(query);
      // console.log('delete_comment::',delete_Comment)
      res.send(delete_Comment);

    })
    //-----------------------------Member Message page related function---------------------------//
    app.get('/appointments/doctor/list/:email', async (req, res) => {
      const { email } = req.params;
      console.log('memberEmail::', email)
      const findTheDoctor = await Payment_Details.aggregate([
        { $match: { appliedEmail: email } },
        {
          $addFields: { doctorId: { $toObjectId: '$doctor_id' } }
        },
        {
          $lookup: {
            from: 'doctorCollection',
            localField: 'doctorId',
            foreignField: '_id',
            as: 'doctorInfo'
          }
        },
        {
          $unwind: '$doctorInfo'
        },
        {
          $project: {
            _id: 0,
            doctorInfo: 1,
          }
        }
      ]).toArray()
      console.log('findthedoctor::', findTheDoctor)
      res.send(findTheDoctor)
    })
    /// real time Chating related Functionality///
    let user = {}
    io.on('connection', (socket) => {
      console.log(`🔌 User connected: ${socket.id}`);

      // Listen for events from client
      socket.on('registerEmail', ({ email }) => {
        user[email] = socket.id;
      })
      socket.on('sendMessage', ({ email, message }) => {
        user[email] = socket.id;
        console.log('userCheck::', user[email] = socket.id);
        console.log('all user_check::', user)
        socket.emit('message', { message });
      });

      socket.on('disconnect', () => {
        console.log(`❌ User disconnected: ${socket.id}`);
        for (let email in user) {
          if (user[email] === socket.id) {
            console.log(`Removed user: ${email}`);
            delete user[email];
            break;
          }
        }
      });
    });

    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('server is running')
})

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

