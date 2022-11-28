const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const jwt = require('jsonwebtoken')

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)

const app = express()
const port = process.env.PORT || 5000

// middlewares
app.use(cors())
app.use(express.json())


// Database Connection
const uri = process.env.DB_URI
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
})



const verifyJWT = (req,res,next)=>{
  const auth = req.headers.authorization
  if(!auth){
    return res.status(401).send({message:'Unauthorized access'})
  }
  const token = auth.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded) {
    if(err){
     return res.status(403).send({message:'forbidden'})
    }
    req.decoded = decoded
    next()
  });
}


const run = async()=>{

  const usersCollection = client.db('bikerDb').collection("users")
  const categoriesCollection = client.db('bikerDb').collection("categories")
  const productsCollection = client.db('bikerDb').collection("products")
  const bookingsCollection = client.db('bikerDb').collection("bookings")
  const advertiseCollection = client.db('bikerDb').collection("addvertise")
  const paymentsCollection = client.db('bikerDb').collection("payments")


  try{

    // verification 

    const verifyAdmin= async(req,res,next)=>{
      const decodedEmail = req.decoded.email
      const query = {email:decodedEmail}
      const user = await usersCollection.findOne(query)
      if(user?.role!=='admin'){
        return res.status(401).send({message:'unauthorized access'})
      }
      next()
    }
    const verifySeller= async(req,res,next)=>{
      const decodedEmail = req.decoded.email
      const query = {email:decodedEmail}
      const user = await usersCollection.findOne(query)
      if(user?.role!=='seller'){
        return res.status(401).send({message:'unauthorized access'})
      }
      next()
    }

    // payment 


    app.post("/create-payment-intent", async (req, res) =>{

      const booking = req.body
      const price = booking.price
      const amount = price * 100
      const paymentIntent = await stripe.paymentIntents.create({
          currency:'usd',
          amount :amount,
          payment_method_types: [
              "card"
            ],
      })
      res.send({
          clientSecret: paymentIntent.client_secret,
        })
  })

  // store payments in database

  app.post('/payments',verifyJWT,async(req,res)=>{
    const payment = req.body
    const result = await paymentsCollection.insertOne(payment)
    const query = {productId:payment.productId}
    const adDelete = await advertiseCollection.deleteOne(query)
    const filter = {_id:ObjectId(payment.productId)}
    const updatedProductDoc = {
      $set:{
        paid:true
      }
    }
    const updateProduct = await productsCollection.updateOne(filter,updatedProductDoc)
    const bookingfilter = {_id:ObjectId(payment.bookingId)}
    const updatedBookingDoc = {
      $set:{
        paid:true,
        transactionId:payment.transactionID
      }
    }
    const updateBooking = await bookingsCollection.updateOne(bookingfilter,updatedProductDoc)

    res.send(result)

  })



    // user api
    app.put('/user/:email',async(req,res)=>{
      const email = req.params.email
  
      const user = req.body
      const filter = {email:email}
      const options = { upsert: true };
      const updateDoc = {
        $set:user
      }
      const result = await usersCollection.updateOne(filter, updateDoc, options)
      if(user?.verified){
        const query = {'seller.email':email}

        const update = {
          $set:{'seller.verified':true}
        }
        
        const updateVerification = await productsCollection.updateMany(query,update)

      }
      res.send(result)
    })


    // get token

    app.get('/jwt',async(req,res)=>{
      const email = req.query.email
      const query = {email:email}
      const user = await usersCollection.findOne(query)
      if(!user){
        return res.status(401).send({token:''})
      }
      const token = jwt.sign(user,process.env.ACCESS_TOKEN,{expiresIn:'1d'})
      res.send({token})
    })

    // get users for role
    app.get('/user/:email',verifyJWT,async(req,res)=>{
      const decodedEmail = req.decoded.email
      const email = req.params.email
      if(email!==decodedEmail){
        return res.status(403).send({message:'forbidden'})
      }
      const filter = {email:email}
      const result = await usersCollection.findOne(filter)
      res.send(result)
    })

    // open routes


    // get category

    app.get('/categories',async(req,res)=>{
      const result = await categoriesCollection.find({}).toArray()
      res.send(result)
    })

    // products advertise

  
    app.get('/advertise',async(req,res)=>{
      
      const result = await advertiseCollection.find({}).sort({_id:-1}).toArray()
      res.send(result)
    })

    // categories product

    app.get('/category/:id',async(req,res)=>{
      const id = req.params.id
      const query = {_id:ObjectId(id)}
      const category = await categoriesCollection.findOne(query) 
      const filter = {category:category.name}
      const result = await productsCollection.find(filter).toArray()
      let remaining
      result.forEach(product=>{
        const unsold = result.filter(p=>p.paid === product.paid)
        remaining = unsold
      })
      res.send(remaining)
    })

    // open routes close


    // users route

    // booking

    app.post('/booking',verifyJWT,async(req,res)=>{
      const bookingInfo = req.body

      const filter = {email:bookingInfo.email}
      const alreadyBooked = await bookingsCollection.find(filter).toArray()
      if(alreadyBooked.length){
        const message = 'you have already booked this product'
        return res.send({acknowledged: false, message})
      }
      const result = await bookingsCollection.insertOne(bookingInfo)
      res.send(result)
    })

    app.get('/booking',verifyJWT,async(req,res)=>{
      const email = req.query.email

      const decodedEmail = req.decoded.email
     
      if(email!==decodedEmail){
        return res.status(403).send({message:'forbidden'})
      }
      
      const query = {email:email}

      const result = await bookingsCollection.find(query).toArray()
    
      res.send(result)
    })
    app.get('/booking/:id',async(req,res)=>{
      const id = req.params.id
      
      const query = {_id:ObjectId(id)}

      const result = await bookingsCollection.findOne(query)
    
      res.send(result)
    })

    // delete booking

    app.delete('/booking/:id',verifyJWT,async(req,res)=>{
      const id = req.params.id
      const filter = {_id:ObjectId(id)}
      const result = await bookingsCollection.deleteOne(filter)
      res.send(result)
    })


    // seller routes

    // seller's products
    app.get('/product',verifyJWT,verifySeller,async(req,res)=>{
      const email = req.query.email
      const filter = {'seller.email':email}
      const result = await productsCollection.find(filter).toArray()
      res.send(result)
    })
    // seller's delete product
    app.delete('/product/:id',verifyJWT,verifySeller,async(req,res)=>{
      const id = req.params.id
      const filter = {_id:ObjectId(id)}
      const result = await productsCollection.deleteOne(filter)
      res.send(result)
    })

    app.post('/product',verifyJWT,verifySeller,async(req,res)=>{
      const proudct = req.body
      const result = await productsCollection.insertOne(proudct)
      res.send(result)
    })


    // seller advertise product

    app.post('/advertise',verifyJWT,verifySeller,async(req,res)=>{
      const adproduct = req.body
      const filter = {_id:ObjectId(adproduct.productId)}
      const updateDoc = {
        $set:{
          advertise:true
        }
      }
      const updateProduct = await productsCollection.updateOne(filter,updateDoc)
      const result = await advertiseCollection.insertOne(adproduct)
      res.send(result)
    })
 

    
    // reported product admin route

    app.put('/product/:id',verifyJWT,async(req,res)=>{
      const id = req.params.id
      const product = req.body
      const filter = {_id:ObjectId(id)}
      const options = {upsert:true}
      const updatedDoc = {
        $set:{
          reported:true
        }
      }
      const updateProduct = await productsCollection.updateOne(filter,updatedDoc,options)

      res.send(updateProduct)
    })



    // admin routes

    // to show all users an buyers

    app.get('/user',verifyJWT,verifyAdmin,async(req,res)=>{
      const role = req.query.role
      const filter = {role:role}
      const result = await usersCollection.find(filter).toArray()
      res.send(result)
    })

    app.delete('/user/:id',verifyJWT,verifyAdmin,async(req,res)=>{
      const id = req.params.id
      const filter = {_id:ObjectId(id)}
      const user = await usersCollection.findOne(filter)
      const query = {'seller.email':user.email}
      const deleteproducts = await productsCollection.deleteMany(query)
      const result = await usersCollection.deleteOne(filter)
      res.send(result)
    })

    // reported product
    app.get('/reported-product',async(req,res)=>{
      
      const filter = {}
      
      const result = await productsCollection.find(filter).toArray()
      let reportedProduct
      result.forEach(product=>{
        const reported = result.filter(p=>p.reported!==product.reported)
        reportedProduct = reported

      })
      res.send(reportedProduct)
    })

    // delete reported product
    app.delete('/reported-product/:id',async(req,res)=>{

      const id = req.params.id
      const filter = {_id:ObjectId(id)}
      const result = await productsCollection.deleteOne(filter)
      const query = {productId:id}
      const deletAdd = await advertiseCollection.deleteOne(query)
      res.send(result)
    })





  }
  finally{

  }

}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Hello bubu from node')
  })
  
  app.listen(port, () => {
    console.log(`Server is running...on ${port}`)
  })
  