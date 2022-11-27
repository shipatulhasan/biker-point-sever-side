const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const jwt = require('jsonwebtoken')

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


  try{

    // verification 

    const verifyAdmin= async(req,res,next)=>{
      const decodedEmail = req.decoded.email
      console.log(decodedEmail)
      const query = {email:decodedEmail}
      const user = await usersCollection.findOne(query)
      if(user?.role!== 'admin'){
        return res.status(401).send({message:'unauthorized access'})
      }
      next()
    }
    const verifySeller= async(req,res,next)=>{
      const decodedEmail = req.decoded.email
      const query = {email:decodedEmail}
      const user = await usersCollection.findOne(query)
      if(user?.role!== 'seller'){
        return res.status(401).send({message:'unauthorized access'})
      }
      next()
    }


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
        console.log(updateVerification)

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


    // get category
    app.get('/categories',async(req,res)=>{
      const result = await categoriesCollection.find({}).toArray()
      res.send(result)
    })

    // products 

    app.post('/product',verifyJWT,verifySeller,async(req,res)=>{
      const proudct = req.body
      const result = await productsCollection.insertOne(proudct)
      res.send(result)
    })

    // categories product
    app.get('/category/:id',async(req,res)=>{
      const id = req.params.id
      const query = {_id:ObjectId(id)}
      const category = await categoriesCollection.findOne(query) 
      const filter = {category:category.name}
      const result = await productsCollection.find(filter).toArray()
      res.send(result)
    })


    // users route

    // booking

    app.post('/booking',verifyJWT,async(req,res)=>{
      const bookingInfo = req.body
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

    // delete booking

    app.delete('/booking/:id',async(req,res)=>{
      const id = req.params.id
      const filter = {_id:ObjectId(id)}
      const result = await bookingsCollection.deleteOne(filter)
      res.send(result)
    })





    // seller routes

    // seller's products
    app.get('/product',verifyJWT,verifySeller,async(req,res)=>{
      const email = req.query.email
      const reported = req.query.reported
      let filter = {}
      if(email){
        filter = {'seller.email':email}
      }
      if(reported){
        filter = {reported:reported}
      }
      const result = await productsCollection.find(filter).toArray()
      res.send(result)
    })
    // seller's delete product
    app.delete('/product/:id',async(req,res)=>{
      const id = req.params.id
      const filter = {_id:ObjectId(id)}
      const result = await productsCollection.deleteOne(filter)
      res.send(result)
    })

    
    // reported product admin route

    app.put('/product/:id',verifyJWT,verifyAdmin,async(req,res)=>{
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

    app.delete('/user/:id',async(req,res)=>{
      const id = req.params.id
      const filter = {_id:ObjectId(id)}
      const user = await usersCollection.findOne(filter)
      const query = {'seller.email':user.email}
      const deleteproducts = await productsCollection.deleteMany(query)
      const result = await usersCollection.deleteOne(filter)
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
  