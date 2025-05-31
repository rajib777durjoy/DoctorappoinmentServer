require('dotenv').config();
const stripe = require('stripe')(process.env.Stripe_API_Key);
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 4500;
const cors = require('cors');
//DoctorBooking
//HYclI7nHPo7vRMJD

app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}))
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
    res.decoded = decoded
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

    // --------------------------------------------------------------------------//
    /// verifyAdmin ///
    const verifyAdmin = async (req, res, next) => {
      const email = res?.decoded?.Email;
      const query = { email: email }
      const admin = await userCollection.findOne(query);
      if (admin?.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next()
    }

    /// doctor verify ///
    const verifyDoctor = async (req, res, next) => {
      const email = res?.decoded?.Email;
      const query = { email: email };
      const Doctor = await userCollection.findOne(query);
      if (Doctor?.role !== 'doctor') {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next()
    }

    /// member verify ///
    const verifyMember = async (req, res, next) => {
      const email = res?.decoded?.Email;
      const query = { email: email };
      const Member = await userCollection.findOne(query);
      if (Member?.role !== 'member') {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next()
    }
    //---------------------------------------------------------------------//

    /// json web token create related api here ///
    app.get('/jwt/:email', (req, res) => {
      const Email = req.params.email;
      // console.log('jwt email',Email)
      const token = jwt.sign({ Email }, process.env.JWT_Secret_Key, {
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
    app.post('/addUser', async (req, res) => {
      const data = req.body;
      const result = await userCollection.insertOne(data);
      res.send(result)
    })

    /// user Check related api ///
    app.get('/userverify/:email', varifyToken, async (req, res) => {
      const userEmail = req.params?.email;
      // console.log('usercheck Email',userEmail)
      const query = { email: userEmail }
      const admin = await userCollection.findOne(query);
      const doctor = await userCollection.findOne(query);
      const member = await userCollection.findOne(query);
      if (admin?.role === 'admin') {
        return res.send({ user: 'admin' })
      }
      if (doctor?.role === 'doctor') {
        return res.send({ user: 'doctor' })
      }
      if (member?.role === 'member') {
        return res.send({ user: 'member' })
      }

    })
    //add doctor related api
    app.post('/doctor/addDoctor', varifyToken, async (req, res) => {
      const data = req.body;
      const query = { email: data?.email }
      const check = await doctors.findOne(query)
      if (check) {
        return res.send({ message: 'you already send request' })
      }
      // console.log('doctor info', data)
      const result = await doctors.insertOne(data)
      res.send(result)
    })

    ///some doctors get related api ///
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
      const result = await doctors.find().toArray()
      // console.log(result)
      res.send(result)

    })

    // applid update //
    app.patch('/status/Update/:applid_id', varifyToken, verifyAdmin, async (req, res) => {
      const data = req.body;
      const id = req.params.applid_id;
      const query = { _id: new ObjectId(id) }
      const updateData = {
        $set: { status: data?.status }
      }
      const statusDone = {
        $set: {
          status: data?.status,
          role: 'doctor'
        }
      }
      const options = { upsert: true };
      // console.log('data',data,id)
      if (data.status == 'done') {

        const result = await doctors.updateOne(query, statusDone, options);
        return res.send(result)
      }
      const result = await doctors.updateOne(query, updateData, options)
      res.send(result)
    })


    /// add category from admin ///
    app.post('/addCategory', async (req, res) => {
      const categoryValue = req.body;
      // console.log('categoryValue',categoryValue.category)
      const result = await CategoryColletion.insertOne(categoryValue);
      // console.log('categoryResult',result)
      res.send(result)

    })
    /// add degree form admin //
    app.post('/addDegree', async (req, res) => {
      const degreelist = req.body;
      // console.log('degreelist',degreelist)
      const result = await degreeColletion.insertOne(degreelist);
      // console.log('add degree',result);
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

    /// Payment ///

    app.post('/create-checkout-session', async (req, res) => {
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
    app.post('/paymentHistory', async (req, res) => {
      const Payment_data = req.body;
      console.log('payment data', Payment_data)
      const result = await Payment_Details.insertOne(Payment_data);
      // console.log(result)
      res.send(result);
    })

    /// Doctor ///
    //----get pasent list by doctor email --- //
    app.get('/listfopasent/:email', async (req, res) => {
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
   app.get('/detailsBalance/:email',async(req,res)=>{
    const email= req.params?.email;
    const result= await doctors.aggregate([
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
          $project:{
            pasentList:1
          }
        },
        {
          $unwind: "$pasentList"
        }
      ]).toArray();
      // console.log('balance details',result)
      res.send(result)
   })
    /// Member ////
    //Get appointment list for member ///
    app.get('/appointmentlist/:email', async (req, res) => {
      const m_email = req.params?.email;

      const result = await Payment_Details.aggregate([
        {
          $match: { appliedEmail: m_email }
        },
        {
          $addFields: {
            doctorObjectId: { $toObjectId: "$doctor_id" } // doctor_id কে ObjectId বানাচ্ছি
          }
        },
        {
          $lookup: {
            from: 'doctorCollection', // doctor কালেকশনের নাম
            localField: 'doctorObjectId',
            foreignField: "_id",  // doctor's _id field
            as: 'Doctor_info'
          }
        },
        {
          $unwind: "$Doctor_info"
        }
      ]).toArray()

      // console.log(result)
      res.send(result)
    })

    /// member-payment-list related api ---
    app.get('/member_payment_list/:email', async (req, res) => {
      const email = req?.params?.email;
      const result = await Payment_Details.aggregate([
        {
          $match: { appliedEmail: email }
        },
        {
          $addFields: {
            doctorObjectId: { $toObjectId: "$doctor_id" } // doctor_id কে ObjectId বানাচ্ছি
          }
        },
        {
          $lookup: {
            from: 'doctorCollection', // doctor কালেকশনের নাম
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

    /// ---- Static page ----
    /// total payment ///
    app.get('/totalPayment/totalDoctor/:email', async (req, res) => {
      const Email = req.params?.email;
      // console.log('Email address', Email)
      const totalPay = await Payment_Details.aggregate([
        {
          $match: { appliedEmail: Email }
        },
        {
          $group: {
            _id: '$appliedEmail',
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
      const Doctor_list = await doctors.find({ appliedEmail: Email }).toArray()
      const totaldoctor = Doctor_list.length + 1;
      // console.log('totalpayment:', totalPay, totaldoctor)
      res.json([totalPay[0], totaldoctor])
    })


    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('server is running')
})
app.listen(port, () => {
  console.log('server is running', port)
})

